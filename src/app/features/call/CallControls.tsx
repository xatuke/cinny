import React from 'react';
import classNames from 'classnames';
import { Icon, Icons } from 'folds';
import { useCallHandler } from '../../hooks/useCallHandler';
import { useActiveCall } from '../../hooks/useActiveCall';
import * as css from './CallControls.css';

type CallControlsProps = {
  compact?: boolean;
};

export function CallControls({ compact }: CallControlsProps) {
  const callHandler = useCallHandler();
  const activeCall = useActiveCall();

  if (!activeCall) return null;

  const handleToggleMic = () => {
    callHandler.toggleMic();
  };

  const handleToggleVideo = () => {
    callHandler.toggleVideo();
  };

  const handleToggleScreenshare = () => {
    callHandler.toggleScreenshare();
  };

  const handleHangup = () => {
    callHandler.hangup();
  };

  return (
    <div className={css.ControlsBar}>
      <button
        type="button"
        className={classNames(css.ControlButton, activeCall.micMuted && css.ControlButtonMuted)}
        onClick={handleToggleMic}
        title={activeCall.micMuted ? 'Unmute' : 'Mute'}
      >
        <Icon size="400" src={activeCall.micMuted ? Icons.MicMute : Icons.Mic} />
      </button>

      {activeCall.type === 'video' && !activeCall.isGroupCall && (
        <button
          type="button"
          className={classNames(
            css.ControlButton,
            activeCall.videoMuted && css.ControlButtonMuted
          )}
          onClick={handleToggleVideo}
          title={activeCall.videoMuted ? 'Turn on camera' : 'Turn off camera'}
        >
          <Icon
            size="400"
            src={activeCall.videoMuted ? Icons.VideoCameraMute : Icons.VideoCamera}
          />
        </button>
      )}

      {!compact && !activeCall.isGroupCall && (
        <button
          type="button"
          className={classNames(
            css.ControlButton,
            activeCall.isScreensharing && css.ControlButtonMuted
          )}
          onClick={handleToggleScreenshare}
          title={activeCall.isScreensharing ? 'Stop sharing' : 'Share screen'}
        >
          <Icon size="400" src={Icons.ScreenShare} />
        </button>
      )}

      <button
        type="button"
        className={css.HangupButton}
        onClick={handleHangup}
        title="Hang up"
      >
        <Icon size="400" src={Icons.PhoneDown} />
      </button>
    </div>
  );
}
