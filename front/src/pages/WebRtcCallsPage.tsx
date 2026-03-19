import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type DashboardLayoutProps = {
  title: string;
  subtitle?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  layoutVariant?: 'default' | 'panel';
  monitorView?: boolean;
};

type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role?: string | null;
  permissions?: string[] | null;
  token?: string | null;
};

type Usuario = {
  id: number;
  name: string | null;
  email: string | null;
};

type NativeCallSession = {
  id: number;
  status: string;
  provider: string;
  channel?: string | null;
  initiatorUserId: number | null;
  targetUserId: number | null;
  targetIdentity?: string | null;
  signalVersion: number;
};

type NativeCallSyncPayload = {
  data?: NativeCallSession;
  webrtc?: {
    signalVersion?: number;
    changed?: boolean;
    offer?: { sdp?: string | null; version?: number } | null;
    answer?: { sdp?: string | null; version?: number } | null;
    hangup?: { reason?: string | null; version?: number } | null;
    initiatorCandidates?: Array<{
      candidate?: string | null;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
      version?: number;
    }>;
    targetCandidates?: Array<{
      candidate?: string | null;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
      version?: number;
    }>;
  };
  message?: string;
};

type WhatsAppStartResponse = {
  data?: {
    deeplink?: string;
    normalizedPhone?: string;
  };
  message?: string;
};

type AnuraClickToDialResponse = {
  data?: {
    session?: NativeCallSession;
    called?: string;
    extension?: string;
    customs?: string[];
    mock?: boolean;
  };
  message?: string;
};

const ANURA_EXTENSION_STORAGE_KEY = 'calls.anura.extension';

export const WebRtcCallsPage: React.FC<{
  DashboardLayout: React.ComponentType<DashboardLayoutProps>;
  resolveApiBaseUrl: () => string;
  useStoredAuthUser: () => AuthUser | null;
  parseJsonSafe: (response: Response) => Promise<unknown>;
}> = ({ DashboardLayout, resolveApiBaseUrl, useStoredAuthUser, parseJsonSafe }) => {
  const authUser = useStoredAuthUser();
  const navigate = useNavigate();
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), [resolveApiBaseUrl]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');
  const [manualTargetIdentity, setManualTargetIdentity] = useState('');
  const [usersCatalog, setUsersCatalog] = useState<Usuario[]>([]);
  const [usersCatalogLoading, setUsersCatalogLoading] = useState(false);
  const [incomingSessions, setIncomingSessions] = useState<NativeCallSession[]>([]);
  const [activeSession, setActiveSession] = useState<NativeCallSession | null>(null);
  const [activeRole, setActiveRole] = useState<'initiator' | 'target' | null>(null);
  const [statusMessage, setStatusMessage] = useState('Sin llamada activa.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [anuraCalled, setAnuraCalled] = useState('');
  const [anuraExtension, setAnuraExtension] = useState('');
  const [anuraStatus, setAnuraStatus] = useState<string | null>(null);
  const [anuraErrorMessage, setAnuraErrorMessage] = useState<string | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState(
    'Hola, te contacto desde la app. ¿Podés atender una llamada por WhatsApp?'
  );
  const [whatsAppStatus, setWhatsAppStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioMimeType, setRecordedAudioMimeType] = useState('audio/webm');
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([{ urls: ['stun:stun.l.google.com:19302'] }]);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const signalVersionRef = useRef(0);
  const activeSessionIdRef = useRef<number | null>(null);
  const activeRoleRef = useRef<'initiator' | 'target' | null>(null);
  const appliedCandidateVersionsRef = useRef<Set<number>>(new Set());
  const ringAudioContextRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const ringModeRef = useRef<'incoming' | 'outgoing' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordedAudioUrlRef = useRef<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    []
  );

  const apiJson = useCallback(
    async (path: string, init?: RequestInit): Promise<NativeCallSyncPayload> => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        credentials: 'include',
        ...init,
        headers: {
          ...authHeaders,
          ...(init?.headers ?? {}),
        },
      });

      const payload = (await parseJsonSafe(response)) as NativeCallSyncPayload;
      if (!response.ok) {
        throw new Error(payload?.message ?? `Error ${response.status}`);
      }

      return payload;
    },
    [apiBaseUrl, authHeaders, parseJsonSafe]
  );

  const ensureRingAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!ringAudioContextRef.current) {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return null;
        }
        ringAudioContextRef.current = new AudioContextConstructor();
      }

      const context = ringAudioContextRef.current;
      if (!context) {
        return null;
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      return context;
    } catch {
      return null;
    }
  }, []);

  const stopRingTone = useCallback(() => {
    if (ringTimerRef.current != null) {
      window.clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    ringModeRef.current = null;
  }, []);

  const scheduleRingPulse = useCallback(
    async (frequency: number, startOffset: number, duration = 0.14, gainValue = 0.09) => {
      const context = await ensureRingAudioContext();
      if (!context) {
        return;
      }

      const start = context.currentTime + startOffset;
      const end = start + duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    },
    [ensureRingAudioContext]
  );

  const startRingTone = useCallback(
    (mode: 'incoming' | 'outgoing') => {
      if (ringModeRef.current === mode && ringTimerRef.current != null) {
        return;
      }
      stopRingTone();
      ringModeRef.current = mode;

      const pattern =
        mode === 'incoming'
          ? { pulses: [440, 440], gap: 0.14, pause: 1.2 }
          : { pulses: [523.25, 659.25], gap: 0.16, pause: 1.6 };

      const playCycle = async () => {
        await scheduleRingPulse(pattern.pulses[0], 0);
        await scheduleRingPulse(pattern.pulses[1], pattern.gap);
      };

      void playCycle();
      ringTimerRef.current = window.setInterval(() => {
        void playCycle();
      }, Math.round((pattern.pause + pattern.gap) * 1000));
    },
    [scheduleRingPulse, stopRingTone]
  );

  const stopSyncLoop = useCallback(() => {
    if (syncTimerRef.current != null) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.close();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const cleanupLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
  }, []);

  const resetActiveCallState = useCallback(() => {
    stopSyncLoop();
    cleanupPeerConnection();
    setActiveSession(null);
    setActiveRole(null);
    setStatusMessage('Sin llamada activa.');
    activeSessionIdRef.current = null;
    activeRoleRef.current = null;
    signalVersionRef.current = 0;
    appliedCandidateVersionsRef.current = new Set();
  }, [cleanupPeerConnection, stopSyncLoop]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ANURA_EXTENSION_STORAGE_KEY) ?? '';
      if (raw.trim()) {
        setAnuraExtension(raw.trim());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (anuraExtension.trim()) {
        window.localStorage.setItem(ANURA_EXTENSION_STORAGE_KEY, anuraExtension.trim());
      }
    } catch {
      // ignore
    }
  }, [anuraExtension]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchIceServers = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/calls/ice-servers`, {
          method: 'GET',
          signal: controller.signal,
          credentials: 'include',
        });
        if (!response.ok) {
          return;
        }

        const payload = (await parseJsonSafe(response)) as { data?: RTCIceServer[] };
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setIceServers(payload.data);
        }
      } catch {
        // ignore
      }
    };

    void fetchIceServers();
    return () => {
      cancelled = true;
      controller.abort();
      void cancelled;
    };
  }, [apiBaseUrl, parseJsonSafe]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchUsersCatalog = async () => {
      if (!authUser?.id) {
        return;
      }
      try {
        setUsersCatalogLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/users`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const payload = (await parseJsonSafe(response)) as { data?: Usuario[] };
        const users = Array.isArray(payload?.data) ? (payload.data ?? []) : [];
        if (!cancelled) {
          setUsersCatalog(users);
        }
      } catch {
        // ignore fetch errors; manual identity remains available
      } finally {
        if (!cancelled) {
          setUsersCatalogLoading(false);
        }
      }
    };

    void fetchUsersCatalog();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBaseUrl, authUser?.id, parseJsonSafe]);

  const ensureLocalMedia = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no soporta captura de audio WebRTC.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true;
    }

    return stream;
  }, []);

  const postCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        return;
      }

      await apiJson(`/api/calls/sessions/${sessionId}/webrtc/candidate`, {
        method: 'POST',
        body: JSON.stringify({
          role: activeRoleRef.current,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          usernameFragment: candidate.usernameFragment ?? null,
        }),
      });
    },
    [apiJson]
  );

  const ensurePeerConnection = useCallback(async (): Promise<RTCPeerConnection> => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const pc = new RTCPeerConnection({ iceServers });
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }

    const localStream = await ensureLocalMedia();
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => remoteStream.addTrack(track));
      });

      if (remoteAudioRef.current) {
        void remoteAudioRef.current.play().catch(() => {
          // autoplay can be blocked until user interaction
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void postCandidate(event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        stopRingTone();
        setStatusMessage('Llamada conectada.');
      } else if (state === 'disconnected' || state === 'failed') {
        setStatusMessage('Conexión interrumpida.');
      }
    };

    peerRef.current = pc;
    return pc;
  }, [ensureLocalMedia, iceServers, postCandidate, stopRingTone]);

  const applyRemoteCandidates = useCallback(
    async (
      pc: RTCPeerConnection,
      candidates: Array<{
        candidate?: string | null;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
        version?: number;
      }>
    ) => {
      for (const item of candidates) {
        const version = Number(item?.version ?? 0);
        if (!version || appliedCandidateVersionsRef.current.has(version)) {
          continue;
        }

        if (!item?.candidate) {
          continue;
        }

        try {
          await pc.addIceCandidate({
            candidate: item.candidate,
            sdpMid: item.sdpMid ?? undefined,
            sdpMLineIndex: item.sdpMLineIndex ?? undefined,
          });
          appliedCandidateVersionsRef.current.add(version);
        } catch (error) {
          console.warn('addIceCandidate failed', error);
        }
      }
    },
    []
  );

  const processSyncPayload = useCallback(
    async (payload: NativeCallSyncPayload) => {
      const sessionData = payload.data;
      if (sessionData) {
        setActiveSession(sessionData);
      }

      const webrtc = payload.webrtc;
      if (!webrtc) {
        return;
      }

      signalVersionRef.current = Number(webrtc.signalVersion ?? signalVersionRef.current);
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        return;
      }

      const role = activeRoleRef.current;
      const pc = await ensurePeerConnection();

      if (webrtc.hangup) {
        stopRingTone();
        setStatusMessage('La otra parte finalizó la llamada.');
        resetActiveCallState();
        return;
      }

      if (role === 'target' && webrtc.offer?.sdp && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription({
          type: 'offer',
          sdp: webrtc.offer.sdp,
        });

        if (!pc.currentLocalDescription || pc.currentLocalDescription.type !== 'answer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await apiJson(`/api/calls/sessions/${sessionId}/webrtc/answer`, {
            method: 'POST',
            body: JSON.stringify({ sdp: answer.sdp }),
          });
        }
      }

      if (role === 'initiator' && webrtc.answer?.sdp && !pc.currentRemoteDescription) {
        stopRingTone();
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: webrtc.answer.sdp,
        });
      }

      if (role === 'initiator') {
        await applyRemoteCandidates(pc, webrtc.targetCandidates ?? []);
      } else if (role === 'target') {
        await applyRemoteCandidates(pc, webrtc.initiatorCandidates ?? []);
      }
    },
    [apiJson, applyRemoteCandidates, ensurePeerConnection, resetActiveCallState, stopRingTone]
  );

  const syncCall = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    try {
      const payload = await apiJson(
        `/api/calls/sessions/${sessionId}/webrtc/sync?since=${signalVersionRef.current}`,
        {
          method: 'GET',
        }
      );
      await processSyncPayload(payload);
    } catch (error) {
      setErrorMessage((error as Error).message ?? 'No se pudo sincronizar la llamada.');
    }
  }, [apiJson, processSyncPayload]);

  const startSyncLoop = useCallback(() => {
    stopSyncLoop();
    syncTimerRef.current = window.setInterval(() => {
      void syncCall();
    }, 1500);
  }, [stopSyncLoop, syncCall]);

  const fetchIncomingSessions = useCallback(async () => {
    if (!authUser?.id || activeSessionIdRef.current) {
      return;
    }

    try {
      const payload = await apiJson('/api/calls/sessions?status=ringing&limit=20', { method: 'GET' });
      const sessions = Array.isArray((payload as { data?: NativeCallSession[] })?.data)
        ? ((payload as { data?: NativeCallSession[] }).data ?? [])
        : [];
      const currentIdentity = `user-${authUser.id}`;

      setIncomingSessions(
        sessions.filter(
          (item) =>
            item.channel === 'webrtc' && (item.targetUserId === authUser.id || item.targetIdentity === currentIdentity)
        )
      );
    } catch (error) {
      console.error('fetchIncomingSessions failed', error);
    }
  }, [apiJson, authUser?.id]);

  useEffect(() => {
    void fetchIncomingSessions();
    const timer = window.setInterval(() => {
      void fetchIncomingSessions();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [fetchIncomingSessions]);

  useEffect(() => {
    const shouldPlayIncomingTone = !activeSession && !isBusy && incomingSessions.length > 0 && ringModeRef.current !== 'outgoing';

    if (shouldPlayIncomingTone) {
      startRingTone('incoming');
      return;
    }

    if (ringModeRef.current === 'incoming') {
      stopRingTone();
    }
  }, [activeSession, incomingSessions.length, isBusy, startRingTone, stopRingTone]);

  const handleStartCall = async () => {
    setErrorMessage(null);

    const targetUserId = selectedTargetUserId ? Number(selectedTargetUserId) : null;
    const normalizedTargetIdentity = manualTargetIdentity.trim();

    if (!targetUserId && normalizedTargetIdentity.length === 0) {
      setErrorMessage('Seleccioná un usuario destino o ingresá una identidad manual.');
      return;
    }

    if (targetUserId && (!Number.isFinite(targetUserId) || targetUserId <= 0)) {
      setErrorMessage('Seleccioná un usuario válido.');
      return;
    }

    if (targetUserId && authUser?.id && targetUserId === authUser.id) {
      setErrorMessage('No podés llamarte a vos mismo.');
      return;
    }

    try {
      setIsBusy(true);
      setStatusMessage('Creando llamada...');

      const createPayload = (await apiJson('/api/calls/sessions', {
        method: 'POST',
        body: JSON.stringify({
          target_user_id: targetUserId ?? undefined,
          target_identity: targetUserId ? undefined : normalizedTargetIdentity,
          channel: 'webrtc',
          metadata: {
            source: 'web-frontend',
          },
        }),
      })) as { data?: NativeCallSession };

      const session = createPayload.data;
      if (!session) {
        throw new Error('No se pudo crear la sesión.');
      }

      setActiveSession(session);
      activeSessionIdRef.current = session.id;
      setActiveRole('initiator');
      activeRoleRef.current = 'initiator';
      signalVersionRef.current = Number(session.signalVersion ?? 0);
      appliedCandidateVersionsRef.current = new Set();

      const pc = await ensurePeerConnection();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      await apiJson(`/api/calls/sessions/${session.id}/webrtc/offer`, {
        method: 'POST',
        body: JSON.stringify({ sdp: offer.sdp }),
      });

      startRingTone('outgoing');
      setStatusMessage('Llamando... esperando respuesta.');
      setIncomingSessions([]);
      startSyncLoop();
    } catch (error) {
      stopRingTone();
      setErrorMessage((error as Error).message ?? 'No se pudo iniciar la llamada.');
      resetActiveCallState();
    } finally {
      setIsBusy(false);
    }
  };

  const handleAcceptCall = async (sessionId: number) => {
    setErrorMessage(null);
    try {
      setIsBusy(true);
      stopRingTone();
      setStatusMessage('Conectando llamada entrante...');

      const detailPayload = (await apiJson(`/api/calls/sessions/${sessionId}`, {
        method: 'GET',
      })) as { data?: NativeCallSession };

      if (!detailPayload.data) {
        throw new Error('La sesión no está disponible.');
      }

      setActiveSession(detailPayload.data);
      activeSessionIdRef.current = detailPayload.data.id;
      setActiveRole('target');
      activeRoleRef.current = 'target';
      signalVersionRef.current = Number(detailPayload.data.signalVersion ?? 0);
      appliedCandidateVersionsRef.current = new Set();

      await ensurePeerConnection();
      await syncCall();
      startSyncLoop();
      setStatusMessage('Llamada aceptada.');
      setIncomingSessions((prev) => prev.filter((item) => item.id !== sessionId));
    } catch (error) {
      setErrorMessage((error as Error).message ?? 'No se pudo aceptar la llamada.');
      resetActiveCallState();
    } finally {
      setIsBusy(false);
    }
  };

  const handleHangup = async () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    try {
      setIsBusy(true);
      stopRingTone();
      await apiJson(`/api/calls/sessions/${sessionId}/hangup`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'manual_hangup' }),
      });
    } catch (error) {
      setErrorMessage((error as Error).message ?? 'No se pudo cortar la llamada.');
    } finally {
      resetActiveCallState();
      setIsBusy(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) {
      return;
    }
    try {
      setErrorMessage(null);
      setRecordedAudioUrl(null);
      setRecordedAudioMimeType('audio/webm');
      recordingChunksRef.current = [];

      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error('Este navegador no soporta grabación.');
      }
      recordingAudioContextRef.current = new AudioContextConstructor();

      const stream = await ensureLocalMedia();
      const destination = recordingAudioContextRef.current.createMediaStreamDestination();
      const source = recordingAudioContextRef.current.createMediaStreamSource(stream);
      source.connect(destination);
      recordingStreamRef.current = destination.stream;

      const recorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        recordedAudioUrlRef.current = url;
        setRecordedAudioUrl(url);
        setRecordedAudioMimeType(blob.type || recorder.mimeType || 'audio/webm');
      };
      recorder.start(800);
      setIsRecording(true);
    } catch (error) {
      setErrorMessage((error as Error).message ?? 'No se pudo iniciar la grabación.');
    }
  };

  const handleStopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    recordingStreamRef.current = null;
    try {
      recordingAudioContextRef.current?.close();
    } catch {
      // ignore
    }
    recordingAudioContextRef.current = null;
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      stopSyncLoop();
      stopRingTone();
      cleanupPeerConnection();
      cleanupLocalMedia();
      if (recordedAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(recordedAudioUrlRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupLocalMedia, cleanupPeerConnection, stopRingTone, stopSyncLoop]);

  const handleStartWhatsApp = async () => {
    setWhatsAppStatus(null);
    setErrorMessage(null);

    if (!whatsAppPhone.trim()) {
      setErrorMessage('Ingresá un número de WhatsApp.');
      return;
    }

    try {
      setIsBusy(true);
      const payload = (await apiJson('/api/calls/whatsapp/start', {
        method: 'POST',
        body: JSON.stringify({
          phone: whatsAppPhone.trim(),
          message: whatsAppMessage.trim(),
        }),
      })) as WhatsAppStartResponse;

      const deeplink = payload?.data?.deeplink ?? '';
      if (!deeplink) {
        throw new Error('No se pudo generar el link de WhatsApp.');
      }

      window.open(deeplink, '_blank', 'noopener,noreferrer');
      setWhatsAppStatus(`WhatsApp listo para enviar a ${payload?.data?.normalizedPhone ?? whatsAppPhone.trim()}.`);
    } catch (error) {
      setErrorMessage((error as Error).message ?? 'No se pudo abrir WhatsApp.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartAnuraCall = async () => {
    setAnuraStatus(null);
    setAnuraErrorMessage(null);

    if (anuraCalled.trim().length === 0) {
      setAnuraErrorMessage('Ingresá el número de destino.');
      return;
    }

    if (anuraExtension.trim().length === 0) {
      setAnuraErrorMessage('Ingresá tu extensión o interno.');
      return;
    }

    try {
      setIsBusy(true);
      const payload = (await apiJson('/api/calls/anura/click2dial', {
        method: 'POST',
        body: JSON.stringify({
          called: anuraCalled.trim(),
          extension: anuraExtension.trim(),
        }),
      })) as AnuraClickToDialResponse;

      const called = payload?.data?.called ?? anuraCalled.trim();
      const extension = payload?.data?.extension ?? anuraExtension.trim();
      const isMock = Boolean(payload?.data?.mock);
      setAnuraStatus(
        isMock
          ? `Simulación Anura lista: extensión ${extension}, destino ${called}.`
          : `Click2Dial enviado a Anura: suena la extensión ${extension} y luego marca ${called}.`
      );
    } catch (error) {
      setAnuraErrorMessage((error as Error).message ?? 'No se pudo iniciar la llamada por Anura.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DashboardLayout
      title="Llamadas WebRTC"
      subtitle="WebRTC nativo, WhatsApp y central telefónica"
      headerContent={
        <div className="card-header card-header--compact">
          <button type="button" className="secondary-action" onClick={() => navigate('/dashboard')}>
            ← Volver al panel
          </button>
        </div>
      }
    >
      <div className="webrtc-page">
        <section className="webrtc-card">
          <h3>Iniciar llamada</h3>
          <div className="webrtc-row">
            <label className="input-control">
              <span>Usuario destino</span>
              <select
                value={selectedTargetUserId}
                onChange={(event) => setSelectedTargetUserId(event.target.value)}
                disabled={isBusy || !!activeSession}
              >
                <option value="">Seleccionar usuario</option>
                {usersCatalog.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    #{user.id} - {user.name ?? 'Sin nombre'} ({user.email ?? 'sin email'})
                  </option>
                ))}
              </select>
            </label>
            <label className="input-control">
              <span>Identidad manual (opcional)</span>
              <input
                type="text"
                value={manualTargetIdentity}
                onChange={(event) => setManualTargetIdentity(event.target.value)}
                placeholder="Ej: user-24"
                disabled={isBusy || !!activeSession || Boolean(selectedTargetUserId)}
              />
            </label>
            <button
              type="button"
              className="primary-action"
              onClick={handleStartCall}
              disabled={isBusy || !!activeSession}
            >
              Llamar
            </button>
          </div>
          <p className="webrtc-status">
            {usersCatalogLoading
              ? 'Cargando usuarios...'
              : usersCatalog.length > 0
                ? `Usuarios disponibles: ${usersCatalog.length}`
                : 'No se pudo cargar catálogo de usuarios. Podés usar identidad manual.'}
          </p>
        </section>

        <section className="webrtc-card">
          <h3>Entrantes</h3>
          {incomingSessions.length === 0 ? <p>No hay llamadas entrantes.</p> : null}
          {incomingSessions.map((session) => (
            <div key={session.id} className="webrtc-incoming-item">
              <div>
                <strong>Sesión #{session.id}</strong>
                <small>Desde usuario {session.initiatorUserId ?? 'N/A'}</small>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => handleAcceptCall(session.id)}
                disabled={isBusy}
              >
                Atender
              </button>
            </div>
          ))}
        </section>

        <section className="webrtc-card">
          <h3>Estado</h3>
          <p className="webrtc-status">{statusMessage}</p>
          {activeSession ? (
            <p className="webrtc-status">
              Sesión #{activeSession.id} · rol {activeRole ?? '—'} · señal v{signalVersionRef.current}
            </p>
          ) : null}
          <div className="webrtc-row">
            <button type="button" className="secondary-action" onClick={() => void syncCall()} disabled={!activeSession || isBusy}>
              Sincronizar
            </button>
            <button type="button" className="secondary-action" onClick={handleHangup} disabled={!activeSession || isBusy}>
              Cortar
            </button>
            <button type="button" className="secondary-action" onClick={handleStartRecording} disabled={!activeSession || isBusy || isRecording}>
              Grabar
            </button>
            <button type="button" className="secondary-action" onClick={handleStopRecording} disabled={!isRecording}>
              Detener grabación
            </button>
          </div>
          {recordedAudioUrl ? (
            <div style={{ marginTop: '0.6rem' }}>
              <audio controls src={recordedAudioUrl} />
              <p className="form-info" style={{ marginTop: '0.35rem' }}>
                Formato: {recordedAudioMimeType}
              </p>
            </div>
          ) : null}
        </section>

        {errorMessage ? <p className="form-info form-info--error">{errorMessage}</p> : null}

        <section className="webrtc-card">
          <h3>Central telefónica (Anura)</h3>
          <div className="webrtc-row">
            <label className="input-control">
              <span>Número destino</span>
              <input
                type="text"
                value={anuraCalled}
                onChange={(event) => setAnuraCalled(event.target.value)}
                placeholder="Ej: 01144445555"
                disabled={isBusy}
              />
            </label>
            <label className="input-control">
              <span>Extensión / interno</span>
              <input
                type="text"
                value={anuraExtension}
                onChange={(event) => setAnuraExtension(event.target.value)}
                placeholder="Ej: 101"
                disabled={isBusy}
              />
            </label>
            <button type="button" className="secondary-action" onClick={handleStartAnuraCall} disabled={isBusy}>
              Click2Dial
            </button>
          </div>
          {anuraStatus ? <p className="form-info form-info--success">{anuraStatus}</p> : null}
          {anuraErrorMessage ? <p className="form-info form-info--error">{anuraErrorMessage}</p> : null}
        </section>

        <section className="webrtc-card">
          <h3>WhatsApp</h3>
          <div className="webrtc-row">
            <label className="input-control">
              <span>Celular (E.164)</span>
              <input
                type="text"
                value={whatsAppPhone}
                onChange={(event) => setWhatsAppPhone(event.target.value)}
                placeholder="Ej: +5491155551234"
                disabled={isBusy}
              />
            </label>
          </div>
          <label className="input-control">
            <span>Mensaje inicial</span>
            <textarea
              rows={2}
              value={whatsAppMessage}
              onChange={(event) => setWhatsAppMessage(event.target.value)}
              disabled={isBusy}
            />
          </label>
          <div className="webrtc-row">
            <button type="button" className="secondary-action" onClick={handleStartWhatsApp} disabled={isBusy}>
              Abrir WhatsApp
            </button>
          </div>
          {whatsAppStatus ? <p className="form-info form-info--success">{whatsAppStatus}</p> : null}
        </section>

        <audio ref={localAudioRef} autoPlay playsInline muted />
        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>
    </DashboardLayout>
  );
};

