import React, { useEffect, useRef } from 'react';

type VideoFeedProps = {
  stream: MediaStream | undefined;
  muted?: boolean;
  className?: string;
};

export function VideoFeed({ stream, muted = false, className }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) return;

    videoEl.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}
