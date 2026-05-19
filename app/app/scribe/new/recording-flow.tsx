'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mic, MicOff, Pause, Play, Square, Upload, Loader2, AlertCircle } from 'lucide-react';
import { useAudioRecorder } from '@/lib/scribe/use-audio-recorder';
import { diabetesTypeLabel, calculateAge } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RecordingFlow({
  patient,
  existingEncounterId,
}: {
  patient: any;
  existingEncounterId?: string;
}) {
  const router = useRouter();
  const recorder = useAudioRecorder();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pre' | 'recording' | 'review' | 'uploading' | 'transcribing' | 'generating' | 'redirecting'>('pre');
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-create session on first start
  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    try {
      const res = await fetch('/api/scribe/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id, encounter_id: existingEncounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create session');
      setSessionId(data.id);
      return data.id;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }

  async function handleStart() {
    setError(null);
    const id = await ensureSession();
    if (!id) return;
    await recorder.start();
    setPhase('recording');
  }

  async function handleStop() {
    recorder.stop();
    setPhase('review');
  }

  async function handleConfirmAndProcess() {
    if (!sessionId || !recorder.audioBlob) return;
    setError(null);

    setPhase('uploading');
    setProgressMessage('Uploading audio…');
    const form = new FormData();
    form.append('audio', recorder.audioBlob, `session-${sessionId}.webm`);

    const uploadRes = await fetch(`/api/scribe/sessions/${sessionId}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      setError(data.error ?? 'Upload failed');
      setPhase('review');
      return;
    }

    setPhase('transcribing');
    setProgressMessage('Transcribing with Whisper… (this can take 30-90 seconds)');
    const txRes = await fetch(`/api/scribe/sessions/${sessionId}/transcribe`, { method: 'POST' });
    if (!txRes.ok) {
      const data = await txRes.json().catch(() => ({}));
      setError(data.error ?? 'Transcription failed');
      setPhase('review');
      return;
    }

    setPhase('generating');
    setProgressMessage('Generating SOAP draft… (15-45 seconds)');
    const genRes = await fetch(`/api/scribe/sessions/${sessionId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_type: 'follow_up' }),
    });
    if (!genRes.ok) {
      const data = await genRes.json().catch(() => ({}));
      setError(data.error ?? 'Draft generation failed');
      setPhase('review');
      return;
    }

    setPhase('redirecting');
    setProgressMessage('Opening draft…');
    router.push(`/app/scribe/sessions/${sessionId}`);
  }

  function handleDiscard() {
    if (!confirm('Discard this recording? Audio will not be saved.')) return;
    recorder.reset();
    setPhase('pre');
    setSessionId(null);
  }

  const recording = phase === 'recording';
  const processing = ['uploading', 'transcribing', 'generating', 'redirecting'].includes(phase);

  return (
    <div className="max-w-2xl space-y-8">
      <Link
        href={`/app/patients/${patient.id}`}
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>

      <header className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">AI Scribe</div>
        <h1 className="font-display text-3xl tracking-tight">
          {patient.last_name}, {patient.first_name}
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <span className="font-mono">MRN {patient.mrn}</span>
          <span>·</span><span>{calculateAge(patient.date_of_birth)} yrs</span>
          <span>·</span><span>{diabetesTypeLabel(patient.diabetes_type)}</span>
        </div>
      </header>

      {phase === 'pre' && (
        <section className="bg-card rounded-2xl border border-border p-8 text-center space-y-6">
          <div className="space-y-2">
            <Mic className="h-12 w-12 mx-auto text-muted-foreground/60" />
            <h2 className="font-display text-2xl">Ready to record</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Click record when you&rsquo;re ready to start the encounter. The audio will be transcribed and turned into a SOAP draft for you to review and sign.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-xs text-left space-y-2">
            <p className="font-medium">Before you start:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Make sure both you and the patient are aware the encounter is being recorded.</li>
              <li>Some states require explicit patient consent. Check your jurisdiction.</li>
              <li>Audio is auto-deleted after the retention period set by your practice (default 30 days).</li>
              <li>The AI generates a draft. You review, edit, and sign — it never auto-signs.</li>
            </ul>
          </div>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-full bg-primary text-primary-foreground font-medium hover:bg-accent transition-colors"
          >
            <Mic className="h-5 w-5" /> Start recording
          </button>
        </section>
      )}

      {recording && (
        <section className="bg-card rounded-2xl border border-border p-8 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
              <div className="relative w-4 h-4 rounded-full bg-red-500" />
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-red-700 dark:text-red-300">
              {recorder.state === 'paused' ? 'Paused' : 'Recording'}
            </span>
          </div>
          <div className="font-mono text-5xl tabular-nums">{formatDuration(recorder.durationSeconds)}</div>
          <div className="flex items-center justify-center gap-3">
            {recorder.state === 'recording' ? (
              <button
                onClick={recorder.pause}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
            ) : (
              <button
                onClick={recorder.resume}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
              >
                <Play className="h-4 w-4" /> Resume
              </button>
            )}
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          </div>
        </section>
      )}

      {phase === 'review' && (
        <section className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <h2 className="font-display text-xl">Review recording</h2>
          <p className="text-sm text-muted-foreground">
            Listen back if you want. Then click <strong className="text-foreground">Process</strong> to upload, transcribe, and generate the draft.
          </p>
          {recorder.audioUrl && (
            <audio controls src={recorder.audioUrl} className="w-full" />
          )}
          <div className="text-sm text-muted-foreground">
            Duration: <span className="font-mono tabular-nums text-foreground">{formatDuration(recorder.durationSeconds)}</span>
            {recorder.audioBlob && (
              <span> · Size: <span className="font-mono tabular-nums text-foreground">{(recorder.audioBlob.size / 1024 / 1024).toFixed(2)} MB</span></span>
            )}
          </div>
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleDiscard}
              className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleConfirmAndProcess}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              <Upload className="h-4 w-4" /> Process recording
            </button>
          </div>
        </section>
      )}

      {processing && (
        <section className="bg-card rounded-2xl border border-border p-8 text-center space-y-4">
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
          <div className="font-display text-xl">Processing…</div>
          <p className="text-sm text-muted-foreground">{progressMessage}</p>
          <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider">
            <Step active={phase === 'uploading'} done={['transcribing', 'generating', 'redirecting'].includes(phase)} label="Upload" />
            <ChevronDivider />
            <Step active={phase === 'transcribing'} done={['generating', 'redirecting'].includes(phase)} label="Transcribe" />
            <ChevronDivider />
            <Step active={phase === 'generating'} done={phase === 'redirecting'} label="Generate" />
          </div>
        </section>
      )}

      {recorder.error && phase === 'pre' && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 flex items-start gap-2">
          <MicOff className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{recorder.error}</span>
        </div>
      )}
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={
      active ? 'text-foreground' :
      done ? 'text-green-700 dark:text-green-300' :
      'text-muted-foreground/50'
    }>
      {done ? '✓ ' : ''}{label}
    </span>
  );
}

function ChevronDivider() {
  return <span className="text-muted-foreground/30">›</span>;
}
