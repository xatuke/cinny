import { MatrixClient } from 'matrix-js-sdk';

const DEFAULT_ELEMENT_CALL_URL = 'https://call.element.io';

export type ElementCallIntent =
  | 'start_call'
  | 'join_existing'
  | 'start_call_dm'
  | 'start_call_dm_voice'
  | 'join_existing_dm'
  | 'join_existing_dm_voice';

export interface ElementCallUrlOptions {
  skipLobby?: boolean;
  perParticipantE2EE?: boolean;
  intent?: ElementCallIntent;
  elementCallUrl?: string;
}

export function generateElementCallUrl(
  client: MatrixClient,
  roomId: string,
  options: ElementCallUrlOptions = {}
): string {
  const {
    skipLobby = true,
    perParticipantE2EE = false,
    intent = 'start_call',
    elementCallUrl,
  } = options;

  const baseUrl = elementCallUrl || DEFAULT_ELEMENT_CALL_URL;
  const url = new URL(baseUrl);

  const userId = client.getUserId();
  const deviceId = client.getDeviceId();
  if (!userId || !deviceId) {
    throw new Error('Client must be logged in to generate Element Call URL');
  }

  const params = new URLSearchParams({
    userId,
    deviceId,
    roomId,
    baseUrl: client.baseUrl,
    lang: navigator.language,
  });

  if (perParticipantE2EE) {
    params.set('perParticipantE2EE', 'true');
  }

  if (skipLobby) {
    params.set('skipLobby', 'true');
  }

  // Intent tells Element Call what action to take
  params.set('intent', intent);

  // Element Web always sets preload=false for non-video-room calls
  params.set('preload', 'false');

  // Disable analytics in the widget
  params.set('analyticsID', '');

  // Element Call uses hash-based params
  url.hash = `#?${params.toString()}`;

  return url.toString();
}
