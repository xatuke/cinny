import { atom } from 'jotai';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export const audioInputsAtom = atom<MediaDeviceInfo[]>([]);
export const videoInputsAtom = atom<MediaDeviceInfo[]>([]);
export const audioOutputsAtom = atom<MediaDeviceInfo[]>([]);

export const selectedAudioInputAtom = atom<string | undefined>(undefined);
export const selectedVideoInputAtom = atom<string | undefined>(undefined);
export const selectedAudioOutputAtom = atom<string | undefined>(undefined);
