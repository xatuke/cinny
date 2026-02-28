import React from 'react';
import { useIncomingCalls } from '../../hooks/useActiveCall';
import { IncomingCallToast } from './IncomingCallToast';

export function IncomingCallRenderer() {
  const incomingCalls = useIncomingCalls();

  if (incomingCalls.length === 0) return null;

  return (
    <>
      {incomingCalls.map((call) => (
        <IncomingCallToast key={call.callId} call={call} />
      ))}
    </>
  );
}
