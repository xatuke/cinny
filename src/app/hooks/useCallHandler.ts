import { createContext, useContext } from 'react';
import { CallHandler } from '../utils/CallHandler';

const CallHandlerContext = createContext<CallHandler | null>(null);

export const CallHandlerProvider = CallHandlerContext.Provider;

export function useCallHandler(): CallHandler {
  const handler = useContext(CallHandlerContext);
  if (!handler) throw new Error('CallHandler not initialized!');
  return handler;
}

export function useCallHandlerOptionally(): CallHandler | null {
  return useContext(CallHandlerContext);
}
