import { MatrixClient } from 'matrix-js-sdk';
import {
  MatrixCall,
  CallEvent,
  CallState as SDKCallState,
  CallType as SDKCallType,
  CallErrorCode,
} from 'matrix-js-sdk/lib/webrtc/call';
import type { CallEventHandlerMap } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import type { TypedEventEmitter } from 'matrix-js-sdk/lib/models/typed-event-emitter';
import { Setter } from 'jotai';

// Helper type to work around TypedEventEmitter not resolving on MatrixCall
type CallEmitter = TypedEventEmitter<CallEvent, CallEventHandlerMap>;
import {
  ActiveCall,
  CallType,
  CallState,
  IncomingCall,
  activeCallAtom,
  incomingCallsAtom,
} from '../state/call/callState';

type ElementCallWidget = {
  roomId: string;
  type: CallType;
  widgetUrl: string;
};

export class CallHandler {
  private client: MatrixClient;
  private setAtom: Setter;

  private currentCall: MatrixCall | null = null;
  private currentGroupWidget: ElementCallWidget | null = null;
  private groupHangupFn: (() => void) | null = null;

  private ringAudio: HTMLAudioElement | null = null;
  private ringbackAudio: HTMLAudioElement | null = null;
  private callendAudio: HTMLAudioElement | null = null;
  private busyAudio: HTMLAudioElement | null = null;

  constructor(client: MatrixClient, setAtom: Setter) {
    this.client = client;
    this.setAtom = setAtom;
  }

  start(): void {
    this.client.on(CallEventHandlerEvent.Incoming, this.onIncomingCall);
    // Start MatrixRTC session manager so we can detect active calls in rooms
    try {
      this.client.matrixRTC?.start();
    } catch {
      // matrixRTC may not be available
    }
    this.initAudio();
  }

  stop(): void {
    this.client.removeListener(CallEventHandlerEvent.Incoming, this.onIncomingCall);
    try {
      this.client.matrixRTC?.stop();
    } catch {
      // matrixRTC may not be available
    }
    if (this.currentCall) {
      this.currentCall.hangup(CallErrorCode.UserHangup, false);
      this.currentCall = null;
    }

  }

  private initAudio(): void {
    try {
      this.ringAudio = new Audio('/sound/ring.ogg');
      this.ringAudio.loop = true;
      this.ringbackAudio = new Audio('/sound/ringback.ogg');
      this.ringbackAudio.loop = true;
      this.callendAudio = new Audio('/sound/callend.ogg');
      this.busyAudio = new Audio('/sound/busy.ogg');
    } catch {
      // Audio files may not exist yet
    }
  }

  private playAudio(audio: HTMLAudioElement | null): void {
    audio?.play().catch(() => {});
  }

  private stopAudio(audio: HTMLAudioElement | null): void {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  private stopAllAudio(): void {
    this.stopAudio(this.ringAudio);
    this.stopAudio(this.ringbackAudio);
    this.stopAudio(this.busyAudio);
  }

  // ---- 1:1 Call Actions ----

  async placeCall(roomId: string, type: CallType): Promise<void> {
    if (this.currentCall || this.currentGroupWidget) return;

    const call = this.client.createCall(roomId);
    if (!call) {
      console.error('Failed to create call. WebRTC may not be supported.');
      return;
    }

    this.setupCallListeners(call);
    this.currentCall = call;

    const sdkType = type === 'video' ? SDKCallType.Video : SDKCallType.Voice;

    this.setAtom(activeCallAtom, {
      callId: call.callId,
      roomId,
      type,
      direction: 'outbound',
      state: 'connecting',
      isGroupCall: false,
      startTime: null,
      micMuted: false,
      videoMuted: type === 'voice',
      deafened: false,
      isScreensharing: false,
    });

    try {
      if (sdkType === SDKCallType.Voice) {
        await call.placeVoiceCall();
      } else {
        await call.placeVideoCall();
      }
      this.playAudio(this.ringbackAudio);
    } catch (err) {
      console.error('Failed to place call:', err);
      this.cleanupCall();
    }
  }

  answerCall(callId: string): void {
    // Find the call in incoming list
    const incoming = this.findIncomingCall(callId);
    if (!incoming || this.currentCall) return;

    this.stopAudio(this.ringAudio);

    // The MatrixCall should already exist on the client
    const call = this.client.callEventHandler?.calls.get(callId);
    if (!call) return;

    this.setupCallListeners(call);
    this.currentCall = call;

    // Remove from incoming list
    this.setAtom(incomingCallsAtom, (prev: IncomingCall[]) =>
      prev.filter((c) => c.callId !== callId)
    );

    this.setAtom(activeCallAtom, {
      callId: call.callId,
      roomId: call.roomId,
      type: call.type === SDKCallType.Video ? 'video' : 'voice',
      direction: 'inbound',
      state: 'connecting',
      isGroupCall: false,
      startTime: null,
      micMuted: false,
      videoMuted: call.type === SDKCallType.Voice,
      deafened: false,
      isScreensharing: false,
    });

    call.answer();
  }

  rejectCall(callId: string): void {
    this.stopAudio(this.ringAudio);
    const call = this.client.callEventHandler?.calls.get(callId);
    if (call) {
      call.reject();
    }
    this.setAtom(incomingCallsAtom, (prev: IncomingCall[]) =>
      prev.filter((c) => c.callId !== callId)
    );
  }

  hangup(): void {
    this.stopAllAudio();
    if (this.currentCall) {
      this.currentCall.hangup(CallErrorCode.UserHangup, false);
      this.cleanupCall();
      this.playAudio(this.callendAudio);
    } else if (this.currentGroupWidget && this.groupHangupFn) {
      // Delegate to PersistentCallContainer's hangUp which properly
      // stops widget messaging (making Element Call leave the MatrixRTC session),
      // resets the iframe, and calls onGroupCallEnded().
      this.groupHangupFn();
    } else if (this.currentGroupWidget) {
      // Fallback if no handler registered
      this.currentGroupWidget = null;
      this.cleanupCall();
      this.playAudio(this.callendAudio);
    }
  }

  async toggleMic(): Promise<void> {
    if (this.currentCall) {
      // 1:1 call: directly control the MatrixCall
      const muted = this.currentCall.isMicrophoneMuted();
      await this.currentCall.setMicrophoneMuted(!muted);
      this.updateActiveCallAtom({ micMuted: !muted });
    } else if (this.currentGroupWidget) {
      // Group call: toggle atom, PersistentCallContainer syncs to Element Call
      this.setAtom(activeCallAtom, (prev: ActiveCall | null) => {
        if (!prev) return prev;
        return { ...prev, micMuted: !prev.micMuted };
      });
    }
  }

  async toggleVideo(): Promise<void> {
    if (this.currentCall) {
      // 1:1 call: directly control the MatrixCall
      const muted = this.currentCall.isLocalVideoMuted();
      await this.currentCall.setLocalVideoMuted(!muted);
      this.updateActiveCallAtom({ videoMuted: !muted });
    } else if (this.currentGroupWidget) {
      // Group call: toggle atom, PersistentCallContainer syncs to Element Call
      this.setAtom(activeCallAtom, (prev: ActiveCall | null) => {
        if (!prev) return prev;
        return { ...prev, videoMuted: !prev.videoMuted };
      });
    }
  }

  async toggleScreenshare(): Promise<void> {
    if (!this.currentCall) return;
    const sharing = this.currentCall.isScreensharing();
    await this.currentCall.setScreensharingEnabled(!sharing);
    this.updateActiveCallAtom({ isScreensharing: !sharing });
  }

  toggleDeafen(): void {
    this.setAtom(activeCallAtom, (prev: ActiveCall | null) => {
      if (!prev) return prev;
      return { ...prev, deafened: !prev.deafened };
    });
  }

  // ---- Group Call Actions ----

  registerGroupHangup(fn: (() => void) | null): void {
    this.groupHangupFn = fn;
  }

  startGroupCall(roomId: string, type: CallType, widgetUrl: string): void {
    if (this.currentCall || this.currentGroupWidget) return;

    this.currentGroupWidget = { roomId, type, widgetUrl };

    this.setAtom(activeCallAtom, {
      callId: `group-${roomId}-${Date.now()}`,
      roomId,
      type,
      direction: 'outbound',
      state: 'connecting',
      isGroupCall: true,
      startTime: null,
      micMuted: false,
      videoMuted: type === 'voice',
      deafened: false,
      isScreensharing: false,
    });
  }

  onGroupCallConnected(): void {
    this.updateActiveCallAtom({
      state: 'connected',
      startTime: Date.now(),
    });
  }

  onGroupCallEnded(): void {
    this.currentGroupWidget = null;
    this.cleanupCall();
    this.playAudio(this.callendAudio);
  }

  // ---- Stream Access ----

  getLocalStream(): MediaStream | undefined {
    return this.currentCall?.localUsermediaStream ?? undefined;
  }

  getRemoteStream(): MediaStream | undefined {
    return this.currentCall?.remoteUsermediaStream ?? undefined;
  }

  // ---- Private ----

  private onIncomingCall = (call: MatrixCall): void => {
    // If we already have an active call, reject the incoming call as busy
    if (this.currentCall || this.currentGroupWidget) {
      call.reject();
      return;
    }

    const callerId = call.getOpponentMember()?.userId ?? 'unknown';
    const incoming: IncomingCall = {
      callId: call.callId,
      roomId: call.roomId,
      type: call.type === SDKCallType.Video ? 'video' : 'voice',
      callerId,
      silenced: false,
    };

    this.setAtom(incomingCallsAtom, (prev: IncomingCall[]) => [...prev, incoming]);
    this.playAudio(this.ringAudio);

    // Auto-dismiss if the call ends before being answered
    (call as unknown as CallEmitter).on(CallEvent.Hangup, () => {
      this.stopAudio(this.ringAudio);
      this.setAtom(incomingCallsAtom, (prev: IncomingCall[]) =>
        prev.filter((c) => c.callId !== call.callId)
      );
    });
  };

  private setupCallListeners(call: MatrixCall): void {
    const emitter = call as unknown as CallEmitter;
    emitter.on(CallEvent.State, this.onCallStateChanged);

    emitter.on(CallEvent.Hangup, this.onCallHangup);
    emitter.on(CallEvent.Error, this.onCallError);
  }

  private removeCallListeners(call: MatrixCall): void {
    const emitter = call as unknown as CallEmitter;
    emitter.removeListener(CallEvent.State, this.onCallStateChanged);

    emitter.removeListener(CallEvent.Hangup, this.onCallHangup);
    emitter.removeListener(CallEvent.Error, this.onCallError);
  }

  private onCallStateChanged = (
    state: SDKCallState,
    _oldState: SDKCallState,
    call: MatrixCall
  ): void => {
    const mappedState = this.mapCallState(state);
    this.updateActiveCallAtom({ state: mappedState });

    if (state === SDKCallState.Connected) {
      this.stopAllAudio();
      this.updateActiveCallAtom({ startTime: Date.now() });
    } else if (state === SDKCallState.Ended) {
      this.stopAllAudio();
      this.playAudio(this.callendAudio);
      this.cleanupCall();
    }
  };

  private onCallHangup = (call: MatrixCall): void => {
    this.stopAllAudio();
    this.playAudio(this.callendAudio);
    this.cleanupCall();
  };

  private onCallError = (): void => {
    this.stopAllAudio();
    this.playAudio(this.busyAudio);
    this.cleanupCall();
  };

  private cleanupCall(): void {
    if (this.currentCall) {
      this.removeCallListeners(this.currentCall);
      this.currentCall = null;
    }

    this.setAtom(activeCallAtom, null);
  }

  private mapCallState(sdkState: SDKCallState): CallState {
    switch (sdkState) {
      case SDKCallState.Fledgling:
      case SDKCallState.WaitLocalMedia:
      case SDKCallState.CreateOffer:
      case SDKCallState.CreateAnswer:
        return 'connecting';
      case SDKCallState.InviteSent:
        return 'ringing';
      case SDKCallState.Ringing:
        return 'ringing';
      case SDKCallState.Connecting:
        return 'connecting';
      case SDKCallState.Connected:
        return 'connected';
      case SDKCallState.Ended:
        return 'ended';
      default:
        return 'idle';
    }
  }

  private updateActiveCallAtom(update: Partial<ActiveCall>): void {
    this.setAtom(activeCallAtom, (prev: ActiveCall | null) => {
      if (!prev) return prev;
      return { ...prev, ...update };
    });
  }

  private findIncomingCall(callId: string): IncomingCall | undefined {
    // We can't read atoms directly, but we track the call ID
    return undefined; // The caller verifies via the atom
  }
}
