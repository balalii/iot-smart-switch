'use client';
import { CalendarClock, ChartColumn, History, LayoutGrid, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { Icon } from '@/components/icons';
import { Button, cn, ToastProvider, useTheme } from '@/components/ui';
import { ago, signal } from '@/lib/format';
import type { DeviceView } from '@/lib/types';
import { ControlTab } from './control';
import { DeviceProvider, useDevice, type TabKey } from './controller';
import { EnergyTab } from './energy';
import { HistoryTab } from './history';
import { ScenesTab } from './scenes';
import { SchedulesTab } from './schedules';
import { SettingsTab } from './settings';
import { findTemplate } from '@/lib/catalog';

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'kontrol', label: 'Kontrol', icon: LayoutGrid },
  { key: 'jadwal', label: 'Jadwal', icon: CalendarClock },
  { key: 'skenario', label: 'Skenario', icon: Sparkles },
  { key: 'energi', label: 'Energi', icon: ChartColumn },
  { key: 'riwayat', label: 'Riwayat', icon: History },
];

const SETTINGS_TAB = { key: 'pengaturan' as const, label: 'Pengaturan', icon: Settings };

export function DeviceApp({ initial, isAdmin }: { initial: DeviceView; isAdmin: boolean }) {
  return (
    <ToastProvider>
      <DeviceProvider initial={initial} isAdmin={isAdmin}>
        <Shell />
      </DeviceProvider>
    </ToastProvider>
  );
}

function Shell() {
  const { view, tab, setTab } = useDevice();

  return (
    <div data-accent={view.accent} className="min-h-dvh lg:flex">
      {/* sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex">
        <Identity />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Menu perangkat">
          {[...TABS, SETTINGS_TAB].map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={cn(
                'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                tab === key ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <TabIcon className={cn('size-[18px]', tab === key && 'text-accent-ink')} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <StatusCard />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* header HP */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-lg lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Identity compact />
            </div>
            <ThemeButton />
            <Button
              variant={tab === 'pengaturan' ? 'primary' : 'ghost'}
              size="icon"
              onClick={() => setTab(tab === 'pengaturan' ? 'kontrol' : 'pengaturan')}
              aria-label="Pengaturan"
            >
              <Settings className="size-5" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
            <h1 className="text-2xl font-semibold tracking-tight">
              {[...TABS, SETTINGS_TAB].find((t) => t.key === tab)?.label}
            </h1>
            <ThemeButton />
          </div>
          <div key={tab} className="animate-rise">
            {tab === 'kontrol' && <ControlTab />}
            {tab === 'jadwal' && <SchedulesTab />}
            {tab === 'skenario' && <ScenesTab />}
            {tab === 'energi' && <EnergyTab />}
            {tab === 'riwayat' && <HistoryTab />}
            {tab === 'pengaturan' && <SettingsTab />}
          </div>
        </main>

        {/* bottom nav HP */}
        <nav
          aria-label="Menu perangkat"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {TABS.map(({ key, label, icon: TabIcon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={cn(
                  'flex h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                  tab === key ? 'text-ink' : 'text-muted',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-12 place-items-center rounded-full transition',
                    tab === key && 'bg-accent-soft text-accent-ink',
                  )}
                >
                  <TabIcon className="size-[18px]" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function Identity({ compact }: { compact?: boolean }) {
  const { view, now } = useDevice();
  const template = findTemplate(view.template);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          'grid shrink-0 place-items-center rounded-xl bg-accent text-on-accent',
          compact ? 'size-10' : 'size-12',
        )}
      >
        <Icon name={template.icon} className={compact ? 'size-5' : 'size-6'} />
      </div>
      <div className="min-w-0">
        <p className={cn('truncate font-semibold tracking-tight', compact ? 'text-base' : 'text-lg')}>{view.name}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted">
          <span
            className={cn('size-2 shrink-0 rounded-full', view.online ? 'animate-pulse-dot bg-ok' : 'bg-muted/50')}
          />
          {view.online ? 'Online' : `Offline · ${ago(view.lastSeen, now)}`}
          {view.owner && <span className="truncate">· {view.owner}</span>}
        </p>
      </div>
    </div>
  );
}

function StatusCard() {
  const { view, now } = useDevice();
  const sig = signal(view.rssi);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted">ESP32</span>
        <span className={cn('font-medium', view.online ? 'text-ok' : 'text-muted')}>
          {view.online ? 'Terhubung' : 'Terputus'}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-muted">Sinyal WiFi</span>
        <SignalBars bars={view.online ? sig.bars : 0} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-muted">Kabar terakhir</span>
        <span className="tabular">{ago(view.lastSeen, now)}</span>
      </div>
    </div>
  );
}

export function SignalBars({ bars }: { bars: number }) {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-label={`Sinyal ${bars} dari 4`}>
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={cn('w-1 rounded-sm', b <= bars ? 'bg-ink' : 'bg-line')}
          style={{ height: `${b * 25}%` }}
        />
      ))}
    </span>
  );
}

function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Tema terang' : 'Tema gelap'}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
