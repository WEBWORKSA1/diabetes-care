'use client';

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Section = { id: string; label: string; content?: string; prompt?: string; auto?: boolean; options?: string[] };
type SoapField = { sections: Section[] };

const COLOR_MAP = {
  green: { border: 'border-l-green-500', label: 'text-green-700 dark:text-green-300' },
  amber: { border: 'border-l-amber-500', label: 'text-amber-700 dark:text-amber-300' },
  red: { border: 'border-l-red-500', label: 'text-red-700 dark:text-red-300' },
  navy: { border: 'border-l-primary', label: 'text-primary' },
};

export function SoapSectionEditor({
  title,
  color,
  value,
  onChange,
  editable,
  extra,
}: {
  title: string;
  color: keyof typeof COLOR_MAP;
  value: SoapField;
  onChange: (v: SoapField) => void;
  editable: boolean;
  extra?: React.ReactNode;
}) {
  const colors = COLOR_MAP[color];
  const sections = value.sections ?? [];

  function updateSection(idx: number, content: string) {
    const next = { ...value, sections: sections.map((s, i) => (i === idx ? { ...s, content } : s)) };
    onChange(next);
  }

  function pickOption(idx: number, opt: string) {
    const s = sections[idx];
    const existing = s.content ?? '';
    updateSection(idx, existing ? `${existing}\n${opt}` : opt);
  }

  function addCustomSection() {
    const label = window.prompt('Section label:');
    if (!label) return;
    onChange({
      ...value,
      sections: [...sections, { id: `custom_${Date.now()}`, label, content: '' }],
    });
  }

  function removeSection(idx: number) {
    if (!confirm('Remove this section?')) return;
    onChange({ ...value, sections: sections.filter((_, i) => i !== idx) });
  }

  return (
    <section className={cn('bg-card rounded-2xl border border-border border-l-4', colors.border)}>
      <header className="px-6 pt-5 pb-3 flex items-center justify-between">
        <h2 className={cn('font-display text-xl', colors.label)}>{title}</h2>
        {editable && (
          <button
            onClick={addCustomSection}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add field
          </button>
        )}
      </header>
      <div className="px-6 pb-6 space-y-4">
        {sections.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            No template loaded. {editable && 'Click "Add field" to start.'}
          </div>
        ) : (
          sections.map((s, idx) => (
            <div key={s.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </label>
                {editable && s.id.startsWith('custom_') && (
                  <button onClick={() => removeSection(idx)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {s.options && editable && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {s.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => pickOption(idx, opt)}
                      className="text-xs px-2.5 py-1 rounded-full border border-input bg-background hover:bg-muted transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={s.content ?? ''}
                onChange={(e) => updateSection(idx, e.target.value)}
                disabled={!editable}
                placeholder={s.prompt ?? ''}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed resize-y min-h-[60px]"
              />
            </div>
          ))
        )}
        {extra}
      </div>
    </section>
  );
}
