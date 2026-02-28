import EventEmitter from 'events';
import {
  ClientEvent,
  Direction,
  IEvent,
  KnownMembership,
  MatrixClient,
  MatrixEvent,
  MatrixEventEvent,
  RoomStateEvent,
} from 'matrix-js-sdk';
import {
  ClientWidgetApi,
  IRoomEvent,
  IStickyActionRequest,
  IWidget,
  IWidgetData,
  MatrixCapabilities,
  WidgetApiFromWidgetAction,
  WidgetKind,
} from 'matrix-widget-api';
import { CinnyWidget } from './CinnyWidget';
import { SmallWidgetDriver } from './SmallWidgetDriver';

const DEFAULT_ELEMENT_CALL_URL = 'https://call.element.io';

export const getWidgetUrl = (
  mx: MatrixClient,
  roomId: string,
  elementCallUrl: string,
  widgetId: string,
  setParams: Record<string, string | undefined>,
): URL => {
  const baseUrl = window.location.origin;
  const url = elementCallUrl
    ? new URL(`${elementCallUrl}/room`)
    : new URL('/public/element-call/index.html#', baseUrl);

  const params = new URLSearchParams({
    embed: 'true',
    widgetId,
    appPrompt: 'false',
    skipLobby: setParams.skipLobby ?? 'true',
    returnToLobby: setParams.returnToLobby ?? 'true',
    perParticipantE2EE: setParams.perParticipantE2EE ?? 'true',
    callIntent: setParams.callIntent ?? 'video',
    header: 'none',
    confineToRoom: 'true',
    theme: setParams.theme ?? 'dark',
    userId: mx.getUserId()!,
    deviceId: mx.getDeviceId()!,
    roomId,
    baseUrl: mx.baseUrl!,
    parentUrl: window.location.origin,
  });

  const replacedParams = params.toString().replace(/%24/g, '$');
  url.search = `?${replacedParams}`;

  return url;
};

export interface IApp extends IWidget {
  client: MatrixClient;
  roomId: string;
  eventId?: string;
  avatar_url?: string;
  sender: string;
  'io.element.managed_hybrid'?: boolean;
}

export class SmallWidget extends EventEmitter {
  private client: MatrixClient;

  private messaging: ClientWidgetApi | null = null;

  private mockWidget: CinnyWidget;

  public roomId?: string;

  public url?: string;

  public iframe: HTMLIFrameElement | null = null;

  private type: string;

  private readUpToMap: { [roomId: string]: string } = {};

  private readonly eventsToFeed = new WeakSet<MatrixEvent>();

  private stickyPromise?: () => Promise<void>;

  constructor(private iapp: IApp) {
    super();
    this.client = iapp.client;
    this.roomId = iapp.roomId;
    this.url = iapp.url;
    this.type = iapp.type;
    this.mockWidget = new CinnyWidget(iapp);
  }

  startMessaging(iframe: HTMLIFrameElement): ClientWidgetApi {
    const driver = new SmallWidgetDriver(
      this.client,
      [],
      this.mockWidget,
      WidgetKind.Room,
      true,
      this.roomId,
    );
    this.iframe = iframe;
    this.messaging = new ClientWidgetApi(this.mockWidget, iframe, driver);
    this.messaging.setViewedRoomId(this.roomId ?? null);

    this.messaging.on('preparing', () => this.emit('preparing'));
    this.messaging.on('error:preparing', (err: unknown) => this.emit('error:preparing', err));
    this.messaging.once('ready', () => this.emit('ready'));

    for (const room of this.client.getRooms()) {
      const events = room.getLiveTimeline()?.getEvents() || [];
      const roomEvent = events[events.length - 1];
      if (roomEvent) {
        const eventId = roomEvent.getId();
        if (eventId) this.readUpToMap[room.roomId] = eventId;
      }
    }

    this.messaging.on('action:org.matrix.msc2876.read_events', (ev: CustomEvent) => {
      const room = this.client.getRoom(this.roomId);
      const events: Partial<IEvent>[] = [];
      const { type } = ev.detail.data;

      ev.preventDefault();
      if (room === null) {
        return this.messaging?.transport.reply(ev.detail, { events });
      }
      const state = room.getLiveTimeline().getState(Direction.Forward);
      if (state === undefined) {
        return this.messaging?.transport.reply(ev.detail, { events });
      }

      const stateEvents = state.events?.get(type);

      Array.from(stateEvents?.values() ?? []).forEach((eventObject) => {
        events.push(eventObject.event);
      });

      return this.messaging?.transport.reply(ev.detail, { events });
    });

    this.client.on(ClientEvent.Event, this.onEvent);
    this.client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.client.on(RoomStateEvent.Events, this.onStateUpdate);
    this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    this.messaging.on(
      `action:${WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`,
      async (ev: CustomEvent<IStickyActionRequest>) => {
        if (this.messaging?.hasCapability(MatrixCapabilities.AlwaysOnScreen)) {
          ev.preventDefault();
          if (ev.detail.data.value) {
            if (this.stickyPromise) await this.stickyPromise();
            this.messaging.transport.reply(ev.detail, {});
          }
        }
      },
    );

    return this.messaging;
  }

  private onEvent = (ev: MatrixEvent): void => {
    this.client.decryptEventIfNeeded(ev);
    if (!ev.isState()) this.feedEvent(ev);
  };

  private onEventDecrypted = (ev: MatrixEvent): void => {
    if (!ev.isState()) this.feedEvent(ev);
  };

  private onStateUpdate = (ev: MatrixEvent): void => {
    if (this.messaging === null || !ev.isState()) return;
    const raw = ev.getEffectiveEvent();
    this.messaging.feedStateUpdate(raw as IRoomEvent).catch(() => null);
  };

  private onToDeviceEvent = async (ev: MatrixEvent): Promise<void> => {
    await this.client.decryptEventIfNeeded(ev);
    if (ev.isDecryptionFailure()) return;
    await this.messaging?.feedToDevice(ev.getEffectiveEvent() as IRoomEvent, ev.isEncrypted());
  };

  private isFromInvite(ev: MatrixEvent): boolean {
    const room = this.client.getRoom(ev.getRoomId());
    return room?.getMyMembership() === KnownMembership.Invite;
  }

  private relatesToUnknown(ev: MatrixEvent): boolean {
    if (!ev.relationEventId || ev.replyEventId) return false;
    const room = this.client.getRoom(ev.getRoomId());
    return room === null || !room.findEventById(ev.relationEventId);
  }

  private advanceReadUpToMarker(ev: MatrixEvent): boolean {
    const evId = ev.getId();
    if (evId === undefined) return false;
    const roomId = ev.getRoomId();
    if (roomId === undefined) return false;
    const room = this.client.getRoom(roomId);
    if (room === null) return false;

    const upToEventId = this.readUpToMap[ev.getRoomId()!];
    if (!upToEventId) {
      this.readUpToMap[roomId] = evId;
      return true;
    }

    if (upToEventId === evId) return false;

    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents().slice().reverse().slice(0, 100);

    let advanced = false;

    events.some((timelineEvent) => {
      const id = timelineEvent.getId();

      if (id === upToEventId) {
        return true;
      }

      if (id === evId) {
        this.readUpToMap[roomId] = evId;
        advanced = true;
        return true;
      }
      return false;
    });

    return advanced;
  }

  private feedEvent(ev: MatrixEvent): void {
    if (this.messaging === null) return;

    if (
      this.eventsToFeed.delete(ev) ||
      this.relatesToUnknown(ev) ||
      this.isFromInvite(ev) ||
      this.advanceReadUpToMarker(ev)
    ) {
      if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
        this.eventsToFeed.add(ev);
      } else {
        const raw = ev.getEffectiveEvent();
        this.messaging.feedEvent(raw as IRoomEvent).catch(() => null);
      }
    }
  }

  stopMessaging() {
    if (this.messaging) {
      this.messaging.stop();
      this.messaging.removeAllListeners();
      this.messaging = null;
    }

    this.client.off(ClientEvent.Event, this.onEvent);
    this.client.off(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.client.off(RoomStateEvent.Events, this.onStateUpdate);
    this.client.off(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
  }
}

export const getWidgetData = (
  client: MatrixClient,
  roomId: string,
  currentData: object,
  overwriteData: object,
): IWidgetData => {
  const perParticipantE2EE = true;

  return {
    ...currentData,
    ...overwriteData,
    perParticipantE2EE,
  };
};

export const createVirtualWidget = (
  client: MatrixClient,
  id: string,
  creatorUserId: string,
  name: string,
  type: string,
  url: URL,
  waitForIframeLoad: boolean,
  data: IWidgetData,
  roomId: string,
): IApp => ({
  client,
  id,
  creatorUserId,
  name,
  type,
  url: url.toString(),
  waitForIframeLoad,
  data,
  roomId,
  sender: creatorUserId,
});
