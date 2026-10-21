'use client';
import { Check, ChevronRight, Copy, EyeOff, KeyRound, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Icon, ICON_LABELS } from '@/components/icons';
import { Button, Card, cn, Field, inputClass, Segmented, Sheet, Switch, useToast } from '@/components/ui';
import { ACCENTS, BEHAVIORS, BOOT_STATES, ICONS, TEMPLATES, type Template } from '@/lib/catalog';
import { ago, duration, signal } from '@/lib/format';
import type { ChannelView } from '@/lib/types';
import { useDevice } from './controller';

export function SettingsTab() {
  return (
    <div className="space-y-4">
      <IdentityCard />
      <TemplateCard />
      <ChannelsCard />
      <AccessCard />
      <HardwareCard />
      <InfoCard />
      <LogoutButton />
    </div>
  );
}

// --- identitas ---

function IdentityCard() {
  const { view, act } = useDevice();
  const [name, setName] = useState(view.name);
  const [description, setDescription] = useState(view.description);
  const dirty = name !== view.name || description !== view.description;

  return (
    <Card title="Identitas" description="Nama dan warna yang tampil di aplikasi.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: 'device-config', config: { name, description } }, { success: 'Disimpan' });
        }}
      >
        <Field label="Nama perangkat">
          <input className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Keterangan" hint="Opsional, misalnya lokasi pemasangan.">
          <input
            className={inputClass}
            value={description}
            maxLength={120}
            placeholder="Rumah Blok C, panel dapur"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {dirty && (
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Simpan identitas
          </Button>
        )}
      </form>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">Warna aksen</legend>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((accent) => (
            <button
              key={accent.key}
              type="button"
              data-accent={accent.key}
              aria-label={accent.label}
              aria-pressed={view.accent === accent.key}
              onClick={() =>
                act(
                  { action: 'device-config', config: { accent: accent.key } },
                  { optimistic: (v) => ({ ...v, accent: accent.key }) },
                )
              }
              className={cn(
                'grid size-10 cursor-pointer place-items-center rounded-full bg-accent text-on-accent ring-offset-2 ring-offset-surface transition',
                view.accent === accent.key && 'ring-2 ring-ink',
              )}
            >
              {view.accent === accent.key && <Check className="size-4" />}
            </button>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

// --- template kegunaan ---

function TemplateCard() {
  const { view } = useDevice();
  const [picked, setPicked] = useState<Template | null>(null);

  return (
    <Card
      title="Kegunaan"
      description="Pilih template untuk mengisi nama, ikon, daya, dan perilaku 4 channel sekaligus."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => setPicked(template)}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:border-accent',
              view.template === template.key ? 'border-accent bg-accent-soft' : 'border-line',
            )}
          >
            <Icon name={template.icon} className="size-5 text-accent-ink" />
            <span className="text-sm font-semibold">{template.name}</span>
            <span className="line-clamp-2 text-xs text-muted">{template.description}</span>
          </button>
        ))}
      </div>
      {picked && <TemplateSheet template={picked} onClose={() => setPicked(null)} />}
    </Card>
  );
}

function TemplateSheet({ template, onClose }: { template: Template; onClose: () => void }) {
  const { act } = useDevice();
  const [withExtras, setWithExtras] = useState(template.schedules.length + template.scenes.length > 0);
  const [saving, setSaving] = useState(false);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Template ${template.name}`}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await act(
                { action: 'template-apply', template: template.key, withExtras },
                { success: `Template ${template.name} diterapkan` },
              );
              setSaving(false);
              if (ok) onClose();
            }}
          >
            {saving ? 'Menerapkan…' : 'Terapkan'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ul className="space-y-2">
          {template.channels.map((c, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <Icon name={c.icon} className="size-5 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  CH{i + 1} · {c.name}
                </span>
                <span className="block text-xs text-muted">
                  {c.watt} W{c.behavior === 'pulse' && ` · tekan ${c.pulseSec} dtk`}
                  {c.maxOnMin ? ` · maks ${c.maxOnMin} mnt` : ''}
                  {c.interlock ? ' · interlock' : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {template.schedules.length + template.scenes.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--accent)]"
              checked={withExtras}
              onChange={(e) => setWithExtras(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Ganti jadwal & skenario juga</span>
              <span className="block text-muted">
                {template.schedules.length} contoh jadwal dan {template.scenes.length} skenario. Jadwal & skenario
                yang sekarang akan dihapus.
              </span>
            </span>
          </label>
        )}
        <p className="text-sm text-muted">Semua channel akan dimatikan dulu saat template diterapkan.</p>
      </div>
    </Sheet>
  );
}

// --- channel ---

function ChannelsCard() {
  const { view } = useDevice();
  const [editing, setEditing] = useState<ChannelView | null>(null);

  return (
    <Card title="Channel relay" description="Atur nama, ikon, daya, dan cara kerja tiap channel.">
      <ul className="divide-y divide-line">
        {view.channels.map((channel) => (
          <li key={channel.index}>
            <button
              type="button"
              onClick={() => setEditing(channel)}
              className="flex w-full cursor-pointer items-center gap-3 py-3 text-left first:pt-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                <Icon name={channel.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">
                    CH{channel.index + 1} · {channel.name}
                  </span>
                  {!channel.visible && <EyeOff className="size-3.5 shrink-0 text-muted" aria-label="Disembunyikan" />}
                </span>
                <span className="block truncate text-xs text-muted">{channelSummary(channel)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      {editing && <ChannelSheet channel={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function channelSummary(c: ChannelView) {
  const parts = [`${c.watt} W`, c.behavior === 'pulse' ? `tekan ${c.pulseSec} dtk` : 'saklar biasa'];
  if (c.maxOnMin > 0) parts.push(`maks ${c.maxOnMin} mnt`);
  if (c.interlock > 0) parts.push(`interlock ${c.interlock === 1 ? 'A' : 'B'}`);
  return parts.join(' · ');
}

function ChannelSheet({ channel, onClose }: { channel: ChannelView; onClose: () => void }) {
  const { act } = useDevice();
  const [draft, setDraft] = useState({
    name: channel.name,
    icon: channel.icon,
    watt: String(channel.watt),
    visible: channel.visible,
    behavior: channel.behavior,
    pulseSec: String(channel.pulseSec),
    maxOnMin: String(channel.maxOnMin),
    interlock: String(channel.interlock),
    bootState: channel.bootState,
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setSaving(true);
    const ok = await act(
      {
        action: 'channel-config',
        channel: channel.index,
        config: {
          ...draft,
          watt: Number(draft.watt),
          pulseSec: Number(draft.pulseSec),
          maxOnMin: Number(draft.maxOnMin),
          interlock: Number(draft.interlock),
        },
      },
      { success: 'Channel disimpan' },
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Pengaturan CH${channel.index + 1}`}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" className="flex-1" onClick={save} disabled={saving || !draft.name.trim()}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nama">
          <input
            className={inputClass}
            value={draft.name}
            maxLength={24}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Ikon <span className="font-normal text-muted">· {ICON_LABELS[draft.icon]}</span>
          </legend>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                title={ICON_LABELS[icon]}
                aria-label={ICON_LABELS[icon]}
                aria-pressed={draft.icon === icon}
                onClick={() => set({ icon })}
                className={cn(
                  'grid aspect-square cursor-pointer place-items-center rounded-lg border transition',
                  draft.icon === icon ? 'border-accent bg-accent-soft text-accent-ink' : 'border-transparent text-muted hover:bg-surface-2',
                )}
              >
                <Icon name={icon} className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Daya beban (watt)" hint="Untuk menghitung perkiraan kWh dan biaya. Lihat label di perangkatnya.">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={5000}
            className={cn(inputClass, 'tabular')}
            value={draft.watt}
            onChange={(e) => set({ watt: e.target.value })}
          />
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium">Cara kerja</p>
          <Segmented
            label="Cara kerja"
            value={draft.behavior}
            options={BEHAVIORS}
            onChange={(behavior) => set({ behavior })}
          />
          <p className="text-xs text-muted">{BEHAVIORS.find((b) => b.key === draft.behavior)?.hint}</p>
        </div>

        {draft.behavior === 'pulse' ? (
          <Field label="Lama aktif (detik)" hint="Relay nyala selama ini lalu mati sendiri. Dijalankan oleh ESP32, jadi tetap presisi.">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              className={cn(inputClass, 'tabular')}
              value={draft.pulseSec}
              onChange={(e) => set({ pulseSec: e.target.value })}
            />
          </Field>
        ) : (
          <Field
            label="Batas nyala maksimal (menit)"
            hint="Pengaman: mati otomatis kalau lupa dimatikan. Isi 0 untuk tanpa batas. Cocok untuk pompa & pemanas."
          >
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              className={cn(inputClass, 'tabular')}
              value={draft.maxOnMin}
              onChange={(e) => set({ maxOnMin: e.target.value })}
            />
          </Field>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Interlock</p>
          <Segmented
            label="Grup interlock"
            value={draft.interlock}
            options={[
              { key: '0', label: 'Bebas' },
              { key: '1', label: 'Grup A' },
              { key: '2', label: 'Grup B' },
            ]}
            onChange={(interlock) => set({ interlock })}
          />
          <p className="text-xs text-muted">
            Channel di grup yang sama tidak bisa nyala bersamaan. Wajib untuk motor naik/turun atau buka/tutup.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Saat ESP32 baru menyala</p>
          <Segmented
            label="Kondisi saat ESP32 menyala"
            value={draft.bootState}
            options={BOOT_STATES}
            onChange={(bootState) => set({ bootState })}
          />
          <p className="text-xs text-muted">
            Berlaku sebelum ESP32 tersambung ke server, misalnya setelah listrik padam.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 p-3">
          <span className="text-sm">
            <span className="block font-medium">Tampilkan di Kontrol</span>
            <span className="text-muted">Sembunyikan kalau channel ini tidak dipakai.</span>
          </span>
          <Switch checked={draft.visible} label="Tampilkan channel" onChange={(visible) => set({ visible })} />
        </div>
      </div>
    </Sheet>
  );
}

// --- alamat & akses ---

function AccessCard() {
  const { view, act, isAdmin } = useDevice();
  const toast = useToast();
  const [slug, setSlug] = useState(view.slug);
  const [pinOpen, setPinOpen] = useState(false);
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));
  const url = `${origin}/${view.slug}`;

  return (
    <Card title="Alamat & akses" description="Alamat ini yang dibuka pemilik perangkat di HP.">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: 'slug', slug }, { success: 'Alamat diganti' });
        }}
      >
        <Field
          label="Path URL"
          hint="Huruf kecil, angka, dan tanda -. Setelah diganti, alamat lama tidak berlaku lagi. ESP32 tidak perlu diubah."
        >
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
              <span className="pl-3 text-sm text-muted">/</span>
              <input
                className="h-11 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-sm outline-none"
                value={slug}
                maxLength={40}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                aria-label="Path URL"
              />
            </div>
            <Button type="submit" variant="primary" disabled={slug === view.slug || slug.length < 3}>
              Ganti
            </Button>
          </div>
        </Field>
      </form>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast('Alamat disalin');
          } catch {
            toast(url);
          }
        }}
        className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
        <Copy className="size-4 shrink-0 text-muted" />
      </button>

      <div className="mt-5 space-y-3 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">
            <span className="block font-medium">Wajib PIN</span>
            <span className="text-muted">Kalau dimatikan, siapa pun yang tahu alamatnya bisa mengontrol.</span>
          </span>
          <Switch
            checked={view.requirePin}
            label="Wajib PIN"
            onChange={(value) => {
              let current = '';
              if (!value && !isAdmin) {
                current = window.prompt('Masukkan PIN untuk mematikan perlindungan PIN') ?? '';
                if (!current) return;
              }
              act({ action: 'require-pin', value, current });
            }}
          />
        </div>
        <Button onClick={() => setPinOpen(true)} className="w-full sm:w-auto">
          <KeyRound className="size-4" /> Ganti PIN
        </Button>
      </div>
      {pinOpen && <PinSheet onClose={() => setPinOpen(false)} />}
    </Card>
  );
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const { act, isAdmin } = useDevice();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const valid = /^\d{4,8}$/.test(next) && next === confirm && (isAdmin || current.length >= 4);

  const pinInput = (value: string, onChange: (v: string) => void, autoFocus = false) => (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      autoFocus={autoFocus}
      className={cn(inputClass, 'font-mono tracking-[0.3em]')}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Ganti PIN"
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!valid}
            onClick={async () => {
              if (await act({ action: 'pin', current, next }, { success: 'PIN diganti' })) onClose();
            }}
          >
            Simpan PIN
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!isAdmin && <Field label="PIN sekarang">{pinInput(current, setCurrent, true)}</Field>}
        <Field label="PIN baru" hint="4–8 angka.">
          {pinInput(next, setNext, isAdmin)}
        </Field>
        <Field label="Ulangi PIN baru">{pinInput(confirm, setConfirm)}</Field>
        {confirm && next !== confirm && <p className="text-sm text-danger">PIN baru tidak sama.</p>}
        <p className="text-sm text-muted">HP lain yang sudah login akan otomatis keluar.</p>
      </div>
    </Sheet>
  );
}

// --- perangkat keras ---

const POLL_OPTIONS = [
  { key: '500', label: '0,5 dtk' },
  { key: '1000', label: '1 dtk' },
  { key: '2000', label: '2 dtk' },
  { key: '5000', label: '5 dtk' },
];

function HardwareCard() {
  const { view, act } = useDevice();
  const [failsafeSec, setFailsafeSec] = useState(String(view.failsafeSec));
  const save = (config: Record<string, unknown>) => act({ action: 'device-config', config }, { success: 'Dikirim ke ESP32' });

  return (
    <Card
      title="Perangkat keras"
      description="Dikirim otomatis ke ESP32 dan disimpan di memorinya, tidak perlu upload ulang."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">
            <span className="block font-medium">Relay aktif LOW</span>
            <span className="text-muted">Nyalakan untuk modul relay biasa. Matikan kalau nyala/mati terbalik.</span>
          </span>
          <Switch checked={view.activeLow} label="Relay aktif LOW" onChange={(activeLow) => save({ activeLow })} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Kalau server tidak bisa dihubungi</p>
          <Segmented
            label="Perilaku saat terputus"
            value={view.failsafe}
            options={[
              { key: 'keep', label: 'Pertahankan' },
              { key: 'off', label: 'Matikan semua' },
            ]}
            onChange={(failsafe) => save({ failsafe })}
          />
          {view.failsafe === 'off' && (
            <form
              className="flex items-center gap-2 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                save({ failsafeSec: Number(failsafeSec) });
              }}
            >
              <span className="text-muted">setelah</span>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={3600}
                className={cn(inputClass, 'h-9 w-24 tabular')}
                value={failsafeSec}
                onChange={(e) => setFailsafeSec(e.target.value)}
                aria-label="Detik sebelum mematikan semua"
              />
              <span className="text-muted">detik</span>
              {Number(failsafeSec) !== view.failsafeSec && (
                <Button type="submit" size="sm" variant="primary">
                  Simpan
                </Button>
              )}
            </form>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Interval sinkron</p>
          <Segmented
            label="Interval sinkron"
            value={String(view.pollMs)}
            options={POLL_OPTIONS.some((o) => o.key === String(view.pollMs)) ? POLL_OPTIONS : [...POLL_OPTIONS, { key: String(view.pollMs), label: `${view.pollMs} ms` }]}
            onChange={(pollMs) => save({ pollMs: Number(pollMs) })}
          />
          <p className="text-xs text-muted">Makin cepat makin responsif, tapi makin banyak beban ke server.</p>
        </div>
      </div>
    </Card>
  );
}

// --- info ---

function InfoCard() {
  const { view, now } = useDevice();
  const sig = signal(view.rssi);
  const rows = [
    ['ID perangkat', view.id],
    ['Status', view.online ? 'Online' : 'Offline'],
    ['Kabar terakhir', ago(view.lastSeen, now)],
    ['Sinyal WiFi', view.rssi ? `${view.rssi} dBm · ${sig.label}` : '—'],
    ['IP lokal', view.ip || '—'],
    ['Firmware', view.fw || '—'],
    ['Uptime ESP32', view.uptime ? duration(view.uptime * 1000) : '—'],
  ];

  return (
    <Card title="Info ESP32">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="truncate text-right font-mono text-xs leading-5 tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function LogoutButton() {
  const { view } = useDevice();
  if (!view.requirePin) return null;

  return (
    <Button
      variant="ghost"
      className="w-full text-danger"
      onClick={async () => {
        await fetch(`/api/devices/${view.id}/login`, { method: 'DELETE' });
        window.location.reload();
      }}
    >
      <LogOut className="size-4" /> Keluar dari perangkat ini
    </Button>
  );
}
