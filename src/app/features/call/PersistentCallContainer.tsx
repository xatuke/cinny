import React, { useCallback, useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { ClientWidgetApi } from 'matrix-widget-api';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useActiveCall } from '../../hooks/useActiveCall';
import { useCallHandler } from '../../hooks/useCallHandler';
import { activeCallAtom, callIframeRefAtom, isGroupCallReadyAtom } from '../../state/call/callState';
import { AudioFeed } from './AudioFeed';
import {
  SmallWidget,
  createVirtualWidget,
  getWidgetData,
  getWidgetUrl,
} from './SmallWidget';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

const WIDGET_HANGUP_ACTION = 'im.vector.hangup';
const WIDGET_JOIN_ACTION = 'io.element.join';
const WIDGET_MEDIA_STATE_UPDATE_ACTION = 'io.element.device_mute';
const WIDGET_ON_SCREEN_ACTION = 'set_always_on_screen';
const WIDGET_TILE_UPDATE = 'io.element.tile_layout';

const IFRAME_SANDBOX = [
  'allow-forms',
  'allow-scripts',
  'allow-same-origin',
  'allow-popups',
  'allow-modals',
  'allow-downloads',
].join(' ');

const IFRAME_ALLOW = [
  'microphone',
  'camera',
  'display-capture',
  'autoplay',
  'clipboard-write',
].join('; ');

export function PersistentCallContainer() {
  const mx = useMatrixClient();
  const activeCall = useActiveCall();
  const callHandler = useCallHandler();
  const setIframeRef = useSetAtom(callIframeRefAtom);
  const setIsGroupCallReady = useSetAtom(isGroupCallReadyAtom);
  const setActiveCall = useSetAtom(activeCallAtom);
  const [elementCallUrl] = useSetting(settingsAtom, 'elementCallUrl');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetApiRef = useRef<ClientWidgetApi | null>(null);
  const smallWidgetRef = useRef<SmallWidget | null>(null);
  const setupDoneForRoomRef = useRef<string | null>(null);

  // Expose iframe ref via atom so RoomView can position it
  useEffect(() => {
    if (activeCall?.isGroupCall) {
      setIframeRef(iframeRef);
    } else {
      setIframeRef(null);
    }
    return () => {
      setIframeRef(null);
    };
  }, [activeCall?.isGroupCall, setIframeRef]);

  const hangUp = useCallback(() => {
    // Unregister so CallHandler doesn't call us again during cleanup
    callHandler.registerGroupHangup(null);

    // Clean up widget
    if (smallWidgetRef.current) {
      smallWidgetRef.current.stopMessaging();
      smallWidgetRef.current = null;
    }
    widgetApiRef.current = null;
    setupDoneForRoomRef.current = null;

    // Reset iframe
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }

    setIsGroupCallReady(false);
    callHandler.onGroupCallEnded();
  }, [callHandler, setIsGroupCallReady]);

  // Set up widget when a group call becomes active
  useEffect(() => {
    if (!activeCall?.isGroupCall || !mx.getUserId()) return;

    const roomId = activeCall.roomId;

    // Don't re-setup for the same room
    if (setupDoneForRoomRef.current === roomId) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    // Clean up previous widget if any
    if (smallWidgetRef.current) {
      smallWidgetRef.current.stopMessaging();
      smallWidgetRef.current = null;
    }
    widgetApiRef.current = null;

    const widgetId = `element-call-${roomId}-${Date.now()}`;
    const widgetUrlObj = getWidgetUrl(
      mx,
      roomId,
      elementCallUrl || 'https://call.element.io',
      widgetId,
      {
        skipLobby: 'true',
        returnToLobby: 'true',
        perParticipantE2EE: 'true',
        callIntent: 'audio',
        theme: 'dark',
      },
    );

    // Set iframe src FIRST so Element Call starts loading
    iframe.src = widgetUrlObj.toString();

    const userId = mx.getUserId() ?? '';
    const app = createVirtualWidget(
      mx,
      widgetId,
      userId,
      'Element Call',
      'm.call',
      widgetUrlObj,
      false,
      getWidgetData(mx, roomId, {}, { skipLobby: true, callIntent: 'audio' }),
      roomId,
    );

    const smallWidget = new SmallWidget(app);
    smallWidgetRef.current = smallWidget;

    const widgetApi = smallWidget.startMessaging(iframe);
    widgetApiRef.current = widgetApi;

    // Listen for Element Call's join action — UI is ready (but not yet fully connected
    // to the MatrixRTC session; actual connection is detected via membership changes)
    const handleJoin = (ev: CustomEvent) => {
      ev.preventDefault();
      widgetApi.transport.reply(ev.detail, {});
      setIsGroupCallReady(true);
    };

    const handleHangup = (ev: CustomEvent) => {
      ev.preventDefault();
      widgetApi.transport.reply(ev.detail, {});
      hangUp();
    };

    const handleOnScreen = (ev: CustomEvent) => {
      ev.preventDefault();
      widgetApi.transport.reply(ev.detail, {});
    };

    const handleTileLayout = (ev: CustomEvent) => {
      ev.preventDefault();
      widgetApi.transport.reply(ev.detail, {});
    };

    // Sync media state from Element Call → our atom
    const handleMediaStateUpdate = (ev: CustomEvent) => {
      ev.preventDefault();
      const { audio_enabled, video_enabled } = ev.detail?.data ?? {};
      setActiveCall((prev) => {
        if (!prev) return prev;
        const updates: Record<string, boolean> = {};
        if (typeof audio_enabled === 'boolean') updates.micMuted = !audio_enabled;
        if (typeof video_enabled === 'boolean') updates.videoMuted = !video_enabled;
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    };

    widgetApi.on(`action:${WIDGET_JOIN_ACTION}`, handleJoin);
    widgetApi.on(`action:${WIDGET_HANGUP_ACTION}`, handleHangup);
    widgetApi.on(`action:${WIDGET_ON_SCREEN_ACTION}`, handleOnScreen);
    widgetApi.on(`action:${WIDGET_TILE_UPDATE}`, handleTileLayout);
    widgetApi.on(`action:${WIDGET_MEDIA_STATE_UPDATE_ACTION}`, handleMediaStateUpdate);

    setupDoneForRoomRef.current = roomId;

    // Register a hangup function that sends the hangup action to Element Call
    // via widget API, letting it leave the MatrixRTC session properly.
    // Element Call will respond with im.vector.hangup which triggers handleHangup → hangUp().
    callHandler.registerGroupHangup(() => {
      const api = widgetApiRef.current;
      if (api) {
        // Tell Element Call to hang up (same as Element Web does)
        api.transport.send(WIDGET_HANGUP_ACTION as any, {}).catch(() => {});
        // Fallback: if Element Call doesn't respond within 5s, force cleanup
        setTimeout(() => {
          if (setupDoneForRoomRef.current) {
            hangUp();
          }
        }, 5000);
      } else {
        // No widget API available, force cleanup directly
        hangUp();
      }
    });

    return () => {
      widgetApi.off(`action:${WIDGET_JOIN_ACTION}`, handleJoin);
      widgetApi.off(`action:${WIDGET_HANGUP_ACTION}`, handleHangup);
      widgetApi.off(`action:${WIDGET_ON_SCREEN_ACTION}`, handleOnScreen);
      widgetApi.off(`action:${WIDGET_TILE_UPDATE}`, handleTileLayout);
      widgetApi.off(`action:${WIDGET_MEDIA_STATE_UPDATE_ACTION}`, handleMediaStateUpdate);
      callHandler.registerGroupHangup(null);
    };
  }, [activeCall?.isGroupCall, activeCall?.roomId, mx, elementCallUrl, callHandler, setIsGroupCallReady, setActiveCall, hangUp]);

  // Clean up when call ends (activeCall becomes null)
  useEffect(() => {
    if (!activeCall && setupDoneForRoomRef.current) {
      if (smallWidgetRef.current) {
        smallWidgetRef.current.stopMessaging();
        smallWidgetRef.current = null;
      }
      widgetApiRef.current = null;
      setupDoneForRoomRef.current = null;
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
      }
      setIsGroupCallReady(false);
    }
  }, [activeCall, setIsGroupCallReady]);

  // Sync media state from our atom → Element Call widget
  const prevMediaStateRef = useRef<{ micMuted: boolean; videoMuted: boolean } | null>(null);
  useEffect(() => {
    if (!activeCall?.isGroupCall) {
      prevMediaStateRef.current = null;
      return;
    }

    const widgetApi = widgetApiRef.current;
    if (!widgetApi) return;

    const currentState = { micMuted: activeCall.micMuted, videoMuted: activeCall.videoMuted };
    const prev = prevMediaStateRef.current;
    prevMediaStateRef.current = currentState;

    // Skip initial render (no previous state to compare)
    if (!prev) return;

    // Only send if something actually changed
    if (prev.micMuted !== currentState.micMuted || prev.videoMuted !== currentState.videoMuted) {
      widgetApi.transport.send(WIDGET_MEDIA_STATE_UPDATE_ACTION as any, {
        audio_enabled: !currentState.micMuted,
        video_enabled: !currentState.videoMuted,
      }).catch(() => {
        // Widget transport may reject during setup
      });
    }
  }, [activeCall?.isGroupCall, activeCall?.micMuted, activeCall?.videoMuted]);

  // Monitor MatrixRTC session memberships:
  // - Mark connected when our user joins the session (sets startTime for duration display)
  // - Auto-end call when session empties
  useEffect(() => {
    if (!activeCall?.isGroupCall) return undefined;

    const userId = mx.getUserId();
    const room = mx.getRoom(activeCall.roomId);
    if (!room || !userId) return undefined;

    try {
      const session = mx.matrixRTC?.getRoomSession(room);
      if (!session) return undefined;

      const checkMemberships = () => {
        // Only auto-end on empty memberships if we were already connected.
        // During connecting phase, 0 members is expected.
        if (session.memberships.length === 0 && activeCall.state === 'connected') {
          hangUp();
          return;
        }
        if (activeCall.state !== 'connected') {
          const weAreIn = session.memberships.some((m: any) => m.sender === userId);
          if (weAreIn) {
            callHandler.onGroupCallConnected();
          }
        }
      };

      session.on(MatrixRTCSessionEvent.MembershipsChanged, checkMemberships);
      return () => {
        session.off(MatrixRTCSessionEvent.MembershipsChanged, checkMemberships);
      };
    } catch {
      return undefined;
    }
  }, [activeCall?.isGroupCall, activeCall?.roomId, activeCall?.state, mx, callHandler, hangUp]);

  // The iframe is always in the DOM (persists across navigation).
  // For group calls: positioned absolutely, RoomView positions it over the call slot.
  // For 1:1 calls: just render AudioFeed globally.
  return (
    <>
      <iframe
        ref={iframeRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          visibility: 'hidden',
          zIndex: -1,
        }}
        title="Element Call"
        sandbox={IFRAME_SANDBOX}
        allow={IFRAME_ALLOW}
        src="about:blank"
      />
      {activeCall && !activeCall.isGroupCall && (
        <AudioFeed stream={callHandler.getRemoteStream()} muted={activeCall.deafened} />
      )}
    </>
  );
}
