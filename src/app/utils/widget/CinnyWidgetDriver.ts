import {
  WidgetDriver,
  IRoomEvent,
  Capability,
  MatrixCapabilities,
  SimpleObservable,
  OpenIDRequestState,
  ITurnServer,
} from 'matrix-widget-api';
import type { ISendEventDetails, IOpenIDUpdate } from 'matrix-widget-api/lib/driver/WidgetDriver';
import { MatrixClient, EventType } from 'matrix-js-sdk';

/**
 * Widget driver for Element Call widget communication.
 * Bridges widget API requests to the MatrixClient.
 */
export class CinnyWidgetDriver extends WidgetDriver {
  private client: MatrixClient;
  private roomId: string;

  constructor(client: MatrixClient, roomId: string) {
    super();
    this.client = client;
    this.roomId = roomId;
  }

  async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    // Auto-approve all capabilities for Element Call (trusted widget)
    const approved = new Set<Capability>(requested);

    // Always grant these core capabilities
    approved.add(MatrixCapabilities.AlwaysOnScreen);
    approved.add(MatrixCapabilities.MSC3846TurnServers);

    return approved;
  }

  async sendEvent(
    eventType: string,
    content: unknown,
    stateKey?: string | null,
    roomId?: string | null
  ): Promise<ISendEventDetails> {
    const targetRoomId = roomId || this.roomId;

    if (stateKey !== undefined && stateKey !== null) {
      const result = await this.client.sendStateEvent(
        targetRoomId,
        eventType as EventType,
        content as Record<string, unknown>,
        stateKey
      );
      return { roomId: targetRoomId, eventId: result.event_id };
    }

    const result = await this.client.sendEvent(
      targetRoomId,
      eventType as EventType,
      content as Record<string, unknown>
    );
    return { roomId: targetRoomId, eventId: result.event_id };
  }

  async sendToDevice(
    eventType: string,
    encrypted: boolean,
    contentMap: { [userId: string]: { [deviceId: string]: object } }
  ): Promise<void> {
    await this.client.sendToDevice(eventType, contentMap as any);
  }

  async readRoomEvents(
    eventType: string,
    msgtype: string | undefined,
    limit: number,
    roomIds?: string[] | null
  ): Promise<IRoomEvent[]> {
    const targetRoomId = roomIds?.[0] || this.roomId;
    const room = this.client.getRoom(targetRoomId);
    if (!room) return [];

    const events = room.getLiveTimeline().getEvents();
    return events
      .filter((ev) => {
        if (ev.getType() !== eventType) return false;
        if (msgtype && ev.getContent().msgtype !== msgtype) return false;
        return true;
      })
      .slice(-limit)
      .map((ev) => ev.getEffectiveEvent() as unknown as IRoomEvent);
  }

  async readStateEvents(
    eventType: string,
    stateKey: string | undefined,
    limit: number,
    roomIds?: string[] | null
  ): Promise<IRoomEvent[]> {
    const targetRoomId = roomIds?.[0] || this.roomId;
    const room = this.client.getRoom(targetRoomId);
    if (!room) return [];

    const stateEvents = stateKey !== undefined
      ? [room.currentState.getStateEvents(eventType, stateKey)].filter(Boolean)
      : room.currentState.getStateEvents(eventType);

    return stateEvents
      .slice(0, limit)
      .map((ev) => ev!.getEffectiveEvent() as unknown as IRoomEvent);
  }

  askOpenID(observer: SimpleObservable<IOpenIDUpdate>): void {
    this.client.getOpenIdToken().then(
      (token) => {
        observer.update({
          state: OpenIDRequestState.Allowed,
          token,
        });
      },
      () => {
        observer.update({
          state: OpenIDRequestState.PendingUserConfirmation,
        });
      }
    );
  }

  async *getTurnServers(): AsyncGenerator<ITurnServer> {
    try {
      const turnServer = this.client.getTurnServers()[0];
      if (turnServer) {
        yield {
          uris: turnServer.urls,
          username: turnServer.username || '',
          password: turnServer.password || '',
        };
      }
    } catch {
      // TURN server retrieval may fail
    }
  }
}
