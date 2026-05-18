import Link from 'next/link';
import { Lock, User, Users, CreditCard, Shield, FileText } from 'lucide-react';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your practice, account, and security.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <SettingCard href="/app/settings/sign-pin" icon={Lock} title="Sign PIN" description="Set or change the PIN used to sign encounters." status="active" />
        <SettingCard href="/app/settings/profile" icon={User} title="Profile" description="Name, credentials, NPI, contact info." status="coming" />
        <SettingCard href="/app/settings/team" icon={Users} title="Team" description="Invite and manage providers and staff." status="coming" />
        <SettingCard href="/app/settings/billing" icon={CreditCard} title="Billing" description="Subscription, invoices, payment method." status="coming" />
        <SettingCard href="/app/settings/security" icon={Shield} title="Security" description="HIPAA compliance, audit log, sessions." status="coming" />
        <SettingCard href="/app/settings/templates" icon={FileText} title="SOAP templates" description="Customize charting templates for your practice." status="coming" />
      </div>
    </div>
  );
}

function SettingCard({ href, icon: Icon, title, description, status }: { href: string; icon: any; title: string; description: string; status: 'active' | 'coming' }) {
  const Component = status === 'active' ? Link : 'div';
  const props = status === 'active' ? { href } : {};
  return (
    <Component {...(props as any)} className={`block bg-card rounded-2xl border border-border p-5 transition-colors ${status === 'active' ? 'hover:border-foreground/30 cursor-pointer' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="p-2 rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        {status === 'coming' && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Sprint 7</span>
        )}
      </div>
      <div className="font-display text-lg">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </Component>
  );
}
