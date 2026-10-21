'use client';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, Card, cn, inputClass } from '@/components/ui';
import { decimal, duration, kwh, rupiah, shortDate } from '@/lib/format';
import { useDevice } from './controller';

// tiap channel beda kepekatan warna aksen, biar tetap satu nuansa dengan perangkat
const SHADES = [1, 0.7, 0.45, 0.25];

export function EnergyTab() {
  const { view, act } = useDevice();
  const [tariff, setTariff] = useState(String(view.tariff));
  const channels = view.channels;

  const todayKwh = channels.map((c) => kwh(c.watt, c.todayMs));
  const totalToday = todayKwh.reduce((a, b) => a + b, 0);
  const days = view.week.map((d) => ({
    date: d.date,
    kwh: d.ms.map((ms, i) => kwh(channels[i]?.watt ?? 0, ms)),
  }));
  const weekTotal = days.reduce((sum, d) => sum + d.kwh.reduce((a, b) => a + b, 0), 0);
  const maxDay = Math.max(0.001, ...days.map((d) => d.kwh.reduce((a, b) => a + b, 0)));
  const monthEstimate = (weekTotal / 7) * 30;
  const tariffDirty = Number(tariff) !== view.tariff;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Hari ini" value={`${decimal(totalToday, 2)} kWh`} sub={rupiah(totalToday * view.tariff)} />
        <Stat label="7 hari" value={`${decimal(weekTotal, 2)} kWh`} sub={rupiah(weekTotal * view.tariff)} />
        <Stat
          className="col-span-2 sm:col-span-1"
          label="Perkiraan sebulan"
          value={rupiah(monthEstimate * view.tariff)}
          sub={`${decimal(monthEstimate, 1)} kWh, dari rata-rata 7 hari`}
        />
      </div>

      <Card title="7 hari terakhir" description="Energi per hari, ditumpuk per channel.">
        <div className="flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Grafik energi 7 hari terakhir">
          {days.map((day, i) => {
            const total = day.kwh.reduce((a, b) => a + b, 0);
            return (
              <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] text-muted tabular">{total > 0 ? decimal(total, 2) : ''}</span>
                <div
                  className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md bg-surface-2"
                  style={{ height: `${Math.max(2, (total / maxDay) * 100)}%` }}
                  title={`${shortDate(day.date)}: ${decimal(total, 3)} kWh`}
                >
                  {day.kwh.map((value, ch) =>
                    value > 0 ? (
                      <div
                        key={ch}
                        className="w-full bg-accent"
                        style={{ height: `${(value / Math.max(total, 0.0001)) * 100}%`, opacity: SHADES[ch] }}
                      />
                    ) : null,
                  )}
                </div>
                <span className={cn('text-xs', i === 6 ? 'font-semibold text-ink' : 'text-muted')}>
                  {i === 6 ? 'Ini' : shortDate(day.date)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {channels.map((c) => (
            <span key={c.index} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2.5 rounded-sm bg-accent" style={{ opacity: SHADES[c.index] }} />
              {c.name}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Per channel hari ini">
        <ul className="divide-y divide-line">
          {channels.map((c, i) => (
            <li key={c.index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <Icon name={c.icon} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted tabular">
                  {c.watt} W · nyala {duration(c.todayMs)}
                </p>
              </div>
              <div className="text-right text-sm tabular">
                <p className="font-medium">{decimal(todayKwh[i], 3)} kWh</p>
                <p className="text-xs text-muted">{rupiah(todayKwh[i] * view.tariff)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Ini perkiraan dari daya (watt) × lama menyala, bukan hasil ukur meteran. Atur watt tiap channel di
          Pengaturan.
        </p>
      </Card>

      <Card title="Tarif listrik" description="Rupiah per kWh. Default: tarif PLN rumah tangga 1.300 VA ke atas.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act({ action: 'device-config', config: { tariff: Number(tariff) } }, { success: 'Tarif disimpan' });
          }}
        >
          <div className="relative flex-1">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">Rp</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className={cn(inputClass, 'pl-9 tabular')}
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
              aria-label="Tarif per kWh"
            />
          </div>
          <Button type="submit" variant="primary" disabled={!tariffDirty || tariff === ''}>
            Simpan
          </Button>
        </form>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (window.confirm('Hapus semua statistik pemakaian perangkat ini?')) {
              act({ action: 'usage-reset' }, { success: 'Statistik direset' });
            }
          }}
        >
          <RotateCcw className="size-4" /> Reset statistik
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, className }: { label: string; value: string; sub: string; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-card', className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-0.5 text-xs text-muted tabular">{sub}</p>
    </div>
  );
}
