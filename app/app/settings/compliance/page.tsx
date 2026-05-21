import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, CheckCircle2, Circle, AlertCircle, ExternalLink } from 'lucide-react';

export const metadata = { title: 'Compliance' };

const CHECKLIST = [
  // Phase 1
  { category: 'risk_assessment', key: 'engage_hipaa_service', label: 'Engaged HIPAA support service', help: 'Accountable HQ, Compliancy Group, or comparable.' },
  { category: 'risk_assessment', key: 'sra_complete', label: 'Risk Assessment (SRA) complete', help: 'Documented in writing. Annual refresh.' },
  { category: 'administrative', key: 'privacy_officer_designated', label: 'Privacy Officer designated', help: 'In writing. Solo founders: yourself.' },
  { category: 'administrative', key: 'security_officer_designated', label: 'Security Officer designated', help: 'In writing. May be same person as Privacy Officer.' },
  { category: 'administrative', key: 'cyber_insurance', label: 'Cyber liability + E&O insurance quoted', help: '$1M per occurrence / aggregate is standard.' },
  // BAAs
  { category: 'baa', key: 'baa_supabase', label: 'Supabase BAA signed', help: 'Team plan required.' },
  { category: 'baa', key: 'baa_anthropic', label: 'Anthropic BAA signed', help: 'Enterprise tier required.' },
  { category: 'baa', key: 'baa_openai', label: 'OpenAI ZDR BAA signed (or removed)', help: 'Enterprise ZDR or swap for self-hosted Whisper.' },
  { category: 'baa', key: 'baa_twilio', label: 'Twilio BAA signed', help: 'Required for SMS to patients.' },
  { category: 'baa', key: 'baa_vercel', label: 'Vercel HIPAA add-on enabled', help: 'Pro + HIPAA add-on. Required before deploy with real PHI.' },
  { category: 'baa', key: 'baa_dexcom', label: 'Dexcom partner agreement', help: '4–12 weeks to approve.' },
  // Policies
  { category: 'administrative', key: 'policy_privacy', label: 'Privacy policy written', help: 'See docs/hipaa/04-policies.md template.' },
  { category: 'administrative', key: 'policy_security', label: 'Security policy written', help: 'Administrative, physical, technical safeguards.' },
  { category: 'administrative', key: 'policy_breach', label: 'Breach notification policy written', help: 'See docs/hipaa/06-breach-notification-protocol.md.' },
  { category: 'administrative', key: 'policy_access', label: 'Access control + termination policy written', help: '' },
  { category: 'administrative', key: 'policy_audit', label: 'Audit + monitoring policy written', help: '' },
  { category: 'administrative', key: 'policy_training', label: 'Workforce training policy written', help: '' },
  { category: 'administrative', key: 'policy_dr', label: 'Contingency / disaster recovery plan written', help: '' },
  { category: 'administrative', key: 'policy_sanction', label: 'Sanction policy written', help: '' },
  // Technical
  { category: 'technical', key: 'encryption_rest', label: 'Encryption at rest verified', help: 'Supabase native + storage.' },
  { category: 'technical', key: 'encryption_transit', label: 'Encryption in transit verified', help: 'TLS 1.2+ everywhere, HSTS on.' },
  { category: 'technical', key: 'audit_logging_active', label: 'Audit logging active and reviewed monthly', help: 'audit_log table; document retention (6 years).' },
  { category: 'technical', key: 'backup_restore_tested', label: 'Backup restore tested end-to-end', help: 'Run a test once a year.' },
  { category: 'technical', key: 'cgm_key_documented', label: 'CGM_TOKEN_ENCRYPTION_KEY rotation documented', help: 'Annual rotation minimum.' },
  { category: 'technical', key: 'session_timeout', label: 'Provider + portal session timeouts confirmed', help: 'Portal: 24h sliding. Provider: TBD.' },
  { category: 'technical', key: 'pentest_run', label: 'Penetration test run', help: '$3K–$8K. Required before customer #2.' },
  { category: 'technical', key: 'vuln_scanning', label: 'Vulnerability scanning enabled', help: 'GitHub Dependabot or Snyk on repo.' },
  // Training + ops
  { category: 'training', key: 'training_delivered', label: 'Workforce training delivered', help: 'See docs/hipaa/05-workforce-training.md.' },
  { category: 'training', key: 'training_sign_off', label: 'Training sign-off logged', help: 'Document date + acknowledgement.' },
  { category: 'breach_plan', key: 'incident_runbook_pinned', label: 'Incident runbook internalized', help: 'docs/hipaa/06-breach-notification-protocol.md.' },
  { category: 'breach_plan', key: 'tabletop_exercise', label: 'Tabletop breach exercise run', help: '1-hour simulation. Document.' },
];

const CATEGORY_LABELS: Record<string, string> = {
  risk_assessment: 'Risk assessment',
  administrative: 'Administrative safeguards',
  physical: 'Physical safeguards',
  technical: 'Technical safeguards',
  baa: 'Business Associate Agreements',
  training: 'Workforce training',
  breach_plan: 'Breach response',
};

export default async function CompliancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, organization_id, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  // Owner-only view: anyone can see, only owner can edit
  const { data: items } = await supabase
    .from('compliance_items')
    .select('item_key, status, completed_at, notes')
    .eq('organization_id', profile.organization_id);

  const itemMap = new Map((items ?? []).map((i: any) => [i.item_key, i]));
  const completed = (items ?? []).filter((i: any) => i.status === 'complete').length;
  const pct = Math.round((completed / CHECKLIST.length) * 100);

  const byCategory: Record<string, typeof CHECKLIST> = {};
  for (const item of CHECKLIST) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  return (
    <div className="space-y-6">
      <Link href="/app/settings" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Settings
      </Link>

      <header className="space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="font-display text-3xl tracking-tight">HIPAA compliance</h1>
        <p className="text-sm text-muted-foreground">
          Track every step on the way to processing real PHI. This is a working checklist, not legal advice. Engage a HIPAA support service.
        </p>
      </header>

      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Readiness</div>
            <div className="font-display text-3xl tabular-nums mt-1">
              {completed} <span className="text-muted-foreground text-xl">/ {CHECKLIST.length}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl tabular-nums">{pct}%</div>
            <div className="text-xs text-muted-foreground">complete</div>
          </div>
        </div>
        <div className="h-2 bg-muted/40 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct < 100 && (
          <div className="mt-4 text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Not ready for real PHI.</strong> Finish the checklist before connecting any actual patient data. Demo and synthetic data are fine.
            </span>
          </div>
        )}
      </section>

      {Object.entries(byCategory).map(([cat, list]) => (
        <section key={cat} className="bg-card rounded-2xl border border-border overflow-hidden">
          <header className="px-5 py-3 border-b border-border">
            <h2 className="font-display text-lg">{CATEGORY_LABELS[cat] ?? cat}</h2>
          </header>
          <ul className="divide-y divide-border">
            {list.map((item) => {
              const existing = itemMap.get(item.key);
              const done = (existing as any)?.status === 'complete';
              return (
                <li key={item.key} className="px-5 py-3 flex items-start gap-3">
                  <ToggleButton
                    itemKey={item.key}
                    label={item.label}
                    category={cat}
                    done={done}
                    isOwner={profile.role === 'owner'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{item.label}</div>
                    {item.help && <div className="text-xs text-muted-foreground mt-0.5">{item.help}</div>}
                    {(existing as any)?.completed_at && (
                      <div className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-300 mt-0.5">
                        ✓ {new Date((existing as any).completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="bg-muted/30 rounded-2xl p-5 space-y-3">
        <h2 className="font-display text-lg">Reference documents</h2>
        <p className="text-sm text-muted-foreground">
          Working documents live in the repo under <code className="text-xs font-mono bg-card px-1.5 py-0.5 rounded">docs/hipaa/</code>.
        </p>
        <ul className="space-y-1 text-sm">
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/01-readiness-checklist.md" label="Readiness checklist" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/02-baa-tracker.md" label="BAA tracker" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/03-risk-assessment-template.md" label="Risk Assessment template" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/04-policies.md" label="Policy templates (8)" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/05-workforce-training.md" label="Workforce training outline" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/06-breach-notification-protocol.md" label="Breach notification protocol" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/07-vendor-due-diligence.md" label="Vendor due diligence" /></li>
          <li><DocLink href="https://github.com/WEBWORKSA1/diabetes-care/blob/main/docs/hipaa/08-cost-estimate.md" label="Year-1 cost estimate" /></li>
        </ul>
      </section>
    </div>
  );
}

function ToggleButton({ itemKey, label, category, done, isOwner }: { itemKey: string; label: string; category: string; done: boolean; isOwner: boolean }) {
  if (!isOwner) {
    return done ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />;
  }
  return (
    <form action={`/api/compliance/toggle`} method="POST">
      <input type="hidden" name="item_key" value={itemKey} />
      <input type="hidden" name="label" value={label} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="set_to" value={done ? 'not_started' : 'complete'} />
      <button type="submit" className="shrink-0 mt-0.5" title={done ? 'Mark not done' : 'Mark complete'}>
        {done ? <CheckCircle2 className="h-5 w-5 text-green-600 hover:text-green-700" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />}
      </button>
    </form>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted-foreground">
      <ExternalLink className="h-3 w-3" /> {label}
    </a>
  );
}
