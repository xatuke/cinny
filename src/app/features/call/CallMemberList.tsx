import React from 'react';
import { Avatar, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { UserAvatar } from '../../components/user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { CallMember } from '../../hooks/useRoomCallMembers';
import * as css from './CallMemberList.css';

type CallMemberListProps = {
  room: Room;
  members: CallMember[];
};

export function CallMemberList({ room, members }: CallMemberListProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  if (members.length === 0) return null;

  return (
    <div className={css.MemberList}>
      {members.map((member) => {
        const roomMember = room.getMember(member.userId);
        const displayName =
          roomMember?.name ?? getMxIdLocalPart(member.userId) ?? member.userId;
        const avatarMxc = roomMember?.getMxcAvatarUrl();
        const avatarUrl = avatarMxc
          ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 32, 32, 'crop') ?? undefined
          : undefined;

        return (
          <div key={member.userId} className={css.MemberItem}>
            <Avatar size="100" radii="Pill">
              <UserAvatar
                userId={member.userId}
                src={avatarUrl}
                alt={displayName}
                renderFallback={() => (
                  <Text as="span" size="L400">
                    {nameInitials(displayName)}
                  </Text>
                )}
              />
            </Avatar>
            <Text size="T200" truncate>
              {displayName}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
