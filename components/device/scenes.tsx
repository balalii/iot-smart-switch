'use client';
import { Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Button, cn, Empty, Field, inputClass, Sheet } from '@/components/ui';
import { SCENE_ICONS } from '@/lib/catalog';
import type { SceneView } from '@/lib/types';
import { useDevice } from './controller';

type Draft = Omit<SceneView, 'id'> & { id?: string };

export function ScenesTab() {
  const { view, act } = useDevice();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Atur beberapa channel sekaligus dengan satu ketukan.</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDraft({ name: '', icon: 'sparkles', actions: [null, null, null, null] })}
        >
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      {view.scenes.length === 0 ? (
        <Empty icon={<Sparkles className="size-5" />} title="Belum ada skenario">
          Contoh: “Pergi” mematikan semua kecuali lampu teras.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {view.scenes.map((scene) => (
            <li key={scene.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                  <Icon name={scene.icon} className="size-5" />
                </span>
                <p className="min-w-0 flex-1 truncate font-semibold">{scene.name}</p>
                <Button size="icon" variant="ghost" onClick={() => setDraft(scene)} aria-label={`Ubah ${scene.name}`}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {scene.actions.map((action, index) =>
                  action === null ? null : (
                    <li key={index} className="flex items-center justify-between gap-3">
                      <span className="truncate text-muted">{view.channels[index].name}</span>
                      <span className={cn('font-medium', action ? 'text-accent-ink' : 'text-ink')}>
                        {action ? 'Nyala' : 'Mati'}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <Button
                variant="primary"
                className="mt-4"
                disabled={running !== null}
                onClick={async () => {
                  setRunning(scene.id);
                  await act({ action: 'scene-run', id: scene.id }, { success: `Skenario "${scene.name}" dijalankan` });
                  setRunning(null);
                }}
              >
                <Play className="size-4" /> {running === scene.id ? 'Menjalankan…' : 'Jalankan'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {draft && <SceneSheet draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

const CHOICES = [
  { value: null, label: 'Biarkan' },
  { value: true, label: 'Nyala' },
  { value: false, label: 'Mati' },
] as const;

function SceneSheet({ draft: initial, onClose }: { draft: Draft; onClose: () => void }) {
  const { view, act } = useDevice();
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const empty = draft.actions.every((a) => a === null);

  const setAction = (index: number, value: boolean | null) =>
    setDraft({ ...draft, actions: draft.actions.map((a, i) => (i === index ? value : a)) });

  const save = async () => {
    setSaving(true);
    const ok = await act({ action: 'scene-save', scene: draft }, { success: 'Skenario disimpan' });
    setSaving(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!draft.id || !window.confirm(`Hapus skenario "${draft.name}"?`)) return;
    const ok = await act({ action: 'scene-delete', id: draft.id }, { success: 'Skenario dihapus' });
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={draft.id ? 'Ubah skenario' : 'Skenario baru'}
      footer={
        <>
          {draft.id && (
            <Button variant="danger" size="icon" onClick={remove} aria-label="Hapus skenario" className="h-11 w-11">
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" className="flex-1" onClick={save} disabled={saving || empty}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nama skenario">
          <input
            className={inputClass}
            value={draft.name}
            maxLength={30}
            placeholder="Misal: Tidur"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Ikon</legend>
          <div className="flex flex-wrap gap-2">
            {SCENE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-pressed={draft.icon === icon}
                aria-label={icon}
                onClick={() => setDraft({ ...draft, icon })}
                className={cn(
                  'grid size-11 cursor-pointer place-items-center rounded-xl border transition',
                  draft.icon === icon ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-muted',
                )}
              >
                <Icon name={icon} className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="text-sm font-medium">Saat dijalankan</legend>
            <button
              type="button"
              onClick={() =>
                setDraft({ ...draft, actions: view.channels.map((c) => (c.visible && c.behavior === 'toggle' ? c.on : null)) })
              }
              className="cursor-pointer text-sm font-medium text-accent-ink hover:underline"
            >
              Pakai kondisi sekarang
            </button>
          </div>
          <div className="space-y-3">
            {view.channels.map((channel) => (
              <div key={channel.index} className={cn(!channel.visible && 'opacity-60')}>
                <p className="mb-1.5 flex items-center gap-2 text-sm">
                  <Icon name={channel.icon} className="size-4 text-muted" />
                  {channel.name}
                  {channel.behavior === 'pulse' && <span className="text-xs text-muted">(tekan sesaat)</span>}
                </p>
                <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                  {CHOICES.filter((c) => channel.behavior === 'toggle' || c.value !== false).map((choice) => (
                    <button
                      key={String(choice.value)}
                      type="button"
                      aria-pressed={draft.actions[channel.index] === choice.value}
                      onClick={() => setAction(channel.index, choice.value)}
                      className={cn(
                        'h-9 flex-1 cursor-pointer rounded-lg text-sm font-medium transition',
                        draft.actions[channel.index] === choice.value
                          ? choice.value
                            ? 'bg-accent text-on-accent'
                            : 'bg-surface text-ink shadow-card'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      {channel.behavior === 'pulse' && choice.value ? 'Tekan' : choice.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
}
