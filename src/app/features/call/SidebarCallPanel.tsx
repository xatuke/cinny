import React from 'react';
import classNames from 'classnames';
import { Icon, Icons } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallHandler } from '../../hooks/useCallHandler';
import { useActiveCall } from '../../hooks/useActiveCall';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useRoomCallMembers } from '../../hooks/useRoomCallMembers';
import { CallDuration } from './CallDuration';
import * as css from './SidebarCallPanel.css';

export function SidebarCallPanel() {
  const mx = useMatrixClient();
  const callHandler = useCallHandler();
  const activeCall = useActiveCall();
  const { navigateRoom } = useRoomNavigate();

  const room = activeCall ? mx.getRoom(activeCall.roomId) ?? undefined : undefined;
  const callMembers = useRoomCallMembers(room);

  if (!activeCall) return null;

  const roomName = room?.name ?? 'Unknown';
  const userId = mx.getUserId();
  const isConnected = callMembers.some((m) => m.userId === userId);

  const handleToggleMic = () => {
    callHandler.toggleMic();
  };

  const handleToggleVideo = () => {
    callHandler.toggleVideo();
  };

  const handleToggleDeafen = () => {
    callHandler.toggleDeafen();
  };

  const handleHangup = () => {
    callHandler.hangup();
  };

  const handleGoToCallRoom = () => {
    navigateRoom(activeCall.roomId);
  };

  return (
    <div className={css.PanelContainer}>
      <div className={css.StatusRow}>
        <span className={isConnected ? css.SignalIcon : css.SignalIconConnecting}>
          <Icon size="200" src={Icons.Phone} />
        </span>
        <div className={css.StatusInfo}>
          <span className={isConnected ? css.ConnectedLabel : css.ConnectingLabel}>
            {isConnected
              ? `${activeCall.type === 'video' ? 'Video' : 'Voice'} Connected`
              : 'Connecting...'}
          </span>
          <button
            type="button"
            className={css.RoomNameButton}
            onClick={handleGoToCallRoom}
          >
            {roomName}
            {isConnected && activeCall.startTime && (
              <>
                {' \u2014 '}
                <CallDuration startTime={activeCall.startTime} />
              </>
            )}
          </button>
        </div>
        {isConnected && (
          <button
            type="button"
            className={css.HangupButton}
            onClick={handleHangup}
            title="Disconnect"
          >
            <Icon size="100" src={Icons.PhoneDown} />
          </button>
        )}
      </div>
      <div className={css.PanelControls}>
        <button
          type="button"
          className={classNames(
            css.SmallControlButton,
            activeCall.micMuted && css.SmallControlButtonActive
          )}
          onClick={handleToggleMic}
          title={activeCall.micMuted ? 'Unmute' : 'Mute'}
        >
          <Icon size="200" src={activeCall.micMuted ? Icons.MicMute : Icons.Mic} />
        </button>
        <button
          type="button"
          className={classNames(
            css.SmallControlButton,
            activeCall.deafened && css.SmallControlButtonActive
          )}
          onClick={handleToggleDeafen}
          title={activeCall.deafened ? 'Undeafen' : 'Deafen'}
        >
          <Icon size="200" src={activeCall.deafened ? Icons.HeadphoneMute : Icons.Headphone} />
        </button>
        <button
          type="button"
          className={classNames(
            css.SmallControlButton,
            activeCall.videoMuted && css.SmallControlButtonActive
          )}
          onClick={handleToggleVideo}
          title={activeCall.videoMuted ? 'Turn on camera' : 'Turn off camera'}
        >
          <Icon size="200" src={activeCall.videoMuted ? Icons.VideoCameraMute : Icons.VideoCamera} />
        </button>
      </div>
    </div>
  );
}
