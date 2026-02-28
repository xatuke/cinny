import React from 'react';
import { Box, Icon, Icons, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useCallHandler } from '../../hooks/useCallHandler';
import { useActiveCall } from '../../hooks/useActiveCall';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { generateElementCallUrl } from '../../utils/widget/widgetUrl';
import * as css from './RoomCallBanner.css';

type RoomCallBannerProps = {
  room: Room;
};

export function RoomCallBanner({ room }: RoomCallBannerProps) {
  const mx = useMatrixClient();
  const callHandler = useCallHandler();
  const activeCall = useActiveCall();

  // Don't show banner if we're already in a call in this room
  if (activeCall?.roomId === room.roomId) return null;

  // Check if there's an active MatrixRTC session in this room
  let hasActiveSession = false;
  try {
    const session = mx.matrixRTC?.getRoomSession(room);
    hasActiveSession = session && session.memberships.length > 0;
  } catch {
    // matrixRTC may not be available
  }

  if (!hasActiveSession) return null;

  const handleJoin = () => {
    if (activeCall) return; // Already in a call
    const widgetUrl = generateElementCallUrl(mx, room.roomId);
    callHandler.startGroupCall(room.roomId, 'voice', widgetUrl);
  };

  return (
    <div
      className={css.BannerContainer}
      onClick={handleJoin}
      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
      role="button"
      tabIndex={0}
    >
      <Box gap="200" alignItems="Center">
        <Icon size="200" src={Icons.Phone} />
        <span className={css.BannerText}>
          Voice call in progress
        </span>
      </Box>
      <Text size="T200">Click to join</Text>
    </div>
  );
}
