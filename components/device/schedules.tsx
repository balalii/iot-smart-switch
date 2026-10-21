'use client';
import { CalendarClock, Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, Card, cn, Empty, Field, inputClass, Sheet, Switch } from '@/components/ui';
import { DAY_SHORT, daysSummary } from '@/lib/format';
import { isWindowActive, jakarta, listToMask } from '@/lib/time';
import type { ScheduleView } from '@/lib/types';
import { useDevice } from './controller';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Senin duluan
const DAY_PRESETS = [
  { label: 'Setiap hari', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Sen–Jum', days: [1, 2, 3, 4, 5] },
  { label: 'Akhir pekan', days: [0, 6] },
];

type Draft = Omit<ScheduleView, 'id'> & { id?: string };

export function SchedulesTab() {
  const { view, now, act } = useDevice();
  const [draft, setDraft] = useState<Draft | null>(null);
  const { day, minutes } = jakarta(new Date(now));

  const firstVisible = view.channels.find((c) => c.visible)?.index ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl',
              view.schedulesOn ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted',
            )}
          >
            {view.schedulesOn ? <CalendarClock className="size-5" /> : <Moon className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{view.schedulesOn ? 'Jadwal otomatis aktif' : 'Mode libur'}</p>
            <p className="text-sm text-muted">
              {view.schedulesOn
                ? 'Channel nyala & mati sendiri sesuai jadwal di bawah.'
                : 'Semua jadwal dijeda, channel hanya dikontrol manual.'}
            </p>
          </div>
          <Switch
            checked={view.schedulesOn}
            label="Aktifkan jadwal otomatis"
            onChange={(value) => act({ action: 'schedules-on', value }, { optimistic: (v) => ({ ...v, schedulesOn: value }) })}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{view.schedules.length} jadwal</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            setDraft({
              label: '',
              enabled: true,
              onTime: '18:00',
              offTime: '22:00',
              days: [0, 1, 2, 3, 4, 5, 6],
              channels: [firstVisible],
            })
          }
        >
          <Plus className="size-4" /> Tambah jadwal
        </Button>
      </div>

      {view.schedules.length === 0 ? (
        <Empty icon={<CalendarClock className="size-5" />} title="Belum ada jadwal">
          Contoh: lampu teras nyala 18:00 dan mati 05:30 setiap hari.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {view.schedules.map((schedule) => {
            const running =
              view.schedulesOn &&
              schedule.enabled &&
              isWindowActive({ ...schedule, days: listToMask(schedule.days) }, day, minutes);
            const overnight = schedule.offTime <= schedule.onTime;

            return (
              <li
                key={schedule.id}
                className={cn(
                  'rounded-2xl border bg-surface p-4 shadow-card transition',
                  running ? 'border-accent/60' : 'border-line',
                  (!schedule.enabled || !view.schedulesOn) && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{schedule.label || 'Jadwal'}</p>
                      {running && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                          Berjalan
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular">
                      {schedule.onTime}
                      <span className="mx-1.5 text-muted">→</span>
                      {schedule.offTime}
                      {overnight && <span className="ml-1.5 align-middle font-sans text-xs font-medium text-muted">besok</span>}
                    </p>
                    <p className="mt-1 text-sm text-muted">{daysSummary(schedule.days)}</p>
                  </div>
                  <Switch
                    checked={schedule.enabled}
                    label={`Aktifkan ${schedule.label || 'jadwal'}`}
                    onChange={(enabled) =>
                      act(
                        { action: 'schedule-save', schedule: { ...schedule, enabled } },
                        {
                          optimistic: (v) => ({
                            ...v,
                            schedules: v.schedules.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)),
                          }),
                        },
                      )
                    }
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {schedule.channels.map((index) => {
                      const channel = view.channels[index];
                      return (
                        <span
                          key={index}
                          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-medium"
                        >
                          <Icon name={channel.icon} className="size-3.5" />
                          {channel.name}
                        </span>
                      );
                    })}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setDraft(schedule)} aria-label="Ubah jadwal">
                    <Pencil className="size-4" /> Ubah
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Menyalakan/mematikan manual saat jadwal berjalan tidak akan langsung ditimpa. Channel baru ikut jadwal lagi di
        jam nyala/mati berikutnya. Semua jam memakai WIB.
      </p>

      {draft && <ScheduleSheet draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function ScheduleSheet({ draft: initial, onClose }: { draft: Draft; onClose: () => void }) {
  const { view, act } = useDevice();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const overnight = draft.offTime <= draft.onTime;
  const hasPulse = draft.channels.some((i) => view.channels[i].behavior === 'pulse');

  const toggleIn = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort();

  const save = async () => {
    setSaving(true);
    const ok = await act({ action: 'schedule-save', schedule: draft }, { success: 'Jadwal disimpan' });
    setSaving(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!draft.id || !window.confirm('Hapus jadwal ini?')) return;
    const ok = await act({ action: 'schedule-delete', id: draft.id }, { success: 'Jadwal dihapus' });
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={draft.id ? 'Ubah jadwal' : 'Jadwal baru'}
      footer={
        <>
          {draft.id && (
            <Button variant="danger" size="icon" onClick={remove} aria-label="Hapus jadwal" className="h-11 w-11">
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={save}
            disabled={saving || draft.channels.length === 0 || draft.days.length === 0 || draft.onTime === draft.offTime}
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nama jadwal" hint="Opsional, misalnya “Lampu malam”.">
          <input
            className={inputClass}
            value={draft.label}
            maxLength={40}
            placeholder="Jadwal"
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam nyala">
            <input
              type="time"
              className={cn(inputClass, 'font-mono text-base')}
              value={draft.onTime}
              onChange={(e) => setDraft({ ...draft, onTime: e.target.value })}
            />
          </Field>
          <Field label="Jam mati">
            <input
              type="time"
              className={cn(inputClass, 'font-mono text-base')}
              value={draft.offTime}
              onChange={(e) => setDraft({ ...draft, offTime: e.target.value })}
            />
          </Field>
        </div>
        {draft.onTime === draft.offTime ? (
          <p className="-mt-2 text-sm text-danger">Jam nyala dan jam mati tidak boleh sama.</p>
        ) : (
          overnight && (
            <p className="-mt-2 text-sm text-muted">
              Lewat tengah malam: nyala {draft.onTime}, mati besoknya jam {draft.offTime}.
            </p>
          )
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Hari</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={draft.days.includes(d)}
                onClick={() => setDraft({ ...draft, days: toggleIn(draft.days, d) })}
                className={cn(
                  'h-10 cursor-pointer rounded-lg text-sm font-medium transition',
                  draft.days.includes(d) ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted hover:text-ink',
                )}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDraft({ ...draft, days: preset.days })}
                className="h-8 cursor-pointer rounded-full border border-line px-3 text-xs font-medium text-muted hover:text-ink"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Channel yang dikontrol</legend>
          <div className="grid grid-cols-2 gap-2">
            {view.channels.map((channel) => {
              const selected = draft.channels.includes(channel.index);
              return (
                <button
                  key={channel.index}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft({ ...draft, channels: toggleIn(draft.channels, channel.index) })}
                  className={cn(
                    'flex h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition',
                    selected ? 'border-accent bg-accent-soft' : 'border-line text-muted hover:text-ink',
                    !channel.visible && 'opacity-60',
                  )}
                >
                  <Icon name={channel.icon} className="size-4 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
          {hasPulse && (
            <p className="mt-2 text-xs text-muted">
              Channel “tekan sesaat” hanya ditekan sekali pada jam nyala; jam mati diabaikan.
            </p>
          )}
        </fieldset>

        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-sm font-medium">Jadwal aktif</span>
          <Switch checked={draft.enabled} label="Jadwal aktif" onChange={(enabled) => setDraft({ ...draft, enabled })} />
        </div>
      </div>
    </Sheet>
  );
}
