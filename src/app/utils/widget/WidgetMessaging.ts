import {
  ClientWidgetApi,
  Widget,
  WidgetKind,
  MatrixCapabilities,
  IWidgetApiRequest,
} from 'matrix-widget-api';
import { MatrixClient, ClientEvent, RoomStateEvent, MatrixEvent } from 'matrix-js-sdk';
import { CinnyWidgetDriver } from './CinnyWidgetDriver';

export interface WidgetMessagingCallbacks {
  onJoinCall?: () => void;
  onHangupCall?: () => void;
  onClose?: () => void;
}

/**
 * Manages the lifecycle of widget communication via ClientWidgetApi.
 */
export class WidgetMessaging {
  private widgetApi: ClientWidgetApi | null = null;
  private client: MatrixClient;
  private widget: Widget;
  private roomId: string;
  private driver: CinnyWidgetDriver;
  private callbacks: WidgetMessagingCallbacks;

  constructor(
    client: MatrixClient,
    widget: Widget,
    roomId: string,
    callbacks: WidgetMessagingCallbacks = {}
  ) {
    this.client = client;
    this.widget = widget;
    this.roomId = roomId;
    this.driver = new CinnyWidgetDriver(client, roomId);
    this.callbacks = callbacks;
  }

  start(iframe: HTMLIFrameElement): void {
    this.widgetApi = new ClientWidgetApi(this.widget, iframe, this.driver);

    this.widgetApi.on('ready', () => {
      this.widgetApi?.updateVisibility(true);
    });

    // Handle widget actions
    this.widgetApi.on(`action:${MatrixCapabilities.AlwaysOnScreen}`, (ev: CustomEvent<IWidgetApiRequest>) => {
      ev.preventDefault();
      this.widgetApi?.transport.reply(ev.detail, {});
    });

    // Feed room events to the widget
    this.client.on(ClientEvent.Event, this.onEvent);
    this.client.on(RoomStateEvent.Events, this.onStateUpdate);
    this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceMessage);
  }

  stop(): void {
    this.client.removeListener(ClientEvent.Event, this.onEvent);
    this.client.removeListener(RoomStateEvent.Events, this.onStateUpdate);
    this.client.removeListener(ClientEvent.ToDeviceEvent, this.onToDeviceMessage);

    this.widgetApi?.stop();
    this.widgetApi = null;
  }

  private onEvent = (event: MatrixEvent): void => {
    if (event.getRoomId() !== this.roomId) return;
    if (!this.widgetApi) return;

    try {
      this.widgetApi.feedEvent(event.getEffectiveEvent() as any);
    } catch {
      // Ignore feed errors
    }
  };

  private onStateUpdate = (event: MatrixEvent): void => {
    if (event.getRoomId() !== this.roomId) return;
    if (!this.widgetApi) return;

    try {
      this.widgetApi.feedStateUpdate(event.getEffectiveEvent() as any);
    } catch {
      // Ignore feed errors
    }
  };

  private onToDeviceMessage = (event: MatrixEvent): void => {
    if (!this.widgetApi) return;

    try {
      this.widgetApi.feedToDevice(event.getEffectiveEvent() as any, false);
    } catch {
      // Ignore feed errors
    }
  };

  getWidgetApi(): ClientWidgetApi | null {
    return this.widgetApi;
  }
}
