import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  audioInputsAtom,
  videoInputsAtom,
  audioOutputsAtom,
  MediaDeviceInfo as MDInfo,
} from '../state/call/mediaDevices';

function mapDevice(device: MediaDeviceInfo): MDInfo {
  return {
    deviceId: device.deviceId,
    label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
    kind: device.kind,
  };
}

export function useMediaDevices() {
  const setAudioInputs = useSetAtom(audioInputsAtom);
  const setVideoInputs = useSetAtom(videoInputsAtom);
  const setAudioOutputs = useSetAtom(audioOutputsAtom);
  const [loading, setLoading] = useState(true);

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput').map(mapDevice));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput').map(mapDevice));
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput').map(mapDevice));
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    } finally {
      setLoading(false);
    }
  }, [setAudioInputs, setVideoInputs, setAudioOutputs]);

  useEffect(() => {
    enumerate();

    navigator.mediaDevices?.addEventListener('devicechange', enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
    };
  }, [enumerate]);

  return { enumerate, loading };
}
