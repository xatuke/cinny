import React from 'react';
import { atom } from 'jotai';

export type CallType = 'voice' | 'video';
export type CallDirection = 'outbound' | 'inbound';

export type CallState =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed';

export interface ActiveCall {
  callId: string;
  roomId: string;
  type: CallType;
  direction: CallDirection;
  state: CallState;
  isGroupCall: boolean;
  startTime: number | null;
  micMuted: boolean;
  videoMuted: boolean;
  deafened: boolean;
  isScreensharing: boolean;
}

export interface IncomingCall {
  callId: string;
  roomId: string;
  type: CallType;
  callerId: string;
  silenced: boolean;
}

export const activeCallAtom = atom<ActiveCall | null>(null);
export const incomingCallsAtom = atom<IncomingCall[]>([]);
export const callIframeRefAtom = atom<React.MutableRefObject<HTMLIFrameElement | null> | null>(null);
export const isGroupCallReadyAtom = atom<boolean>(false);
