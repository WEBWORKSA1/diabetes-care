'use client';

import { useEffect, useState } from 'react';
import { X, Search, Loader2, CalendarClock, Check } from 'lucide-react';

type Patient = { id: string; first_name: string; last_name: string; mrn: string; phone_mobile: string | null; sms_consent: boolean };
type Provider = { id: string; full_name: string; credentials: string };
type Slot = { starts_at: string; ends_at: string; available: boolean; conflict_reason?: string };

const APPOINTMENT_TYPES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'new_patient', label: 'New patient' },
  { value: 'cgm_review', label: 'CGM review' },
  { value: 'glp1_initiation', label: 'GLP-1 initiation' },
  { value: 'lab_review', label: 'Lab review' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'other', label: 'Other' },
];

export function BookAppointmentModal({
  providerId: initialProviderId,
  providers,
  initialStart,
  onClose,
  onBooked,
}: {
  providerId: string;
  providers: Provider[];
  initialStart?: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [providerId, setProviderId] = useState(initialProviderId);
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [type, setType] = useState('follow_up');
  const [reason, setReason] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patient search
  useEffect(() => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10`)
        .then((r) => r.json())
        .then((d) => setPatients(d.patients ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Load slots when provider/date changes
  useEffect(() => {
    if (!providerId) return;
    setLoadingSlots(true);
    const startParam = initialStart ?? new Date().toISOString();
    fetch(`/api/scheduling/slots?provider_id=${providerId}&start=${startParam}&days=14`)
      .then((r) => r.json())
      .then((d) => {
        setSlots((d.slots ?? []).filter((s: Slot) => s.available).slice(0, 100));
      })
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [providerId, initialStart]);

  async function book() {
    if (!selectedPatient || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          provider_id: providerId,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          appointment_type: type,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Booking failed');
        return;
      }
      onBooked();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by day for the picker
  const slotsByDay = slots.reduce((acc, s) => {
    const day = s.starts_at.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl">Book appointment</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Patient picker */}
          <section className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Patient</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <div className="font-medium">{selectedPatient.last_name}, {selectedPatient.first_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">MRN {selectedPatient.mrn}</div>
                  {!selectedPatient.sms_consent && (
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">No SMS consent — reminders will not be sent</div>
                  )}
                </div>
                <button onClick={() => { setSelectedPatient(null); setSearch(''); }} className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or MRN…"
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {patients.length > 0 && (
                  <ul className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                    {patients.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setSelectedPatient(p)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <div className="font-medium text-sm">{p.last_name}, {p.first_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">MRN {p.mrn}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          {selectedPatient && (
            <>
              {/* Provider + type */}
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Provider</div>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</div>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5 block">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Reason (optional)</div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. A1C check, CGM review…"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </label>

              {/* Slot picker */}
              <section className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pick a time</label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4">
                    No available slots in the next 14 days. <a href="/app/schedule/availability" className="underline">Set up availability</a>.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {Object.entries(slotsByDay).map(([day, daySlots]) => (
                      <div key={day}>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                          {new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map((s) => {
                            const time = new Date(s.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            const active = selectedSlot?.starts_at === s.starts_at;
                            return (
                              <button
                                key={s.starts_at}
                                onClick={() => setSelectedSlot(s)}
                                className={`h-8 px-3 rounded-full text-xs font-mono tabular-nums transition-colors ${
                                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button onClick={onClose} className="h-10 px-5 rounded-full border border-input bg-card text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={book}
            disabled={!selectedPatient || !selectedSlot || submitting}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Book appointment
          </button>
        </footer>
      </div>
    </div>
  );
}
