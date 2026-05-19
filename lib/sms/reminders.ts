/**
 * Appointment reminder builder + scheduler.
 *
 * On appointment create/reschedule, generates reminder rows in appointment_reminders
 * with appropriate scheduled_for timestamps. Cron picks them up and sends.
 */

import { randomBytes } from 'node:crypto';

export interface ReminderTemplate {
  kind: 'confirm_24h' | 'confirm_2h' | 'cancellation' | 'reschedule';
  scheduledOffsetMs: number; // negative = before appointment
  buildBody: (ctx: ReminderContext) => string;
}

export interface ReminderContext {
  patientFirstName: string;
  providerLastName: string;
  providerCredentials?: string;
  practiceName: string;
  appointmentTime: string; // formatted
  appointmentDate: string; // formatted
  cancelLink: string;
  smsFromName: string;
}

export function formatAppointmentTime(date: Date, timezone: string): { date: string; time: string } {
  // We use Intl.DateTimeFormat with the appointment timezone for patient-facing strings
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return {
    date: dateFmt.format(date),
    time: timeFmt.format(date),
  };
}

export const REMINDER_TEMPLATES: Record<string, ReminderTemplate> = {
  confirm_24h: {
    kind: 'confirm_24h',
    scheduledOffsetMs: -24 * 60 * 60 * 1000,
    buildBody: (ctx) =>
      `Hi ${ctx.patientFirstName}, reminder: appointment with Dr. ${ctx.providerLastName} at ${ctx.practiceName} on ${ctx.appointmentDate} at ${ctx.appointmentTime}. Reply STOP to opt out. Cancel/reschedule: ${ctx.cancelLink}`,
  },
  confirm_2h: {
    kind: 'confirm_2h',
    scheduledOffsetMs: -2 * 60 * 60 * 1000,
    buildBody: (ctx) =>
      `${ctx.patientFirstName}, your appointment with Dr. ${ctx.providerLastName} is in 2 hours at ${ctx.appointmentTime}. See you soon!`,
  },
  cancellation: {
    kind: 'cancellation',
    scheduledOffsetMs: 0,
    buildBody: (ctx) =>
      `Hi ${ctx.patientFirstName}, your appointment on ${ctx.appointmentDate} at ${ctx.appointmentTime} has been cancelled. Call ${ctx.practiceName} to reschedule.`,
  },
  reschedule: {
    kind: 'reschedule',
    scheduledOffsetMs: 0,
    buildBody: (ctx) =>
      `Hi ${ctx.patientFirstName}, your appointment with Dr. ${ctx.providerLastName} has been rescheduled to ${ctx.appointmentDate} at ${ctx.appointmentTime}.`,
  },
};

export function generateCancellationToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Truncate SMS body to 160 chars (single segment) when possible.
 * Twilio bills per segment; multi-segment is ok but costs more.
 */
export function fitToSegment(body: string): string {
  if (body.length <= 160) return body;
  return body.slice(0, 157) + '...';
}
