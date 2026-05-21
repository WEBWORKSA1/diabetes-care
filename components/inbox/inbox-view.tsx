'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Inbox, AlertTriangle, AlertCircle, FlaskConical, FileSignature,
  Mic, Activity, UserCheck, CalendarClock, Check, Filter, Loader2,
  ChevronRight, CheckCheck
} from 'lucide-react';
import type { InboxItem, InboxCounts, InboxItemType, InboxItemPriority } from '@/lib/inbox/aggregator';

type Filter = 'mine' | 'all';
type Layout = 'sections' | 'unified';

const ICONS: Record<InboxItemType, any> = {
  abnormal_lab: AlertTriangle,
  unreviewed_lab: FlaskConical,
  unsigned_encounter: FileSignature,
  ready_scribe: Mic,
  critical_cgm_alert: AlertCircle,
  cgm_alert: Activity,
  arrived_waiting: UserCheck,
  upcoming_appointment: CalendarClock,
};

const SECTION_TITLES: Record<string, string> = {
  arrived_waiting: 'Patients waiting',
  critical_cgm_alert: 'Critical CGM alerts',
  abnormal_lab: 'Abnormal labs',
  ready_scribe: 'Scribe drafts ready',
  unsigned_encounter: 'Unsigned encounters',
  cgm_alert: 'CGM alerts',
  unreviewed_lab: 'Normal labs to review',
  upcoming_appointment: "Today's upcoming",
};

const SECTION_ORDER: InboxItemType[] = [
  'arrived_waiting',
  'critical_cgm_alert',
  'abnormal_lab',
  'ready_scribe',
  'unsigned_encounter',
  'cgm_alert',
  'unreviewed_lab',
  'upcoming_appointment',
];

export function InboxView({
  initialFilter,
  initialLayout,
  isOwner,
  hideUnified = false,
}: {
  initialFilter: Filter;
  initialLayout: Layout;
  isOwner: boolean;
  hideUnified?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inbox?filter=${filter}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setCounts(data.counts ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function changeFilter(f: Filter) {
    setFilter(f);
    setSelectedLabs(new Set());
    // Persist the preference
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox_filter_default: f }),
    }).catch(() => {});
  }

  async function changeLayout(l: Layout) {
    setLayout(l);
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox_layout: l }),
    }).catch(() => {});
  }

  async function reviewLab(item: InboxItem, action: 'acknowledged' | 'flagged' = 'acknowledged') {
    const labId = item.metadata?.lab_id;
    if (!labId) return;
    await fetch(`/api/labs/${labId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSelectedLabs((s) => { const n = new Set(s); n.delete(item.id); return n; });
  }

  async function bulkReview() {
    if (selectedLabs.size === 0) return;
    const labIds = items
      .filter((i) => selectedLabs.has(i.id) && i.metadata?.lab_id)
      .map((i) => i.metadata!.lab_id);
    if (labIds.length === 0) return;

    setBulkProcessing(true);
    try {
      const res = await fetch('/api/labs/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_ids: labIds, action: 'acknowledged' }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => !selectedLabs.has(i.id)));
        setSelectedLabs(new Set());
      }
    } finally {
      setBulkProcessing(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedLabs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // Group items by type for sectioned layout
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, InboxItem[]>);

  const selectableCount = items.filter((i) => i.type === 'unreviewed_lab' || i.type === 'abnormal_lab').length;

  return (
    <div className="space-y-6">
      {/* Tiles */}
      {counts && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Critical"
            value={counts.critical_total}
            sub={`${counts.critical_cgm_alerts} CGM · ${counts.unreviewed_abnormal_labs} labs`}
            tone="critical"
            icon={AlertCircle}
          />
          <Tile
            label="Unsigned encounters"
            value={filter === 'mine' ? counts.unsigned_encounters_mine : counts.unsigned_encounters}
            sub={filter === 'mine' ? 'mine' : 'practice-wide'}
            tone={(filter === 'mine' ? counts.unsigned_encounters_mine : counts.unsigned_encounters) > 0 ? 'warn' : 'normal'}
            icon={FileSignature}
          />
          <Tile
            label="Scribe drafts"
            value={counts.ready_scribe_drafts}
            sub="ready to review"
            tone={counts.ready_scribe_drafts > 0 ? 'warn' : 'normal'}
            icon={Mic}
          />
          <Tile
            label="Today's visits"
            value={counts.today_appointments}
            sub={counts.waiting_room_count > 0 ? `${counts.waiting_room_count} waiting` : 'scheduled'}
            tone={counts.waiting_room_count > 0 ? 'critical' : 'normal'}
            icon={CalendarClock}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => changeFilter('mine')}
            className={`h-8 px-3 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${filter === 'mine' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
          >
            My patients
          </button>
          <button
            onClick={() => changeFilter('all')}
            className={`h-8 px-3 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
          >
            Practice-wide
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedLabs.size > 0 && (
            <button
              onClick={bulkReview}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Acknowledge {selectedLabs.size} lab{selectedLabs.size === 1 ? '' : 's'}
            </button>
          )}
          {!hideUnified && (
            <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <button
                onClick={() => changeLayout('sections')}
                className={`h-7 px-2 rounded ${layout === 'sections' ? 'bg-muted text-foreground' : 'hover:text-foreground'}`}
              >
                Sections
              </button>
              <span>/</span>
              <button
                onClick={() => changeLayout('unified')}
                className={`h-7 px-2 rounded ${layout === 'unified' ? 'bg-muted text-foreground' : 'hover:text-foreground'}`}
              >
                Unified
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading inbox…</span>
        </div>
      ) : items.length === 0 ? (
        <section className="bg-card rounded-2xl border border-border px-6 py-16 text-center">
          <Check className="h-10 w-10 mx-auto text-green-600 dark:text-green-400 mb-3" />
          <p className="font-display text-xl">Inbox zero</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'mine' ? 'No items requiring your attention.' : 'Nothing pending across the practice.'}
          </p>
        </section>
      ) : layout === 'unified' ? (
        <section className="bg-card rounded-2xl border border-border">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <InboxRow key={item.id} item={item} onReview={reviewLab} selected={selectedLabs.has(item.id)} onToggleSelect={toggleSelect} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="space-y-5">
          {SECTION_ORDER.filter((t) => grouped[t]?.length > 0).map((type) => (
            <section key={type} className="bg-card rounded-2xl border border-border">
              <header className="px-6 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SectionIcon type={type} />
                  <h3 className="font-display text-base">{SECTION_TITLES[type]}</h3>
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{grouped[type].length}</span>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {grouped[type].map((item) => (
                  <InboxRow key={item.id} item={item} onReview={reviewLab} selected={selectedLabs.has(item.id)} onToggleSelect={toggleSelect} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone, icon: Icon }: { label: string; value: number; sub: string; tone: 'critical' | 'warn' | 'normal'; icon: any }) {
  const toneClasses = {
    critical: value > 0 ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30' : '',
    warn: value > 0 ? 'border-amber-300 dark:border-amber-800' : '',
    normal: '',
  }[tone];
  const iconColor = {
    critical: value > 0 ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-muted text-muted-foreground',
    warn: value > 0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground',
    normal: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <div className={`bg-card rounded-2xl border ${toneClasses || 'border-border'} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mt-0.5">{sub}</div>
    </div>
  );
}

function SectionIcon({ type }: { type: string }) {
  const I = ICONS[type as InboxItemType];
  if (!I) return null;
  const color =
    type === 'critical_cgm_alert' || type === 'arrived_waiting' ? 'text-red-600 dark:text-red-400' :
    type === 'abnormal_lab' ? 'text-amber-600 dark:text-amber-400' :
    type === 'ready_scribe' ? 'text-accent' :
    'text-muted-foreground';
  return <I className={`h-4 w-4 ${color}`} />;
}

function InboxRow({
  item,
  onReview,
  selected,
  onToggleSelect,
}: {
  item: InboxItem;
  onReview: (item: InboxItem, action?: 'acknowledged' | 'flagged') => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const Icon = ICONS[item.type] ?? Inbox;
  const isLab = item.type === 'unreviewed_lab' || item.type === 'abnormal_lab';
  const isCritical = item.priority === 'critical';
  const accent =
    item.priority === 'critical' ? 'border-l-red-500' :
    item.priority === 'high' ? 'border-l-amber-500' :
    item.priority === 'normal' ? 'border-l-primary/30' :
    'border-l-transparent';

  return (
    <li className={`border-l-2 ${accent} hover:bg-muted/30 transition-colors`}>
      <div className="px-6 py-3 flex items-center gap-3">
        {isLab && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            className="rounded shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${isCritical ? 'text-red-600' : item.priority === 'high' ? 'text-amber-600' : 'text-muted-foreground'}`} />

        <Link href={item.href} className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">
                {item.patient ? (
                  <span>
                    <span className="text-foreground">{item.patient.last_name}, {item.patient.first_name}</span>
                    <span className="text-muted-foreground font-mono ml-2 text-[11px]">MRN {item.patient.mrn}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">No patient</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                <span className="text-foreground">{item.title}</span>
                <span className="mx-1.5">·</span>
                {item.description}
              </div>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLab && (
            <button
              onClick={(e) => { e.stopPropagation(); onReview(item, 'acknowledged'); }}
              className="h-7 px-2.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-input bg-card hover:bg-muted transition-colors"
              title="Mark as reviewed"
            >
              <Check className="h-3 w-3" />
            </button>
          )}
          <Link
            href={item.href}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </li>
  );
}
