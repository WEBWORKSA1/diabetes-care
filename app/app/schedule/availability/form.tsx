'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Save, Loader2, Check } from 'lucide-react';

type Window = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AvailabilityForm({ providerId, initial }: { providerId: string; initial: Window[] }) {
  const router = useRouter();
  const [windows, setWindows] = useState<Window[]>(
    initial.length > 0 ? initial : [
      { day_of_week: 1, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
      { day_of_week: 2, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
      { day_of_week: 3, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
      { day_of_week: 4, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
      { day_of_week: 5, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addWindow() {
    setWindows([...windows, { day_of_week: 1, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 }]);
  }

  function updateWindow(idx: number, patch: Partial<Window>) {
    setWindows(windows.map((w, i) => i === idx ? { ...w, ...patch } : w));
  }

  function removeWindow(idx: number) {
    setWindows(windows.filter((_, i) => i !== idx));
  }

  async function save() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, windows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Group windows by day for display
  const byDay: Record<number, Window[]> = {};
  windows.forEach((w, originalIdx) => {
    if (!byDay[w.day_of_week]) byDay[w.day_of_week] = [];
    byDay[w.day_of_week].push({ ...w, _idx: originalIdx } as any);
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {DAYS.map((day, dayIdx) => (
          <section key={dayIdx} className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{day}</h3>
              <button
                onClick={() => setWindows([...windows, { day_of_week: dayIdx, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 }])}
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                + Add window
              </button>
            </div>
            {(byDay[dayIdx] ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Not available</div>
            ) : (
              byDay[dayIdx].map((w: any) => (
                <div key={w._idx} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="time"
                    value={w.start_time.slice(0, 5)}
                    onChange={(e) => updateWindow(w._idx, { start_time: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-input bg-background text-sm tabular-nums"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={w.end_time.slice(0, 5)}
                    onChange={(e) => updateWindow(w._idx, { end_time: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-input bg-background text-sm tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground ml-2">slot</span>
                  <select
                    value={w.slot_duration_minutes}
                    onChange={(e) => updateWindow(w._idx, { slot_duration_minutes: Number(e.target.value) })}
                    className="h-9 px-2 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                  <button
                    onClick={() => removeWindow(w._idx)}
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </section>
        ))}
      </div>

      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">{error}</div>}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 text-green-900 dark:text-green-100 text-sm p-3 flex items-center gap-2">
          <Check className="h-4 w-4" /> Availability saved
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save availability
        </button>
      </div>
    </div>
  );
}
