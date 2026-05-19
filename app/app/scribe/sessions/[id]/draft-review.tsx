'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, AlertCircle, Check, X, Play, Pause, RefreshCw, Brain, Sparkles, FileSignature, Loader2 } from 'lucide-react';
import { calculateAge, diabetesTypeLabel, formatDateTime } from '@/lib/utils';

type Section = {
  id: string;
  label: string;
  content: string;
  source_segments: number[];
  confidence: number;
};

export function DraftReview({
  session,
  drafts,
  currentUserId,
}: {
  session: any;
  drafts: any[];
  currentUserId: string;
}) {
  const router = useRouter();
  const draft = drafts[0]; // latest
  const segments = (session.transcript_segments ?? []) as any[];
  const isOwner = session.provider_id === currentUserId;

  const [chiefComplaint, setChiefComplaint] = useState(draft?.chief_complaint?.text ?? '');
  const [subjective, setSubjective] = useState(draft?.subjective ?? { sections: [] });
  const [objective, setObjective] = useState(draft?.objective ?? { sections: [] });
  const [assessment, setAssessment] = useState(draft?.assessment ?? { sections: [] });
  const [plan, setPlan] = useState(draft?.plan ?? { sections: [] });

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch signed audio URL on mount
  useEffect(() => {
    if (session.audio_storage_path && session.status !== 'expired') {
      fetch(`/api/scribe/sessions/${session.id}/audio`)
        .then((r) => r.json())
        .then((d) => { if (d.url) setAudioUrl(d.url); })
        .catch(() => {});
    }
  }, [session.id, session.audio_storage_path, session.status]);

  function jumpToSegment(segIdx: number) {
    const seg = segments[segIdx];
    if (!seg || !audioRef.current) return;
    audioRef.current.currentTime = seg.start;
    audioRef.current.play().catch(() => {});

    // Log audio playback for audit
    fetch(`/api/scribe/sessions/${session.id}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_id: draft?.id,
        action: 'view_audio',
        metadata: { segment_idx: segIdx, start_seconds: seg.start },
      }),
    }).catch(() => {});
  }

  function updateSection(field: 'subjective' | 'objective' | 'assessment' | 'plan', idx: number, content: string) {
    const target = field === 'subjective' ? subjective : field === 'objective' ? objective : field === 'assessment' ? assessment : plan;
    const setter = field === 'subjective' ? setSubjective : field === 'objective' ? setObjective : field === 'assessment' ? setAssessment : setPlan;
    const original = target.sections[idx]?.content ?? '';
    if (original === content) return;
    const next = {
      ...target,
      sections: target.sections.map((s: Section, i: number) => (i === idx ? { ...s, content } : s)),
    };
    setter(next);

    // Log edit (debounced via timeout would be nicer; for now log every blur via onBlur in textarea)
  }

  async function logEdit(field: string, sectionId: string, original: string, edited: string) {
    if (original === edited) return;
    await fetch(`/api/scribe/sessions/${session.id}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_id: draft?.id,
        action: 'edit',
        section: `${field}.${sectionId}`,
        original_text: original,
        edited_text: edited,
      }),
    }).catch(() => {});
  }

  async function regenerate(altLlm?: 'claude' | 'gpt4o') {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/scribe/sessions/${session.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(altLlm ? { llm: altLlm } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Regeneration failed');
        return;
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/scribe/sessions/${session.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draft.id,
          chief_complaint: chiefComplaint || null,
          subjective,
          objective,
          assessment,
          plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Accept failed');
        return;
      }
      router.push(`/app/encounters/${data.encounter_id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt('Why are you rejecting this draft? (optional)');
    if (reason === null) return;
    setRejecting(true);
    try {
      await fetch(`/api/scribe/sessions/${session.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, draft_id: draft?.id }),
      });
      router.push(`/app/patients/${session.patient_id}`);
    } finally {
      setRejecting(false);
    }
  }

  const patient = session.patients;
  const hasGuardrailBlocks = (draft?.guardrail_flags ?? []).some((f: string) => f === 'dose_not_in_source');
  const status = session.status;

  // If session isn't ready, show status
  if (!draft || status !== 'ready') {
    return (
      <div className="max-w-2xl space-y-6">
        <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to patient
        </Link>
        <header>
          <h1 className="font-display text-3xl tracking-tight">Scribe session</h1>
          <div className="text-sm text-muted-foreground mt-1">{patient.last_name}, {patient.first_name} · MRN {patient.mrn}</div>
        </header>
        <section className="bg-card rounded-2xl border border-border p-12 text-center space-y-3">
          <span className={`clinical-badge clinical-badge-${status === 'accepted' ? 'good' : status.includes('failed') ? 'high' : 'borderline'} capitalize`}>
            {status.replace(/_/g, ' ')}
          </span>
          <p className="text-sm text-muted-foreground">
            {status === 'accepted' && 'This session was accepted and used to generate an encounter.'}
            {status === 'rejected' && 'This draft was rejected.'}
            {status === 'expired' && 'Audio for this session has been purged per retention policy.'}
            {status === 'transcription_failed' && (session.transcription_error ?? 'Transcription failed.')}
            {status === 'generation_failed' && 'Draft generation failed.'}
            {!['accepted', 'rejected', 'expired', 'transcription_failed', 'generation_failed'].includes(status) && 'Session is in progress.'}
          </p>
          {status === 'transcription_failed' && isOwner && session.audio_storage_path && (
            <button onClick={async () => { await fetch(`/api/scribe/sessions/${session.id}/transcribe`, { method: 'POST' }); router.refresh(); }} className="text-sm underline">Retry transcription</button>
          )}
          {status === 'generation_failed' && isOwner && session.transcript_text && (
            <button onClick={() => regenerate()} className="text-sm underline">Retry generation</button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to patient
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">AI Scribe draft</div>
          <h1 className="font-display text-3xl tracking-tight">{patient.last_name}, {patient.first_name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono">MRN {patient.mrn}</span>
            <span>·</span><span>{calculateAge(patient.date_of_birth)} yrs</span>
            <span>·</span><span>{diabetesTypeLabel(patient.diabetes_type)}</span>
            <span>·</span><span>Recorded {formatDateTime(session.started_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {draft.llm === 'claude' ? <Brain className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {draft.llm === 'claude' ? 'Claude' : 'GPT-4o'} · conf {Math.round(draft.overall_confidence * 100)}%
          </div>
          {isOwner && (
            <button
              onClick={() => regenerate(draft.llm === 'claude' ? 'gpt4o' : 'claude')}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-input bg-card text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Try with {draft.llm === 'claude' ? 'GPT-4o' : 'Claude'}
            </button>
          )}
        </div>
      </header>

      {/* Warnings */}
      {hasGuardrailBlocks && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 text-sm p-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Possible hallucination detected.</strong> One or more dose values in this draft were not found in the transcript. Review carefully before accepting.
          </div>
        </div>
      )}
      {draft.low_confidence_section_count > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm p-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>{draft.low_confidence_section_count} section{draft.low_confidence_section_count === 1 ? ' has' : 's have'} low confidence.</strong> Click any section header to jump to the audio segment that supports it.
          </div>
        </div>
      )}

      {/* Audio player */}
      {audioUrl && (
        <section className="bg-card rounded-2xl border border-border p-4">
          <audio ref={audioRef} controls src={audioUrl} className="w-full" preload="metadata" />
        </section>
      )}

      {/* Chief complaint */}
      <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Chief complaint</label>
          <ConfidenceBadge confidence={draft.chief_complaint?.confidence} />
        </div>
        <input
          type="text"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          onBlur={() => logEdit('chief_complaint', 'main', draft.chief_complaint?.text ?? '', chiefComplaint)}
          className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {draft.chief_complaint?.source_segments?.length > 0 && (
          <SourceLinks segments={draft.chief_complaint.source_segments} allSegments={segments} onJump={jumpToSegment} />
        )}
      </section>

      {/* SOAP sections */}
      <SoapField title="Subjective" color="green" value={subjective} setValue={setSubjective} segments={segments} onJump={jumpToSegment} field="subjective" logEdit={logEdit} />
      <SoapField title="Objective" color="amber" value={objective} setValue={setObjective} segments={segments} onJump={jumpToSegment} field="objective" logEdit={logEdit} />
      <SoapField title="Assessment" color="red" value={assessment} setValue={setAssessment} segments={segments} onJump={jumpToSegment} field="assessment" logEdit={logEdit} />
      <SoapField title="Plan" color="navy" value={plan} setValue={setPlan} segments={segments} onJump={jumpToSegment} field="plan" logEdit={logEdit} />

      {/* Transcript */}
      <details className="bg-card rounded-2xl border border-border">
        <summary className="px-6 py-4 cursor-pointer font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Full transcript ({segments.length} segments)
        </summary>
        <div className="px-6 pb-6 space-y-2 max-h-96 overflow-y-auto">
          {segments.map((seg: any) => (
            <div key={seg.idx} className="flex gap-3 text-sm group">
              <button
                onClick={() => jumpToSegment(seg.idx)}
                className="font-mono text-[10px] text-muted-foreground hover:text-foreground shrink-0 w-16 tabular-nums"
              >
                {Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, '0')}
              </button>
              <span className={`flex-1 ${seg.confidence < 0.6 ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                {seg.text}
              </span>
            </div>
          ))}
        </div>
      </details>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
      )}

      {/* Actions */}
      {isOwner && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-2 py-4 -mx-2 flex items-center justify-end gap-3 flex-wrap">
          <button
            onClick={handleReject}
            disabled={rejecting || accepting}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Reject draft
          </button>
          <button
            onClick={handleAccept}
            disabled={rejecting || accepting}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
            Accept → create encounter
          </button>
        </div>
      )}
    </div>
  );
}

function SoapField({
  title, color, value, setValue, segments, onJump, field, logEdit,
}: {
  title: string;
  color: 'green' | 'amber' | 'red' | 'navy';
  value: { sections: Section[] };
  setValue: (v: any) => void;
  segments: any[];
  onJump: (idx: number) => void;
  field: string;
  logEdit: (field: string, sectionId: string, original: string, edited: string) => void;
}) {
  const borderColor =
    color === 'green' ? 'border-l-green-500' :
    color === 'amber' ? 'border-l-amber-500' :
    color === 'red' ? 'border-l-red-500' :
    'border-l-primary';
  const titleColor =
    color === 'green' ? 'text-green-700 dark:text-green-300' :
    color === 'amber' ? 'text-amber-700 dark:text-amber-300' :
    color === 'red' ? 'text-red-700 dark:text-red-300' :
    'text-primary';

  return (
    <section className={`bg-card rounded-2xl border border-border border-l-4 ${borderColor}`}>
      <header className="px-6 pt-5 pb-3">
        <h2 className={`font-display text-xl ${titleColor}`}>{title}</h2>
      </header>
      <div className="px-6 pb-6 space-y-4">
        {value.sections.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No content for this section.</div>
        ) : (
          value.sections.map((s, idx) => (
            <div key={s.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</label>
                <ConfidenceBadge confidence={s.confidence} />
              </div>
              <textarea
                value={s.content ?? ''}
                onChange={(e) => {
                  const updated = { ...value, sections: value.sections.map((ss, i) => i === idx ? { ...ss, content: e.target.value } : ss) };
                  setValue(updated);
                }}
                onBlur={(e) => logEdit(field, s.id, s.content, e.target.value)}
                rows={Math.max(2, Math.ceil((s.content?.length ?? 0) / 80))}
                className={`w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px] ${
                  s.confidence < 0.7 ? 'border-amber-300 dark:border-amber-700' : 'border-input'
                }`}
              />
              {s.source_segments.length > 0 && (
                <SourceLinks segments={s.source_segments} allSegments={segments} onJump={onJump} />
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined || confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const tone = confidence >= 0.8 ? 'good' : confidence >= 0.6 ? 'borderline' : 'high';
  return (
    <span className={`clinical-badge clinical-badge-${tone} text-[10px]`}>
      {pct}% conf
    </span>
  );
}

function SourceLinks({ segments, allSegments, onJump }: { segments: number[]; allSegments: any[]; onJump: (idx: number) => void }) {
  if (segments.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap pt-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Source:</span>
      {segments.slice(0, 6).map((segIdx) => {
        const seg = allSegments[segIdx];
        if (!seg) return null;
        const time = `${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}`;
        return (
          <button
            key={segIdx}
            onClick={() => onJump(segIdx)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-muted hover:bg-muted/70 transition-colors"
            title={seg.text}
          >
            <Play className="h-2.5 w-2.5" /> {time}
          </button>
        );
      })}
      {segments.length > 6 && (
        <span className="text-[10px] font-mono text-muted-foreground">+{segments.length - 6} more</span>
      )}
    </div>
  );
}
