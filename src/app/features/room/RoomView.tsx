import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Icon, Icons, Spinner, Text, config } from 'folds';
import { EventType, Room } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import { isKeyHotkey } from 'is-hotkey';
import { useAtomValue } from 'jotai';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useEditor } from '../../components/editor';
import { RoomInputPlaceholder } from './RoomInputPlaceholder';
import { RoomTimeline } from './RoomTimeline';
import { RoomViewTyping } from './RoomViewTyping';
import { RoomTombstone } from './RoomTombstone';
import { RoomInput } from './RoomInput';
import { RoomViewFollowing, RoomViewFollowingPlaceholder } from './RoomViewFollowing';
import { Page } from '../../components/page';
import { RoomViewHeader } from './RoomViewHeader';
import { RoomCallBanner } from '../call/RoomCallBanner';
import { useKeyDown } from '../../hooks/useKeyDown';
import { editableActiveElement } from '../../utils/dom';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useActiveCall } from '../../hooks/useActiveCall';
import { useCallHandler } from '../../hooks/useCallHandler';
import { callIframeRefAtom, isGroupCallReadyAtom } from '../../state/call/callState';
import { VideoFeed } from '../call/VideoFeed';
import { CallControls } from '../call/CallControls';
import { CallDuration } from '../call/CallDuration';
import { RoomAvatar } from '../../components/room-avatar';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { mxcUrlToHttp } from '../../utils/matrix';

const FN_KEYS_REGEX = /^F\d+$/;
const shouldFocusMessageField = (evt: KeyboardEvent): boolean => {
  const { code } = evt;
  if (evt.metaKey || evt.altKey || evt.ctrlKey) {
    return false;
  }

  // do not focus on F keys
  if (FN_KEYS_REGEX.test(code)) return false;

  // do not focus on numlock/scroll lock
  if (
    code.startsWith('OS') ||
    code.startsWith('Meta') ||
    code.startsWith('Shift') ||
    code.startsWith('Alt') ||
    code.startsWith('Control') ||
    code.startsWith('Arrow') ||
    code.startsWith('Page') ||
    code.startsWith('End') ||
    code.startsWith('Home') ||
    code === 'Tab' ||
    code === 'Space' ||
    code === 'Enter' ||
    code === 'NumLock' ||
    code === 'ScrollLock'
  ) {
    return false;
  }

  return true;
};

/**
 * Inline call view shown when viewing the room that has an active call.
 * For group calls: positions the persistent iframe over a host div using fixed positioning.
 * For 1:1 calls: shows video feeds and call controls.
 */
function InlineCallView({ room }: { room: Room }) {
  const mx = useMatrixClient();
  const callHandler = useCallHandler();
  const activeCall = useActiveCall();
  const iframeRef = useAtomValue(callIframeRefAtom);
  const isGroupCallReady = useAtomValue(isGroupCallReadyAtom);
  const useAuthentication = useMediaAuthentication();
  const iframeHostRef = useRef<HTMLDivElement>(null);
  const originalStylesRef = useRef<Record<string, string> | null>(null);

  const roomName = room.name ?? 'Unknown';
  const roomAvatarMxc = room.getMxcAvatarUrl();
  const roomAvatarUrl = roomAvatarMxc
    ? mxcUrlToHttp(mx, roomAvatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  // Position the persistent iframe over the host div using fixed positioning.
  // This avoids moving the iframe DOM node (which could cause issues in some browsers).
  const applyIframePositioning = useCallback(() => {
    const iframe = iframeRef?.current;
    const host = iframeHostRef.current;
    if (!iframe || !host) return;

    if (!originalStylesRef.current) {
      originalStylesRef.current = {
        position: iframe.style.position,
        top: iframe.style.top,
        left: iframe.style.left,
        width: iframe.style.width,
        height: iframe.style.height,
        zIndex: iframe.style.zIndex,
        visibility: iframe.style.visibility,
        border: iframe.style.border,
        pointerEvents: iframe.style.pointerEvents,
      };
    }

    const rect = host.getBoundingClientRect();
    iframe.style.position = 'fixed';
    iframe.style.top = `${rect.top}px`;
    iframe.style.left = `${rect.left}px`;
    iframe.style.width = `${rect.width}px`;
    iframe.style.height = `${rect.height}px`;
    iframe.style.border = 'none';
    iframe.style.zIndex = '1000';
    iframe.style.visibility = isGroupCallReady ? 'visible' : 'hidden';
    iframe.style.pointerEvents = isGroupCallReady ? 'auto' : 'none';
  }, [iframeRef, isGroupCallReady]);

  useEffect(() => {
    const iframe = iframeRef?.current;
    const host = iframeHostRef.current;

    if (activeCall?.isGroupCall && iframe && host) {
      applyIframePositioning();

      const resizeObserver = new ResizeObserver(applyIframePositioning);
      resizeObserver.observe(host);
      window.addEventListener('scroll', applyIframePositioning, true);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('scroll', applyIframePositioning, true);

        // Restore original styles (hide iframe again)
        if (iframe && originalStylesRef.current) {
          const orig = originalStylesRef.current;
          Object.keys(orig).forEach((key) => {
            (iframe.style as any)[key] = orig[key] || '';
          });
        }
        originalStylesRef.current = null;
      };
    }

    return undefined;
  }, [activeCall?.isGroupCall, iframeRef, applyIframePositioning]);

  if (!activeCall) return null;

  const isVideoCall = activeCall.type === 'video';

  const statusText = (() => {
    switch (activeCall.state) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return null;
      case 'ended':
        return 'Call ended';
      case 'failed':
        return 'Call failed';
      default:
        return '';
    }
  })();

  // Group call: render a host div that the iframe is positioned over
  if (activeCall.isGroupCall) {
    return (
      <Box grow="Yes" direction="Column">
        {/* Iframe host: the persistent iframe is positioned fixed over this div */}
        <div
          ref={iframeHostRef}
          style={{
            flex: 1,
            position: 'relative',
            pointerEvents: 'none',
            display: isGroupCallReady ? 'flex' : 'none',
            minHeight: 0,
          }}
        />
        {/* Loading state shown before Element Call signals readiness */}
        {!isGroupCallReady && (
          <Box grow="Yes" justifyContent="Center" alignItems="Center" direction="Column" gap="300">
            <Spinner />
            <Text size="T300" priority="300">Joining call...</Text>
          </Box>
        )}
      </Box>
    );
  }

  // 1:1 call: render video/voice UI inline
  return (
    <Box grow="Yes" direction="Column" alignItems="Center" justifyContent="Center" gap="400">
      {isVideoCall ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
          }}
        >
          <VideoFeed
            stream={callHandler.getRemoteStream()}
            className={undefined}
          />
          <VideoFeed
            stream={callHandler.getLocalStream()}
            muted
          />
        </div>
      ) : (
        <Box direction="Column" alignItems="Center" gap="400" style={{ padding: config.space.S600 }}>
          <Avatar size="500">
            <RoomAvatar
              roomId={activeCall.roomId}
              src={roomAvatarUrl}
              alt={roomName}
              renderFallback={() => (
                <Text size="H2">{roomName.charAt(0).toUpperCase()}</Text>
              )}
            />
          </Avatar>
          <Text size="H5">{roomName}</Text>
        </Box>
      )}

      {/* Status / Duration */}
      <Box justifyContent="Center" gap="200">
        {statusText ? (
          <Text size="T300" priority="300">{statusText}</Text>
        ) : (
          <Text size="T300" priority="300">
            <CallDuration startTime={activeCall.startTime} />
          </Text>
        )}
      </Box>

      {/* Controls */}
      <CallControls />
    </Box>
  );
}

export function RoomView({ room, eventId }: { room: Room; eventId?: string }) {
  const roomInputRef = useRef<HTMLDivElement>(null);
  const roomViewRef = useRef<HTMLDivElement>(null);

  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const { roomId } = room;
  const editor = useEditor();

  const mx = useMatrixClient();
  const activeCall = useActiveCall();

  const tombstoneEvent = useStateEvent(room, StateEvent.RoomTombstone);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canMessage = permissions.event(EventType.RoomMessage, mx.getSafeUserId());

  // Is this room currently in an active call?
  const isCallRoom = activeCall?.roomId === roomId;
  const [showCallView, setShowCallView] = useState(true);

  // Reset to call view when entering a call room
  useEffect(() => {
    if (isCallRoom) setShowCallView(true);
  }, [isCallRoom]);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (editableActiveElement()) return;
        const portalContainer = document.getElementById('portalContainer');
        if (portalContainer && portalContainer.children.length > 0) {
          return;
        }
        if (shouldFocusMessageField(evt) || isKeyHotkey('mod+v', evt)) {
          ReactEditor.focus(editor);
        }
      },
      [editor]
    )
  );

  const showInlineCall = isCallRoom && showCallView;
  const showTimeline = !isCallRoom || !showCallView;

  return (
    <Page ref={roomViewRef}>
      <RoomViewHeader />
      {isCallRoom && (
        <Box
          shrink="No"
          style={{
            padding: `0 ${config.space.S400}`,
            borderBottom: `1px solid var(--bg-surface-border)`,
          }}
        >
          <button
            type="button"
            onClick={() => setShowCallView(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: `${config.space.S200} ${config.space.S300}`,
              borderBottom: showCallView ? '2px solid currentColor' : '2px solid transparent',
              opacity: showCallView ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: config.space.S100,
              color: 'inherit',
            }}
          >
            <Icon size="100" src={Icons.Phone} />
            <Text size="T300">Call</Text>
          </button>
          <button
            type="button"
            onClick={() => setShowCallView(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: `${config.space.S200} ${config.space.S300}`,
              borderBottom: !showCallView ? '2px solid currentColor' : '2px solid transparent',
              opacity: !showCallView ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: config.space.S100,
              color: 'inherit',
            }}
          >
            <Icon size="100" src={Icons.Message} />
            <Text size="T300">Chat</Text>
          </button>
        </Box>
      )}
      {!isCallRoom && <RoomCallBanner room={room} />}
      {showInlineCall && <InlineCallView room={room} />}
      {showTimeline && (
        <>
          <Box grow="Yes" direction="Column">
            <RoomTimeline
              key={roomId}
              room={room}
              eventId={eventId}
              roomInputRef={roomInputRef}
              editor={editor}
            />
            <RoomViewTyping room={room} />
          </Box>
          <Box shrink="No" direction="Column">
            <div style={{ padding: `0 ${config.space.S400}` }}>
              {tombstoneEvent ? (
                <RoomTombstone
                  roomId={roomId}
                  body={tombstoneEvent.getContent().body}
                  replacementRoomId={tombstoneEvent.getContent().replacement_room}
                />
              ) : (
                <>
                  {canMessage && (
                    <RoomInput
                      room={room}
                      editor={editor}
                      roomId={roomId}
                      fileDropContainerRef={roomViewRef}
                      ref={roomInputRef}
                    />
                  )}
                  {!canMessage && (
                    <RoomInputPlaceholder
                      style={{ padding: config.space.S200 }}
                      alignItems="Center"
                      justifyContent="Center"
                    >
                      <Text align="Center">You do not have permission to post in this room</Text>
                    </RoomInputPlaceholder>
                  )}
                </>
              )}
            </div>
            {hideActivity ? <RoomViewFollowingPlaceholder /> : <RoomViewFollowing room={room} />}
          </Box>
        </>
      )}
    </Page>
  );
}
