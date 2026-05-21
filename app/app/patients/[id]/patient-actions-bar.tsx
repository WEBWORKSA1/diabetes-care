'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, FileText, Mic, FlaskConical } from 'lucide-react';
import { LabEntryModal } from '@/components/labs/lab-entry-modal';

export function PatientActionsBar({ patientId }: { patientId: string }) {
  const [showLab, setShowLab] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/app/patients/${patientId}/edit`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
          title="Edit patient details"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
        <button
          onClick={() => setShowLab(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          <FlaskConical className="h-4 w-4" /> Add lab
        </button>
        <Link
          href={`/app/patients/${patientId}/labs`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          All labs
        </Link>
        <Link
          href={`/app/scribe/new?patient=${patientId}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
        >
          <Mic className="h-4 w-4" /> AI Scribe
        </Link>
        <Link
          href={`/app/encounters/new?patient=${patientId}`}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
        >
          <FileText className="h-4 w-4" /> New encounter
        </Link>
      </div>
      {showLab && <LabEntryModal patientId={patientId} onClose={() => setShowLab(false)} />}
    </>
  );
}
