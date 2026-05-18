'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, FileSignature, Calculator, ClipboardCopy } from 'lucide-react';
import { calculateAge, diabetesTypeLabel, formatDate, formatDateTime, a1cBand } from '@/lib/utils';
import { isEncounterEditable, compileEncounterToText } from '@/lib/clinical/encounter';
import { SoapSectionEditor } from './soap-section';
import { VitalsPanel } from './vitals-panel';
import { LabQuickEntry } from './lab-quick-entry';
import { MedicationEditor } from './medication-editor';
import { InsulinTitrationDrawer } from './insulin-titration';
import { SignDialog } from './sign-dialog';

type Encounter = any;

export function EncounterEditor({
  encounter: initial,
  labs: initialLabs,
  medications: initialMeds,
  currentUserId,
}: {
  encounter: Encounter;
  labs: any[];
  medications: any[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [encounter, setEncounter] = useState<Encounter>(initial);
  const [labs, setLabs] = useState(initialLabs);
  const [meds, setMeds] = useState(initialMeds);
  const [chiefComplaint, setChiefComplaint] = useState(initial.chief_complaint ?? '');
  const [subjective, setSubjective] = useState(initial.subjective ?? { sections: [] });
  const [objective, setObjective] = useState(initial.objective ?? { sections: [] });
  const [assessment, setAssessment] = useState(initial.assessment ?? { sections: [] });
  const [plan, setPlan] = useState(initial.plan ?? { sections: [] });
  const [vitals, setVitals] = useState(initial.vitals ?? {});

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showTitration, setShowTitration] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const patient = encounter.patients;
  const editable = isEncounterEditable(encounter);
  const isOwner = encounter.provider_id === currentUserId;

  const queueSave = useCallback((updates: any) => {
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/encounters/${encounter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    }, 800);
  }, [editable, encounter.id]);

  useEffect(() => {
    queueSave({ chief_complaint: chiefComplaint });
  }, [chiefComplaint, queueSave]);

  useEffect(() => {
    queueSave({ subjective, objective, assessment, plan });
  }, [subjective, objective, assessment, plan, queueSave]);

  useEffect(() => {
    queueSave({ vitals });
  }, [vitals, queueSave]);

  function copyNoteToClipboard() {
    const text = compileEncounterToText({
      chief_complaint: chiefComplaint,
      subjective, objective, assessment, plan, vitals,
    });
    navigator.clipboard.writeText(text);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }

  async function onSigned() {
    setShowSign(false);
    router.refresh();
    setEncounter({ ...encounter, status: 'signed', signed_at: new Date().toISOString(), locked_at: new Date().toISOString() });
  }

  const latestA1c = labs.find((l) => l.test_name === 'a1c');

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/patients/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to patient
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground capitalize">
            {encounter.encounter_type.replace(/_/g, ' ')} · {encounter.status}
          </div>
          <h1 className="font-display text-3xl tracking-tight">
            {patient.last_name}, {patient.first_name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono">MRN {patient.mrn}</span>
            <span>·</span>
            <span>{calculateAge(patient.date_of_birth)} yrs</span>
            <span>·</span>
            <span className="capitalize">{patient.sex_at_birth}</span>
            <span>·</span>
            <span>{diabetesTypeLabel(patient.diabetes_type)}</span>
            {latestA1c && (
              <>
                <span>·</span>
                <span className={`clinical-badge clinical-badge-${a1cBand(Number(latestA1c.value)).tone === 'good' ? 'good' : a1cBand(Number(latestA1c.value)).tone === 'borderline' ? 'borderline' : 'high'}`}>
                  A1C {latestA1c.value}% ({formatDate(latestA1c.collected_at)})
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-mono uppercase tracking-wider ${
            saveStatus === 'saving' ? 'text-muted-foreground' :
            saveStatus === 'saved' ? 'text-green-700 dark:text-green-300' :
            saveStatus === 'error' ? 'text-destructive' : 'text-transparent'
          }`}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && 'Save failed'}
            {saveStatus === 'idle' && '—'}
          </span>
          {!editable && (
            <span className="inline-flex items-center gap-1.5 clinical-badge clinical-badge-good">
              <Lock className="h-3 w-3" /> Signed {formatDateTime(encounter.signed_at)}
            </span>
          )}
          <button
            onClick={copyNoteToClipboard}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <ClipboardCopy className="h-4 w-4" /> Copy note
          </button>
          {editable && isOwner && (
            <button
              onClick={() => setShowTitration(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <Calculator className="h-4 w-4" /> Insulin titration
            </button>
          )}
          {editable && isOwner && (
            <button
              onClick={() => setShowSign(true)}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              <FileSignature className="h-4 w-4" /> Sign & lock
            </button>
          )}
        </div>
      </header>

      <section className="bg-card rounded-2xl border border-border p-6 space-y-3">
        <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Chief complaint</label>
        <input
          type="text"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          disabled={!editable}
          placeholder="e.g., Q3 diabetes follow-up; CGM review"
          className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SoapSectionEditor title="Subjective" color="green" value={subjective} onChange={setSubjective} editable={editable} />
          <SoapSectionEditor
            title="Objective"
            color="amber"
            value={objective}
            onChange={setObjective}
            editable={editable}
            extra={<VitalsPanel vitals={vitals} onChange={setVitals} editable={editable} />}
          />
          <SoapSectionEditor title="Assessment" color="red" value={assessment} onChange={setAssessment} editable={editable} />
          <SoapSectionEditor title="Plan" color="navy" value={plan} onChange={setPlan} editable={editable} />
        </div>

        <aside className="space-y-6">
          <LabQuickEntry
            patientId={patient.id}
            encounterId={encounter.id}
            labs={labs}
            onLabAdded={(newLab) => setLabs([newLab, ...labs])}
            editable={editable}
          />
          <MedicationEditor
            patientId={patient.id}
            medications={meds}
            onAdded={(m) => setMeds([m, ...meds])}
            onDiscontinued={(id) => setMeds(meds.map((m) => m.id === id ? { ...m, discontinued_at: new Date().toISOString() } : m))}
            editable={editable}
          />
        </aside>
      </div>

      {showTitration && (
        <InsulinTitrationDrawer
          onClose={() => setShowTitration(false)}
          medications={meds}
          onAppendToPlan={(text) => {
            const updated = { ...plan };
            const medSection = updated.sections?.find((s: any) => s.id === 'medications' || s.id === 'med_changes' || s.id === 'insulin_changes');
            if (medSection) {
              medSection.content = (medSection.content ? `${medSection.content}\n\n` : '') + text;
            } else {
              updated.sections = [
                ...(updated.sections || []),
                { id: 'medications', label: 'Medication changes', content: text },
              ];
            }
            setPlan(updated);
            setShowTitration(false);
          }}
        />
      )}

      {showSign && (
        <SignDialog
          encounterId={encounter.id}
          onSigned={onSigned}
          onCancel={() => setShowSign(false)}
        />
      )}
    </div>
  );
}
