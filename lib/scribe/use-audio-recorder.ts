'use client';

/**
 * Browser audio recorder hook.
 *
 * Uses MediaRecorder API. Streams chunks; on stop, assembles a single Blob.
 * Tracks live duration. Falls back gracefully if browser doesn't support webm/opus.
 */

import { useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface UseAudioRecorderResult {
  state: RecorderState;
  durationSeconds: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationSeconds, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pauseStartedRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }

  async function start() {
    setError(null);
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      if (!mimeType) throw new Error('Browser does not support audio recording');

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setState('stopped');
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorder.onerror = (e: any) => {
        setError(e.error?.message ?? 'Recording error');
        setState('error');
      };

      recorder.start(1000); // 1-second chunks
      startTimeRef.current = Date.now();
      pausedAccumRef.current = 0;
      setDuration(0);
      setState('recording');

      intervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          const elapsed = (Date.now() - startTimeRef.current - pausedAccumRef.current) / 1000;
          setDuration(elapsed);
        }
      }, 250);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg.includes('denied') ? 'Microphone permission denied' : msg);
      setState('error');
    }
  }

  function pause() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      pauseStartedRef.current = Date.now();
      setState('paused');
    }
  }

  function resume() {
    if (mediaRecorderRef.current?.state === 'paused') {
      pausedAccumRef.current += Date.now() - pauseStartedRef.current;
      mediaRecorderRef.current.resume();
      setState('recording');
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function reset() {
    cleanup();
    chunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setState('idle');
  }

  return { state, durationSeconds, audioBlob, audioUrl, error, start, pause, resume, stop, reset };
}
