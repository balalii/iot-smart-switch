'use client';
import { CalendarClock, Link2, LoaderCircle, Power, PowerOff, SlidersHorizontal, Timer, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, cn, inputClass, Sheet, Switch } from '@/components/ui';
import { countdown, decimal, duration, kwh, rupiah } from '@/lib/format';
import type { ChannelView, DeviceView } from '@/lib/types';
import { useDevice } from './controller';

const TIMER_PRESETS = [5, 15, 30, 60, 120, 240];

// ubah state 1 channel di view lokal biar UI langsung responsif
export function withChannel(view: DeviceView, index: number, patch: Partial<ChannelView>): DeviceView {
  return { ...view, channels: view.channels.map((c) => (c.index === index ? { ...c, ...patch } : c)) };
}

export function ControlTab() {
  const { view, act } = useDevice();
  const [openChannel, setOpenChannel] = useState<number | null>(null);
  const visible = view.channels.filter((c) => c.visible);
  const onCount = visible.filter((c) => c.on).length;
  const todayKwh = view.channels.reduce((sum, c) => sum + kwh(c.watt, c.todayMs), 0);
  const toggles = visible.filter((c) => c.behavior === 'toggle');

  return (
    <div className="space-y-5">
      {!view.online && (
        <div className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-muted">
            <span className="font-medium text-ink">Perangkat sedang offline.</span> Perintah tetap disimpan dan
            dijalankan begitu ESP32 tersambung lagi.
          </p>
        </div>
      )}

      {/* ringkasan */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Sedang menyala</p>
          <p className="text-3xl font-semibold tracking-tight tabular">
            {onCount}
            <span className="text-lg text-muted"> / {visible.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Hari ini</p>
          <p className="font-medium tabular">
            {decimal(todayKwh, todayKwh < 1 ? 3 : 2)} kWh · {rupiah(todayKwh * view.tariff)}
          </p>
        </div>
      </div>

      {/* tombol cepat */}
      {toggles.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => act({ action: 'all', on: true })} disabled={toggles.every((c) => c.on)}>
            <Power className="size-4" /> Nyalakan semua
          </Button>
          <Button onClick={() => act({ action: 'all', on: false })} disabled={toggles.every((c) => !c.on)}>
            <PowerOff className="size-4" /> Matikan semua
          </Button>
        </div>
      )}

      {/* channel */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Semua channel disembunyikan. Tampilkan lagi lewat Pengaturan.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {visible.map((channel) => (
            <ChannelTile key={channel.index} channel={channel} onOpen={() => setOpenChannel(channel.index)} />
          ))}
        </div>
      )}

      {view.scenes.length > 0 && <SceneStrip />}

      <ChannelSheet index={openChannel} onClose={() => setOpenChannel(null)} />
    </div>
  );
}

function SceneStrip() {
  const { view, act, setTab } = useDevice();
  const [running, setRunning] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Skenario</h2>
        <button type="button" onClick={() => setTab('skenario')} className="cursor-pointer text-sm text-muted hover:text-ink">
          Atur
        </button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {view.scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            disabled={running !== null}
            onClick={async () => {
              setRunning(scene.id);
              await act({ action: 'scene-run', id: scene.id }, { success: `Skenario "${scene.name}" dijalankan` });
              setRunning(null);
            }}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface pr-4 pl-3 text-sm font-medium transition hover:border-accent disabled:opacity-60"
          >
            {running === scene.id ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Icon name={scene.icon} className="size-4 text-accent-ink" />
            )}
            {scene.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChannelTile({ channel, onOpen }: { channel: ChannelView; onOpen: () => void }) {
  const { view, now, act } = useDevice();
  const pulse = channel.behavior === 'pulse';
  const remaining = channel.timerEndsAt ? Date.parse(channel.timerEndsAt) - now : 0;
  const onFor = channel.onSince ? now - Date.parse(channel.onSince) : 0;

  const press = () => {
    const next = pulse ? true : !channel.on;
    act(
      { action: 'set', channel: channel.index, on: next },
      {
        optimistic: (v) =>
          withChannel(v, channel.index, {
            on: next,
            onSince: next ? new Date(now).toISOString() : null,
            timerEndsAt: pulse ? new Date(now + channel.pulseSec * 1000).toISOString() : next ? channel.timerEndsAt : null,
            synced: !view.online,
          }),
      },
    );
  };

  let status = 'Mati';
  if (pulse) status = channel.on ? `Aktif · ${Math.max(0, Math.ceil(remaining / 1000))} dtk` : 'Tekan sesaat';
  else if (channel.on) status = `Menyala · ${duration(onFor)}`;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-1.5 transition-colors duration-300',
        channel.on ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface shadow-card',
      )}
    >
      <button
        type="button"
        onClick={press}
        aria-pressed={pulse ? undefined : channel.on}
        aria-label={`${channel.name}: ${pulse ? 'tekan' : channel.on ? 'matikan' : 'nyalakan'}`}
        className="flex min-h-36 cursor-pointer flex-col items-start rounded-xl p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-40 sm:p-3"
      >
        <div className="flex w-full items-start justify-between">
          <span
            className={cn(
              'grid size-11 place-items-center rounded-xl transition-colors duration-300',
              channel.on ? 'bg-accent text-on-accent shadow-[0_0_24px_-4px_var(--accent)]' : 'bg-surface-2 text-muted',
            )}
          >
            <Icon name={channel.icon} className="size-5" />
          </span>
          {/* LED indikator, kayak di saklar fisik */}
          <span
            className={cn(
              'mt-1 mr-1 size-2.5 rounded-full transition',
              channel.on ? 'bg-accent shadow-[0_0_10px_2px_var(--accent)]' : 'bg-line',
            )}
          />
        </div>
        <span className="mt-auto pt-4 text-[11px] font-medium tracking-wider text-muted uppercase">
          CH{channel.index + 1}
        </span>
        <span className="line-clamp-2 leading-snug font-semibold">{channel.name}</span>
        <span className="mt-0.5 text-sm text-muted tabular">{status}</span>
      </button>

      <div className="flex min-h-9 items-center gap-1 px-1.5 pb-0.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {channel.timerReason === 'timer' && remaining > 0 && (
            <Chip>
              <Timer className="size-3" /> {countdown(remaining)}
            </Chip>
          )}
          {channel.scheduled && (
            <Chip>
              <CalendarClock className="size-3" /> Jadwal
            </Chip>
          )}
          {channel.interlock > 0 && (
            <Chip title="Interlock: tidak bisa nyala bersamaan dengan channel lain di grup ini">
              <Link2 className="size-3" /> {channel.interlock === 1 ? 'A' : 'B'}
            </Chip>
          )}
          {!channel.synced && (
            <Chip title="Menunggu ESP32 menjalankan perintah">
              <LoaderCircle className="size-3 animate-spin" /> Sinkron
            </Chip>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Timer & detail ${channel.name}`}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-6 items-center gap-1 rounded-full bg-surface/80 px-2 text-[11px] font-medium text-ink tabular ring-1 ring-line"
    >
      {children}
    </span>
  );
}

function ChannelSheet({ index, onClose }: { index: number | null; onClose: () => void }) {
  const { view, now, act, setTab } = useDevice();
  const [custom, setCustom] = useState('');
  const channel = index === null ? null : view.channels.find((c) => c.index === index);

  if (!channel) return null;

  const pulse = channel.behavior === 'pulse';
  const remaining = channel.timerReason === 'timer' && channel.timerEndsAt ? Date.parse(channel.timerEndsAt) - now : 0;
  const related = view.schedules.filter((s) => s.channels.includes(channel.index));
  const todayKwh = kwh(channel.watt, channel.todayMs);

  const startTimer = async (minutes: number) => {
    const ok = await act(
      { action: 'timer', channel: channel.index, minutes },
      { success: `${channel.name} menyala ${minutes >= 60 ? `${minutes / 60} jam` : `${minutes} menit`}` },
    );
    if (ok) setCustom('');
  };

  return (
    <Sheet open onClose={onClose} title={channel.name}>
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
          <span
            className={cn(
              'grid size-12 place-items-center rounded-xl',
              channel.on ? 'bg-accent text-on-accent' : 'bg-surface text-muted',
            )}
          >
            <Icon name={channel.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{pulse ? 'Tekan sesaat' : channel.on ? 'Menyala' : 'Mati'}</p>
            <p className="text-sm text-muted">
              CH{channel.index + 1} · {channel.watt} W
              {pulse && ` · aktif ${channel.pulseSec} dtk`}
            </p>
          </div>
          {pulse ? (
            <Button variant="primary" onClick={() => act({ action: 'set', channel: channel.index, on: true })}>
              Tekan
            </Button>
          ) : (
            <Switch
              checked={channel.on}
              label={`Nyalakan ${channel.name}`}
              onChange={(on) =>
                act({ action: 'set', channel: channel.index, on }, { optimistic: (v) => withChannel(v, channel.index, { on }) })
              }
            />
          )}
        </div>

        {!pulse && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Timer: nyalakan selama</h3>
              {remaining > 0 && (
                <Button size="sm" variant="danger" onClick={() => act({ action: 'timer', channel: channel.index, minutes: 0 })}>
                  <X className="size-4" /> Batalkan
                </Button>
              )}
            </div>
            {remaining > 0 && (
              <div className="mb-3 rounded-2xl border border-accent/50 bg-accent-soft p-4 text-center">
                <p className="font-mono text-4xl font-semibold tracking-tight tabular">{countdown(remaining)}</p>
                <p className="mt-1 text-sm text-muted">lagi sebelum mati otomatis</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {TIMER_PRESETS.map((minutes) => (
                <Button key={minutes} onClick={() => startTimer(minutes)}>
                  {minutes >= 60 ? `${minutes / 60} jam` : `${minutes} mnt`}
                </Button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const minutes = parseInt(custom, 10);
                if (minutes > 0) startTimer(Math.min(minutes, 1440));
              }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                placeholder="Menit lain…"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className={inputClass}
                aria-label="Durasi timer dalam menit"
              />
              <Button type="submit" variant="primary" disabled={!(parseInt(custom, 10) > 0)}>
                Mulai
              </Button>
            </form>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-line p-3">
            <p className="text-muted">Nyala hari ini</p>
            <p className="mt-0.5 font-semibold tabular">{duration(channel.todayMs)}</p>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-muted">Energi hari ini</p>
            <p className="mt-0.5 font-semibold tabular">
              {decimal(todayKwh, 3)} kWh · {rupiah(todayKwh * view.tariff)}
            </p>
          </div>
        </section>

        <section className="text-sm">
          <h3 className="mb-2 font-semibold">Jadwal untuk channel ini</h3>
          {related.length === 0 ? (
            <p className="text-muted">Belum ada jadwal.</p>
          ) : (
            <ul className="space-y-1.5">
              {related.map((s) => (
                <li key={s.id} className={cn('flex justify-between gap-3', !s.enabled && 'text-muted line-through')}>
                  <span className="truncate">{s.label || 'Jadwal'}</span>
                  <span className="font-mono tabular">
                    {s.onTime}–{s.offTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {channel.maxOnMin > 0 && (
            <p className="mt-3 text-muted">Batas aman: mati otomatis setelah {channel.maxOnMin} menit menyala.</p>
          )}
        </section>

        <Button
          className="w-full"
          onClick={() => {
            onClose();
            setTab('pengaturan');
          }}
        >
          <SlidersHorizontal className="size-4" /> Ubah nama, ikon & perilaku
        </Button>
      </div>
    </Sheet>
  );
}
