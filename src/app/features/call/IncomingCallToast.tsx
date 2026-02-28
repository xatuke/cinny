import React from 'react';
import { Avatar, Box, Button, Icon, Icons, Text } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallHandler } from '../../hooks/useCallHandler';
import { IncomingCall } from '../../state/call/callState';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { UserAvatar } from '../../components/user-avatar';
import { nameInitials } from '../../utils/common';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import * as css from './IncomingCallToast.css';

type IncomingCallToastProps = {
  call: IncomingCall;
};

export function IncomingCallToast({ call }: IncomingCallToastProps) {
  const mx = useMatrixClient();
  const callHandler = useCallHandler();
  const useAuthentication = useMediaAuthentication();

  const room = mx.getRoom(call.roomId);
  const roomName = room?.name ?? 'Unknown Room';

  const callerMember = room?.getMember(call.callerId);
  const callerName = callerMember?.name ?? getMxIdLocalPart(call.callerId) ?? call.callerId;
  const callerAvatarMxc = callerMember?.getMxcAvatarUrl();
  const callerAvatarUrl = callerAvatarMxc
    ? mxcUrlToHttp(mx, callerAvatarMxc, useAuthentication, 48, 48, 'crop') ?? undefined
    : undefined;

  const handleAccept = () => {
    callHandler.answerCall(call.callId);
  };

  const handleDecline = () => {
    callHandler.rejectCall(call.callId);
  };

  return (
    <div className={css.ToastContainer}>
      <div className={css.ToastCard}>
        <Box direction="Column" gap="300">
          <Box gap="300" alignItems="Center">
            <Avatar size="300">
              <UserAvatar
                userId={call.callerId}
                src={callerAvatarUrl}
                renderFallback={() => (
                  <Text size="H6">{nameInitials(callerName)}</Text>
                )}
              />
            </Avatar>
            <Box direction="Column" grow="Yes">
              <Text size="T400" truncate>
                {callerName}
              </Text>
              <Text size="T200" priority="300">
                {call.type === 'video' ? 'Video call' : 'Voice call'} - {roomName}
              </Text>
            </Box>
            <Icon
              size="200"
              src={call.type === 'video' ? Icons.VideoCamera : Icons.Phone}
            />
          </Box>
          <Box gap="200" justifyContent="End">
            <Button
              size="300"
              variant="Critical"
              fill="Solid"
              radii="300"
              onClick={handleDecline}
              before={<Icon size="100" src={Icons.PhoneDown} />}
            >
              <Text size="B300">Decline</Text>
            </Button>
            <Button
              size="300"
              variant="Success"
              fill="Solid"
              radii="300"
              onClick={handleAccept}
              before={<Icon size="100" src={Icons.Phone} />}
            >
              <Text size="B300">Accept</Text>
            </Button>
          </Box>
        </Box>
      </div>
    </div>
  );
}
