import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled']).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  cancellation_reason: z.string().max(500).optional(),
  encounter_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients(id, first_name, last_name, mrn, phone_mobile, sms_consent, diabetes_type),
      provider:users!appointments_provider_id_fkey(id, full_name, credentials),
      encounter:encounters(id, status)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ appointment: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: (err as Error).message }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('appointments')
    .select('id, organization_id, patient_id, provider_id, starts_at, ends_at, status')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If time is changing, conflict check
  const newStart = body.starts_at ?? existing.starts_at;
  const newEnd = body.ends_at ?? existing.ends_at;
  if (body.starts_at || body.ends_at) {
    const { data: conflicts } = await supabase.rpc('check_appointment_conflict', {
      p_provider_id: existing.provider_id,
      p_starts_at: newStart,
      p_ends_at: newEnd,
      p_exclude_id: existing.id,
    });
    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Time slot conflicts', conflicts }, { status: 409 });
    }
  }

  const update: any = {};
  if (body.status) update.status = body.status;
  if (body.starts_at) update.starts_at = body.starts_at;
  if (body.ends_at) update.ends_at = body.ends_at;
  if (body.reason !== undefined) update.reason = body.reason;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.encounter_id !== undefined) update.encounter_id = body.encounter_id;

  // Status-driven timestamps
  const now = new Date().toISOString();
  if (body.status === 'arrived') update.arrived_at = now;
  if (body.status === 'in_progress') update.started_at = now;
  if (body.status === 'completed') update.completed_at = now;
  if (body.status === 'no_show') update.no_show_marked_at = now;
  if (body.status === 'cancelled') {
    update.cancelled_at = now;
    if (body.cancellation_reason) update.cancellation_reason = body.cancellation_reason;
  }

  const { error } = await supabase.from('appointments').update(update).eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On cancel: kill pending reminders
  if (body.status === 'cancelled') {
    const admin = createServiceClient();
    await admin
      .from('appointment_reminders')
      .update({ status: 'cancelled' })
      .eq('appointment_id', existing.id)
      .in('status', ['pending', 'queued']);
  }

  // On time change: cancel old reminders, re-queue
  if (body.starts_at || body.ends_at) {
    const admin = createServiceClient();
    await admin
      .from('appointment_reminders')
      .update({ status: 'cancelled' })
      .eq('appointment_id', existing.id)
      .in('status', ['pending', 'queued']);
    const { queueRemindersForAppointment } = await import('../route');
    await queueRemindersForAppointment(existing.id).catch(console.error);
  }

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'update',
    resourceType: 'appointment',
    resourceId: existing.id,
    patientId: existing.patient_id,
    metadata: update,
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/appointments/[id]
 * Soft-delete. Equivalent to status=cancelled for most purposes.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: existing } = await supabase
    .from('appointments')
    .select('id, organization_id, patient_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('appointments')
    .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createServiceClient();
  await admin
    .from('appointment_reminders')
    .update({ status: 'cancelled' })
    .eq('appointment_id', existing.id)
    .in('status', ['pending', 'queued']);

  await logAudit({
    organizationId: existing.organization_id,
    userId: user.id,
    action: 'soft_delete',
    resourceType: 'appointment',
    resourceId: existing.id,
    patientId: existing.patient_id,
  });

  return NextResponse.json({ ok: true });
}
