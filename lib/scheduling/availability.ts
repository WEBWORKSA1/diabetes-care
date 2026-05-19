/**
 * Provider availability + slot generation.
 *
 * Given a provider's weekly schedule, time off, and existing appointments,
 * generate bookable slots for a date range.
 */

export interface AvailabilityWindow {
  id: string;
  day_of_week: number; // 0-6, Sunday=0
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  slot_duration_minutes: number;
  effective_from?: string | null;
  effective_until?: string | null;
}

export interface TimeOff {
  starts_at: string; // ISO
  ends_at: string;
}

export interface BookedSlot {
  starts_at: string;
  ends_at: string;
  status: string;
}

export interface Slot {
  starts_at: string; // ISO
  ends_at: string;
  available: boolean;
  conflict_reason?: 'booked' | 'time_off' | 'past';
}

/**
 * Parse 'HH:MM:SS' or 'HH:MM' into hours and minutes.
 */
function parseTime(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
}

/**
 * Generate slot times for a single day given a window.
 * Returns Date objects in UTC.
 */
function slotsForDay(
  date: Date,
  window: AvailabilityWindow
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const { h: sh, m: sm } = parseTime(window.start_time);
  const { h: eh, m: em } = parseTime(window.end_time);

  const start = new Date(date);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(date);
  end.setHours(eh, em, 0, 0);

  const duration = window.slot_duration_minutes * 60 * 1000;
  let cursor = start.getTime();

  while (cursor + duration <= end.getTime()) {
    slots.push({
      start: new Date(cursor),
      end: new Date(cursor + duration),
    });
    cursor += duration;
  }

  return slots;
}

/**
 * Generate all slots for a provider across a date range.
 */
export function generateSlots(opts: {
  rangeStart: Date;
  rangeEnd: Date;
  windows: AvailabilityWindow[];
  timeOff: TimeOff[];
  booked: BookedSlot[];
  now?: Date;
}): Slot[] {
  const { rangeStart, rangeEnd, windows, timeOff, booked } = opts;
  const now = opts.now ?? new Date();
  const slots: Slot[] = [];

  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= rangeEnd) {
    const dayOfWeek = cursor.getDay();
    const dateStr = cursor.toISOString().slice(0, 10);

    // Find windows for this day
    const dayWindows = windows.filter((w) => {
      if (w.day_of_week !== dayOfWeek) return false;
      if (w.effective_from && dateStr < w.effective_from) return false;
      if (w.effective_until && dateStr > w.effective_until) return false;
      return true;
    });

    for (const win of dayWindows) {
      const daySlots = slotsForDay(cursor, win);
      for (const s of daySlots) {
        const startISO = s.start.toISOString();
        const endISO = s.end.toISOString();

        // Past slots are not available
        if (s.start < now) {
          slots.push({ starts_at: startISO, ends_at: endISO, available: false, conflict_reason: 'past' });
          continue;
        }

        // Time-off overlap
        const inTimeOff = timeOff.some((t) => {
          const ts = new Date(t.starts_at).getTime();
          const te = new Date(t.ends_at).getTime();
          return s.start.getTime() < te && s.end.getTime() > ts;
        });
        if (inTimeOff) {
          slots.push({ starts_at: startISO, ends_at: endISO, available: false, conflict_reason: 'time_off' });
          continue;
        }

        // Booked overlap
        const isBooked = booked.some((b) => {
          const bs = new Date(b.starts_at).getTime();
          const be = new Date(b.ends_at).getTime();
          return s.start.getTime() < be && s.end.getTime() > bs;
        });
        if (isBooked) {
          slots.push({ starts_at: startISO, ends_at: endISO, available: false, conflict_reason: 'booked' });
          continue;
        }

        slots.push({ starts_at: startISO, ends_at: endISO, available: true });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

/**
 * Helper: get next N business days starting from a date.
 */
export function getDateRange(start: Date, days: number): { start: Date; end: Date } {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + days);
  e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
}
