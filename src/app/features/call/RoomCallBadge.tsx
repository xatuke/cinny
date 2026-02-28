import React from 'react';
import { Icon, Icons } from 'folds';

type RoomCallBadgeProps = {
  active: boolean;
};

export function RoomCallBadge({ active }: RoomCallBadgeProps) {
  if (!active) return null;

  return (
    <Icon
      size="50"
      src={Icons.Phone}
      style={{ color: 'var(--color-success-main, #43b581)' }}
    />
  );
}
