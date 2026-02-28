import React, { useEffect, useState } from 'react';
import { Text } from 'folds';

type CallDurationProps = {
  startTime: number | null;
  size?: 'T200' | 'T300' | 'T400' | 'H5';
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function CallDuration({ startTime, size = 'T300' }: CallDurationProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime === null) return undefined;

    const update = () => setElapsed(Date.now() - startTime);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (startTime === null) return null;

  return (
    <Text as="span" size={size}>
      {formatDuration(elapsed)}
    </Text>
  );
}
