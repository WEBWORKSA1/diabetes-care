import { NewPatientForm } from './form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'New patient' };

export default function NewPatientPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <Link href="/app/patients" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All patients
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">New patient</h1>
        <p className="text-sm text-muted-foreground">Required fields are marked with an asterisk. You can add medical history, medications, and labs after creating the record.</p>
      </header>
      <NewPatientForm />
    </div>
  );
}
