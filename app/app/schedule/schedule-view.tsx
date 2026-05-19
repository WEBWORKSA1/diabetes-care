'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, User, MessageSquare, Settings as SettingsIcon } from 'lucide-react';
import { BookAppointmentModal } from './book-modal';

type Provider = { id: string; full_name: string; credentials: string; role: string };
type Appointment = {
  id: string;
  status: string;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  patients: { id: string; first_name: string; last_name: string; mrn: string };
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function ScheduleView({
  currentUser,
  providers,
  initialProviderId,
  initialDate,
}: {
  currentUser: any;
  providers: Provider[];
  initialProviderId: string;
  initialDate?: string;
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(initialProviderId);
  const [weekStart, setWeekStart] = useState<Date>(
    initialDate ? startOfWeek(new Date(initialDate)) : startOfWeek(new Date())
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState<{ start?: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/appointments?provider_id=${providerId}&start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`)
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [providerId, weekStart, weekEnd]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const dayKey = new Date(a.starts_at).toISOString().slice(0, 10);
      const arr = map.get(dayKey) ?? [];
      arr.push(a);
      map.set(dayKey, arr);
    }
    return map;
  }, [appointments]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {appointments.length} appointment{appointments.length === 1 ? '' : 's'} this week
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="h-9 px-3 rounded-full border border-input bg-card text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}{p.credentials ? `, ${p.credentials}` : ''}</option>
            ))}
          </select>
          <Link
            href="/app/schedule/availability"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-input bg-card text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <SettingsIcon className="h-3 w-3" /> Availability
          </Link>
          <Link
            href="/app/schedule/sms-settings"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-input bg-card text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <MessageSquare className="h-3 w-3" /> SMS
          </Link>
          <button
            onClick={() => setShowBook({})}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" /> New appointment
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-display text-lg">
          {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} –{' '}
          {addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="h-8 px-3 rounded-full border border-input bg-card text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayKey = day.toISOString().slice(0, 10);
          const dayAppts = apptsByDay.get(dayKey) ?? [];
          const isToday = dayKey === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={dayKey}
              className={`bg-card rounded-xl border ${isToday ? 'border-accent' : 'border-border'} min-h-[400px] flex flex-col`}
            >
              <div className={`px-3 py-2 border-b border-border text-center ${isToday ? 'bg-accent/5' : ''}`}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="font-display text-2xl tabular-nums">{day.getDate()}</div>
              </div>
              <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                {dayAppts.length === 0 ? (
                  <button
                    onClick={() => setShowBook({ start: day.toISOString() })}
                    className="w-full h-full min-h-[60px] rounded-lg border border-dashed border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    + book
                  </button>
                ) : (
                  dayAppts.map((a) => (
                    <Link
                      key={a.id}
                      href={`/app/schedule/${a.id}`}
                      className="block p-2 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
                        {formatTime(new Date(a.starts_at))}
                      </div>
                      <div className="text-xs font-medium mt-0.5 truncate">
                        {a.patients.last_name}, {a.patients.first_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize truncate">
                        {a.appointment_type.replace(/_/g, ' ')}
                      </div>
                      <StatusDot status={a.status} />
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showBook && (
        <BookAppointmentModal
          providerId={providerId}
          providers={providers}
          initialStart={showBook.start}
          onClose={() => setShowBook(null)}
          onBooked={() => {
            setShowBook(null);
            router.refresh();
            fetch(`/api/appointments?provider_id=${providerId}&start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`)
              .then((r) => r.json())
              .then((d) => setAppointments(d.appointments ?? []));
          }}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    scheduled: 'bg-blue-400',
    confirmed: 'bg-green-500',
    arrived: 'bg-amber-500',
    in_progress: 'bg-amber-500',
    completed: 'bg-muted',
    no_show: 'bg-red-500',
    cancelled: 'bg-muted',
  };
  const color = colorMap[status] ?? 'bg-muted';
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[9px] uppercase font-mono text-muted-foreground tracking-wider">{status.replace('_', ' ')}</span>
    </div>
  );
}
