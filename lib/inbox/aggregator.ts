/**
 * Clinical inbox aggregator.
 *
 * Collects pending items across the practice into a typed feed.
 * Each item has a priority score for sorting; tiles use raw counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type InboxItemType =
  | 'abnormal_lab'
  | 'unreviewed_lab'
  | 'unsigned_encounter'
  | 'ready_scribe'
  | 'critical_cgm_alert'
  | 'cgm_alert'
  | 'arrived_waiting'
  | 'upcoming_appointment'
  | 'patient_message'
  | 'urgent_patient_message'
  | 'intake_submitted';

export type InboxItemPriority = 'critical' | 'high' | 'normal' | 'low';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  priority: InboxItemPriority;
  priorityScore: number;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  patient: { id: string; first_name: string; last_name: string; mrn: string } | null;
  provider?: { id: string; full_name: string } | null;
  metadata?: Record<string, any>;
}

export interface InboxCounts {
  unsigned_encounters: number;
  unsigned_encounters_mine: number;
  unreviewed_labs: number;
  unreviewed_abnormal_labs: number;
  unresolved_cgm_alerts: number;
  critical_cgm_alerts: number;
  ready_scribe_drafts: number;
  today_appointments: number;
  waiting_room_count: number;
  unresolved_patient_messages: number;
  urgent_patient_messages: number;
  submitted_intake_responses: number;
  total_pending: number;
  critical_total: number;
}

export interface InboxResult {
  counts: InboxCounts;
  items: InboxItem[];
}

export interface InboxOptions {
  filter: 'mine' | 'all';
  organizationId: string;
  currentUserId: string;
  maxItems?: number;
}

const PRIORITY_SCORES = {
  critical_cgm_alert: 95,
  urgent_patient_message: 88,
  abnormal_lab: 80,
  arrived_waiting: 75,
  ready_scribe: 60,
  unsigned_encounter: 55,
  cgm_alert: 50,
  patient_message: 45,
  intake_submitted: 42,
  unreviewed_lab: 40,
  upcoming_appointment: 30,
} as const;

function toPriority(score: number): InboxItemPriority {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'normal';
  return 'low';
}

export async function buildInbox(
  supabase: SupabaseClient,
  opts: InboxOptions
): Promise<InboxResult> {
  const max = opts.maxItems ?? 100;
  const items: InboxItem[] = [];

  const [
    abnormalLabs,
    unreviewedLabs,
    unsignedEncounters,
    readyScribes,
    cgmAlerts,
    arrivedAppts,
    upcomingAppts,
    patientMessages,
    intakeResponses,
    msgCounts,
    intakeCount,
    mineCountQueryResult,
  ] = await Promise.all([
    fetchAbnormalLabs(supabase, opts.filter, opts.currentUserId, 25),
    fetchUnreviewedLabs(supabase, opts.filter, opts.currentUserId, 25),
    fetchUnsignedEncounters(supabase, opts.filter, opts.currentUserId, 25),
    fetchReadyScribes(supabase, opts.filter, opts.currentUserId, 25),
    fetchCgmAlerts(supabase, 25),
    fetchArrivedAppts(supabase, opts.filter, opts.currentUserId),
    fetchUpcomingAppts(supabase, opts.filter, opts.currentUserId),
    fetchPatientMessages(supabase, 25),
    fetchSubmittedIntakes(supabase, opts.filter, opts.currentUserId, 25),
    supabase.from('patient_messages').select('id, priority', { count: 'exact', head: false }).is('resolved_at', null),
    supabase.from('intake_form_responses').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase
      .from('encounters')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', opts.currentUserId)
      .in('status', ['in_progress', 'pending_signature'])
      .is('deleted_at', null),
  ]);

  items.push(...abnormalLabs, ...unreviewedLabs, ...unsignedEncounters, ...readyScribes, ...cgmAlerts, ...arrivedAppts, ...upcomingAppts, ...patientMessages, ...intakeResponses);

  items.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });

  const trimmed = items.slice(0, max);

  // Use raw view for static counts, augment with our new categories
  const { data: countsRaw } = await supabase
    .from('v_inbox_counts')
    .select('*')
    .eq('organization_id', opts.organizationId)
    .maybeSingle();

  const messages = msgCounts.data ?? [];
  const urgentMessages = messages.filter((m: any) => m.priority === 'urgent').length;

  const raw = (countsRaw ?? {}) as any;
  const counts: InboxCounts = {
    unsigned_encounters: raw.unsigned_encounters ?? 0,
    unsigned_encounters_mine: mineCountQueryResult.count ?? 0,
    unreviewed_labs: raw.unreviewed_labs ?? 0,
    unreviewed_abnormal_labs: raw.unreviewed_abnormal_labs ?? 0,
    unresolved_cgm_alerts: raw.unresolved_cgm_alerts ?? 0,
    critical_cgm_alerts: raw.critical_cgm_alerts ?? 0,
    ready_scribe_drafts: raw.ready_scribe_drafts ?? 0,
    today_appointments: raw.today_appointments ?? 0,
    waiting_room_count: raw.waiting_room_count ?? 0,
    unresolved_patient_messages: messages.length,
    urgent_patient_messages: urgentMessages,
    submitted_intake_responses: intakeCount.count ?? 0,
    total_pending: 0,
    critical_total: 0,
  };
  counts.total_pending =
    counts.unsigned_encounters + counts.unreviewed_labs + counts.unresolved_cgm_alerts +
    counts.ready_scribe_drafts + counts.unresolved_patient_messages + counts.submitted_intake_responses;
  counts.critical_total =
    counts.critical_cgm_alerts + counts.unreviewed_abnormal_labs + counts.urgent_patient_messages;

  return { counts, items: trimmed };
}

async function fetchPatientMessages(supabase: SupabaseClient, limit: number): Promise<InboxItem[]> {
  const { data } = await supabase
    .from('patient_messages')
    .select(`
      id, subject, body, priority, sent_at, acknowledged_at, triage_flag,
      patients(id, first_name, last_name, mrn)
    `)
    .is('resolved_at', null)
    .order('priority', { ascending: false })
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => {
    const isUrgent = row.priority === 'urgent' || row.triage_flag;
    const score = isUrgent ? PRIORITY_SCORES.urgent_patient_message : PRIORITY_SCORES.patient_message;
    return {
      id: `msg_${row.id}`,
      type: (isUrgent ? 'urgent_patient_message' : 'patient_message') as InboxItemType,
      priority: toPriority(score),
      priorityScore: score,
      title: `${isUrgent ? '⚠️ ' : ''}${row.subject}`,
      description: `${truncate(row.body, 80)} · ${formatRelative(row.sent_at)}`,
      href: `/app/messages/${row.id}`,
      occurredAt: row.sent_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { message_id: row.id, acknowledged: !!row.acknowledged_at },
    };
  });
}

async function fetchSubmittedIntakes(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string, limit: number): Promise<InboxItem[]> {
  let q = supabase
    .from('intake_form_responses')
    .select(`
      id, submitted_at, status,
      intake_forms(name),
      patients!inner(id, first_name, last_name, mrn, primary_provider_id),
      appointments(id, starts_at)
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (filter === 'mine') {
    q = q.eq('patients.primary_provider_id', userId);
  }

  const { data } = await q;

  return (data ?? []).map((row: any) => {
    const apptDate = row.appointments?.starts_at;
    const apptDesc = apptDate ? `for ${new Date(apptDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} visit` : 'no appointment linked';
    return {
      id: `intake_${row.id}`,
      type: 'intake_submitted' as const,
      priority: 'normal' as const,
      priorityScore: PRIORITY_SCORES.intake_submitted,
      title: `Intake form submitted: ${row.intake_forms?.name ?? 'Form'}`,
      description: `${apptDesc} · ${formatRelative(row.submitted_at)}`,
      href: `/app/intake-responses/${row.id}`,
      occurredAt: row.submitted_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { response_id: row.id },
    };
  });
}

async function fetchAbnormalLabs(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string, limit: number): Promise<InboxItem[]> {
  let q = supabase
    .from('lab_values')
    .select(`
      id, test_name, value, unit, reference_low, reference_high, collected_at,
      patient_id, patients!inner(id, first_name, last_name, mrn, primary_provider_id)
    `)
    .is('reviewed_at', null)
    .is('deleted_at', null)
    .order('collected_at', { ascending: false })
    .limit(limit);

  q = q.or('and(reference_low.not.is.null,value.lt.reference_low),and(reference_high.not.is.null,value.gt.reference_high)');
  if (filter === 'mine') q = q.eq('patients.primary_provider_id', userId);

  const { data } = await q;

  return (data ?? []).map((row: any) => {
    const v = Number(row.value);
    const rl = row.reference_low !== null ? Number(row.reference_low) : null;
    const rh = row.reference_high !== null ? Number(row.reference_high) : null;
    const isHigh = rh !== null && v > rh;
    const direction = isHigh ? 'high' : 'low';
    return {
      id: `lab_${row.id}`,
      type: 'abnormal_lab' as const,
      priority: 'critical' as const,
      priorityScore: PRIORITY_SCORES.abnormal_lab,
      title: `Abnormal ${labLabel(row.test_name)}: ${v.toFixed(2)} ${row.unit}`,
      description: `${direction === 'high' ? 'Above' : 'Below'} reference range (${rl ?? '—'}–${rh ?? '—'} ${row.unit}). Collected ${formatRelative(row.collected_at)}.`,
      href: `/app/patients/${row.patient_id}/labs?focus=${row.id}`,
      occurredAt: row.collected_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { test_name: row.test_name, value: v, direction, lab_id: row.id },
    };
  });
}

async function fetchUnreviewedLabs(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string, limit: number): Promise<InboxItem[]> {
  let q = supabase
    .from('lab_values')
    .select(`
      id, test_name, value, unit, reference_low, reference_high, collected_at,
      patient_id, patients!inner(id, first_name, last_name, mrn, primary_provider_id)
    `)
    .is('reviewed_at', null)
    .is('deleted_at', null)
    .order('collected_at', { ascending: false })
    .limit(limit);

  if (filter === 'mine') q = q.eq('patients.primary_provider_id', userId);

  const { data } = await q;

  return (data ?? [])
    .filter((row: any) => {
      const v = Number(row.value);
      const rl = row.reference_low !== null ? Number(row.reference_low) : null;
      const rh = row.reference_high !== null ? Number(row.reference_high) : null;
      return !((rh !== null && v > rh) || (rl !== null && v < rl));
    })
    .map((row: any) => ({
      id: `lab_${row.id}`,
      type: 'unreviewed_lab' as const,
      priority: 'normal' as const,
      priorityScore: PRIORITY_SCORES.unreviewed_lab,
      title: `${labLabel(row.test_name)}: ${Number(row.value).toFixed(2)} ${row.unit}`,
      description: `Within reference range. Collected ${formatRelative(row.collected_at)}.`,
      href: `/app/patients/${row.patient_id}/labs?focus=${row.id}`,
      occurredAt: row.collected_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { test_name: row.test_name, value: row.value, lab_id: row.id },
    }));
}

async function fetchUnsignedEncounters(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string, limit: number): Promise<InboxItem[]> {
  let q = supabase
    .from('encounters')
    .select(`
      id, encounter_type, status, started_at, scheduled_at, chief_complaint, provider_id,
      patients(id, first_name, last_name, mrn)
    `)
    .in('status', ['in_progress', 'pending_signature'])
    .is('deleted_at', null)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (filter === 'mine') q = q.eq('provider_id', userId);

  const { data } = await q;

  return (data ?? []).map((row: any) => {
    const occurred = row.started_at ?? row.scheduled_at ?? new Date().toISOString();
    const stalenessHours = (Date.now() - new Date(occurred).getTime()) / (1000 * 60 * 60);
    const score = stalenessHours > 48 ? PRIORITY_SCORES.unsigned_encounter + 10 : PRIORITY_SCORES.unsigned_encounter;
    return {
      id: `enc_${row.id}`,
      type: 'unsigned_encounter' as const,
      priority: toPriority(score),
      priorityScore: score,
      title: `Unsigned ${String(row.encounter_type).replace(/_/g, ' ')}`,
      description: `${row.chief_complaint ?? 'No chief complaint recorded'} · ${formatRelative(occurred)}`,
      href: `/app/encounters/${row.id}`,
      occurredAt: occurred,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { encounter_id: row.id, stale_hours: Math.round(stalenessHours) },
    };
  });
}

async function fetchReadyScribes(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string, limit: number): Promise<InboxItem[]> {
  let q = supabase
    .from('scribe_sessions')
    .select(`id, status, started_at, provider_id, patients(id, first_name, last_name, mrn)`)
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (filter === 'mine') q = q.eq('provider_id', userId);
  const { data } = await q;
  return (data ?? []).map((row: any) => ({
    id: `scribe_${row.id}`,
    type: 'ready_scribe' as const,
    priority: 'high' as const,
    priorityScore: PRIORITY_SCORES.ready_scribe,
    title: 'Scribe draft ready to review',
    description: `SOAP draft generated · ${formatRelative(row.started_at)}`,
    href: `/app/scribe/sessions/${row.id}`,
    occurredAt: row.started_at,
    patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
    metadata: { session_id: row.id },
  }));
}

async function fetchCgmAlerts(supabase: SupabaseClient, limit: number): Promise<InboxItem[]> {
  const { data } = await supabase
    .from('cgm_alerts')
    .select(`id, alert_type, severity, title, description, detected_at, patient_id, patients(id, first_name, last_name, mrn)`)
    .is('resolved_at', null)
    .order('severity', { ascending: false })
    .order('detected_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((row: any) => {
    const isCritical = row.severity === 'critical';
    const score = isCritical ? PRIORITY_SCORES.critical_cgm_alert : PRIORITY_SCORES.cgm_alert;
    return {
      id: `cgm_${row.id}`,
      type: (isCritical ? 'critical_cgm_alert' : 'cgm_alert') as InboxItemType,
      priority: toPriority(score),
      priorityScore: score,
      title: row.title,
      description: `${row.description ?? ''} · ${formatRelative(row.detected_at)}`,
      href: `/app/patients/${row.patient_id}#cgm`,
      occurredAt: row.detected_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { alert_id: row.id, alert_type: row.alert_type, severity: row.severity },
    };
  });
}

async function fetchArrivedAppts(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string): Promise<InboxItem[]> {
  let q = supabase
    .from('appointments')
    .select(`id, starts_at, status, arrived_at, appointment_type, reason, provider_id, patients(id, first_name, last_name, mrn)`)
    .eq('status', 'arrived')
    .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is('deleted_at', null);
  if (filter === 'mine') q = q.eq('provider_id', userId);
  const { data } = await q;
  return (data ?? []).map((row: any) => ({
    id: `appt_arrived_${row.id}`,
    type: 'arrived_waiting' as const,
    priority: 'critical' as const,
    priorityScore: PRIORITY_SCORES.arrived_waiting,
    title: 'Patient checked in, waiting',
    description: `${row.reason ?? String(row.appointment_type).replace(/_/g, ' ')} · arrived ${formatRelative(row.arrived_at ?? row.starts_at)}`,
    href: `/app/schedule/${row.id}`,
    occurredAt: row.arrived_at ?? row.starts_at,
    patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
    metadata: { appointment_id: row.id },
  }));
}

async function fetchUpcomingAppts(supabase: SupabaseClient, filter: 'mine' | 'all', userId: string): Promise<InboxItem[]> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  let q = supabase
    .from('appointments')
    .select(`id, starts_at, status, appointment_type, reason, provider_id, patients(id, first_name, last_name, mrn)`)
    .gte('starts_at', dayStart.toISOString())
    .lte('starts_at', dayEnd.toISOString())
    .in('status', ['scheduled', 'confirmed'])
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
    .limit(20);
  if (filter === 'mine') q = q.eq('provider_id', userId);
  const { data } = await q;
  return (data ?? []).map((row: any) => {
    const minutesUntil = (new Date(row.starts_at).getTime() - Date.now()) / 60000;
    const boost = minutesUntil > 0 && minutesUntil < 60 ? 15 : 0;
    return {
      id: `appt_upcoming_${row.id}`,
      type: 'upcoming_appointment' as const,
      priority: toPriority(PRIORITY_SCORES.upcoming_appointment + boost),
      priorityScore: PRIORITY_SCORES.upcoming_appointment + boost,
      title: `${new Date(row.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${String(row.appointment_type).replace(/_/g, ' ')}`,
      description: `${row.reason ?? 'No reason recorded'}`,
      href: `/app/schedule/${row.id}`,
      occurredAt: row.starts_at,
      patient: row.patients ? { id: row.patients.id, first_name: row.patients.first_name, last_name: row.patients.last_name, mrn: row.patients.mrn } : null,
      metadata: { appointment_id: row.id, status: row.status },
    };
  });
}

const LAB_LABELS: Record<string, string> = {
  a1c: 'A1C', fasting_glucose: 'Fasting glucose', random_glucose: 'Random glucose',
  ldl: 'LDL', hdl: 'HDL', triglycerides: 'Triglycerides', total_cholesterol: 'Total cholesterol',
  egfr: 'eGFR', creatinine: 'Creatinine', urine_acr: 'Urine ACR', tsh: 'TSH',
};
function labLabel(name: string): string { return LAB_LABELS[name] ?? name; }
function truncate(s: string, n: number): string { return s.length <= n ? s : s.slice(0, n - 1) + '…'; }
function formatRelative(iso: string | null): string {
  if (!iso) return 'unknown time';
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < -60) return `in ${Math.round(-min / 60)}h`;
  if (min < -1) return `in ${Math.round(-min)} min`;
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.round(min)} min ago`;
  const hrs = min / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
