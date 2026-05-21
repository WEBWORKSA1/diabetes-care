import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Patient messages' };

export default async function MessagesIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: messages } = await supabase
    .from('patient_messages')
    .select('id, subject, body, priority, sent_at, acknowledged_at, resolved_at, patients(id, first_name, last_name, mrn)')
    .is('resolved_at', null)
    .order('priority', { ascending: false })
    .order('sent_at', { ascending: false })
    .limit(100);

  const list = (messages ?? []) as any[];
  const urgent = list.filter((m) => m.priority === 'urgent');

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Patient messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {list.length} unresolved · {urgent.length} urgent
          </p>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border px-6 py-16 text-center">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-display text-lg">No messages</p>
          <p className="text-sm text-muted-foreground mt-1">All caught up. Messages from patients via the portal will appear here.</p>
        </div>
      ) : (
        <ul className="bg-card rounded-2xl border border-border divide-y divide-border">
          {list.map((m) => (
            <li key={m.id}>
              <Link href={`/app/messages/${m.id}`} className="block px-6 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  {m.priority === 'urgent' && (
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{m.patients?.last_name}, {m.patients?.first_name}</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">MRN {m.patients?.mrn}</span>
                      {m.priority === 'urgent' && (
                        <span className="clinical-badge clinical-badge-high text-[9px]">Urgent</span>
                      )}
                      {m.acknowledged_at && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300">✓ Acked</span>
                      )}
                    </div>
                    <div className="text-sm font-medium mt-1">{m.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.body}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                      {formatDateTime(m.sent_at)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
