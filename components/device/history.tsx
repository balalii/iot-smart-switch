'use client';
import {
  CalendarClock,
  Cpu,
  Hand,
  History,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Timer,
  Trash2,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, cn, Empty } from '@/components/ui';
import { clock, dayLabel } from '@/lib/format';
import type { DeviceView, LogView } from '@/lib/types';
import { useDevice } from './controller';

const SOURCES: Record<string, { label: string; icon: LucideIcon }> = {
  ui: { label: 'Aplikasi', icon: Smartphone },
  jadwal: { label: 'Jadwal', icon: CalendarClock },
  timer: { label: 'Timer', icon: Timer },
  tombol: { label: 'Tombol fisik', icon: Hand },
  skenario: { label: 'Skenario', icon: Sparkles },
  perangkat: { label: 'ESP32', icon: Cpu },
  sistem: { label: 'Sistem', icon: ShieldAlert },
  admin: { label: 'Admin', icon: UserCog },
};

type Filter = 'semua' | 'perangkat' | number;

export function HistoryTab() {
  const { view, act } = useDevice();
  const [logs, setLogs] = useState<LogView[]>(view.logs);
  const [filter, setFilter] = useState<Filter>('semua');

  // riwayat lengkap (300 terakhir) diambil terpisah, nggak ikut polling utama
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/devices/${view.id}?logs=300`, { cache: 'no-store' });
        if (res.ok && alive) setLogs(((await res.json()) as DeviceView).logs);
      } catch {}
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [view.id]);

  const shown = logs.filter((log) => {
    if (filter === 'semua') return true;
    if (filter === 'perangkat') return log.channel === null;
    return log.channel === filter;
  });

  const groups: { day: string; items: LogView[] }[] = [];
  for (const log of shown) {
    const day = dayLabel(log.at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(log);
    else groups.push({ day, items: [log] });
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'semua', label: 'Semua' },
    ...view.channels.map((c) => ({ key: c.index as Filter, label: c.name })),
    { key: 'perangkat', label: 'Perangkat' },
  ];

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {filters.map((f) => (
          <button
            key={String(f.key)}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-sm font-medium transition',
              filter === f.key ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:text-ink',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Empty icon={<History className="size-5" />} title="Belum ada riwayat" />
      ) : (
        groups.map((group) => (
          <section key={group.day}>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{group.day}</h2>
            <ol className="rounded-2xl border border-line bg-surface shadow-card">
              {group.items.map((log) => {
                const source = SOURCES[log.source] ?? SOURCES.sistem;
                const SourceIcon = source.icon;
                return (
                  <li key={log.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                      <SourceIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{log.message}</p>
                      <p className="mt-0.5 text-xs text-muted">{source.label}</p>
                    </div>
                    <time className="shrink-0 font-mono text-xs text-muted tabular">{clock(log.at)}</time>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {logs.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (window.confirm('Hapus semua riwayat aktivitas?')) {
                if (await act({ action: 'logs-clear' }, { success: 'Riwayat dibersihkan' })) setLogs([]);
              }
            }}
          >
            <Trash2 className="size-4" /> Bersihkan riwayat
          </Button>
        </div>
      )}
    </div>
  );
}
