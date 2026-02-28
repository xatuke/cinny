import { useAtomValue } from 'jotai';
import {
  activeCallAtom,
  incomingCallsAtom,
} from '../state/call/callState';

export function useActiveCall() {
  return useAtomValue(activeCallAtom);
}

export function useIncomingCalls() {
  return useAtomValue(incomingCallsAtom);
}
