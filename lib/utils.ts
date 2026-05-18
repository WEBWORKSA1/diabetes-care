import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(date: Date | string | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d)} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function calculateAge(dob: string | Date): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function diabetesTypeLabel(t: string): string {
  const map: Record<string, string> = {
    type_1: 'Type 1',
    type_2: 'Type 2',
    gestational: 'Gestational',
    prediabetes: 'Prediabetes',
    mody: 'MODY',
    lada: 'LADA',
    other: 'Other',
  };
  return map[t] ?? t;
}

export function a1cBand(a1c: number): { label: string; tone: 'good' | 'borderline' | 'high' | 'critical' } {
  if (a1c < 5.7) return { label: 'Normal', tone: 'good' };
  if (a1c < 6.5) return { label: 'Prediabetes', tone: 'borderline' };
  if (a1c < 7.0) return { label: 'At target', tone: 'good' };
  if (a1c < 8.0) return { label: 'Above target', tone: 'borderline' };
  if (a1c < 9.0) return { label: 'Poorly controlled', tone: 'high' };
  return { label: 'Critical', tone: 'critical' };
}
