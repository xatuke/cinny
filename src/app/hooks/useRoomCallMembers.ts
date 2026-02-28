import { useCallback, useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { useMatrixClient } from './useMatrixClient';

export type CallMember = {
  userId: string;
};

/**
 * Returns the list of users currently in an active MatrixRTC call session
 * in the given room. Subscribes to membership changes for reactivity.
 */
export function useRoomCallMembers(room: Room | undefined): CallMember[] {
  const mx = useMatrixClient();
  const [members, setMembers] = useState<CallMember[]>([]);

  const updateMembers = useCallback(() => {
    if (!room) {
      setMembers([]);
      return;
    }
    try {
      const session = mx.matrixRTC?.getRoomSession(room);
      if (!session || session.memberships.length === 0) {
        setMembers([]);
        return;
      }

      // Deduplicate by userId (a user may have multiple devices)
      const seen = new Set<string>();
      const result: CallMember[] = [];
      for (const m of session.memberships) {
        const userId = m.sender;
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);
        result.push({ userId });
      }
      setMembers(result);
    } catch {
      setMembers([]);
    }
  }, [mx, room]);

  useEffect(() => {
    updateMembers();

    if (!room) return undefined;
    try {
      const session = mx.matrixRTC?.getRoomSession(room);
      if (session) {
        session.on(MatrixRTCSessionEvent.MembershipsChanged, updateMembers);
        return () => {
          session.off(MatrixRTCSessionEvent.MembershipsChanged, updateMembers);
        };
      }
    } catch {
      // matrixRTC may not be available
    }
    return undefined;
  }, [mx, room, updateMembers]);

  return members;
}
