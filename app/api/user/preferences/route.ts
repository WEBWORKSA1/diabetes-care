import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const PrefSchema = z.object({
  inbox_filter_default: z.enum(['mine', 'all']).optional(),
  inbox_layout: z.enum(['sections', 'unified']).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data } = await supabase
    .from('users')
    .select('inbox_filter_default, inbox_layout')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ preferences: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body;
  try {
    body = PrefSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update(body)
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
