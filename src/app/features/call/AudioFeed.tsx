import React, { useEffect, useRef } from 'react';

type AudioFeedProps = {
  stream: MediaStream | undefined;
  muted?: boolean;
};

export function AudioFeed({ stream, muted }: AudioFeedProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;

    audioEl.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.muted = !!muted;
  }, [muted]);

  if (!stream) return null;

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} autoPlay muted={muted} style={{ display: 'none' }} />
  );
}
