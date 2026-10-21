'use client';
import { Copy, ExternalLink, LogOut, Moon, Plus, RefreshCw, Settings2, Sun, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { SignalBars } from '@/components/device/shell';
import { Button, cn, Field, inputClass, Sheet, Switch, ToastProvider, useTheme, useToast } from '@/components/ui';
import { findTemplate, TEMPLATES } from '@/lib/catalog';
import { ago, signal } from '@/lib/format';
import type { DeviceSummary } from '@/lib/types';

export function AdminApp({ initial }: { initial: DeviceSummary[] }) {
  return (
    <ToastProvider>
      <Admin initial={initial} />
    </ToastProvider>
  );
}

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.reload();
  return { ok: res.ok, data };
}

function Admin({ initial }: { initial: DeviceSummary[] }) {
  const toast = useToast();
  const { dark, toggle } = useTheme();
  const [devices, setDevices] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [managing, setManaging] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/devices', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) setDevices(await res.json());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const online = devices.filter((d) => d.online).length;
  const current = devices.find((d) => d.id === managing) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Semua perangkat</h1>
          <p className="text-sm text-muted">
            {devices.length} perangkat · <span className="text-ok">{online} online</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Ganti tema">
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Keluar"
          onClick={async () => {
            await api('/api/admin/login', 'DELETE');
            window.location.reload();
          }}
        >
          <LogOut className="size-5" />
        </Button>
        <Button className="bg-ink text-bg hover:bg-ink/90" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Tambah
        </Button>
      </header>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <li
            key={device.id}
            data-accent={device.accent}
            className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
                <Icon name={findTemplate(device.template).icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{device.name}</p>
                <p className="truncate text-sm text-muted">{device.owner || 'Belum ada pemilik'}</p>
              </div>
              <span className="font-mono text-xs text-muted">{device.id}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium',
                  device.online ? 'bg-ok/12 text-ok' : 'bg-surface-2 text-muted',
                )}
              >
                <span className={cn('size-1.5 rounded-full', device.online ? 'bg-ok' : 'bg-muted/60')} />
                {device.online ? 'Online' : `Offline · ${ago(device.lastSeen, now)}`}
              </span>
              {device.online && <SignalBars bars={signal(device.rssi).bars} />}
              {!device.requirePin && (
                <span className="rounded-full bg-danger/10 px-2 py-1 font-medium text-danger">Tanpa PIN</span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {device.channels.map((c, i) => (
                <span
                  key={i}
                  title={`CH${i + 1} · ${c.name}: ${c.on ? 'nyala' : 'mati'}`}
                  className={cn(
                    'grid h-10 place-items-center rounded-lg transition',
                    c.on ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted',
                    !c.visible && 'opacity-40',
                  )}
                >
                  <Icon name={c.icon} className="size-4" />
                </span>
              ))}
            </div>

            <p className="mt-3 truncate font-mono text-xs text-muted">/{device.slug}</p>

            <div className="mt-3 flex gap-2">
              <a
                href={`/${device.slug}`}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-sm font-medium hover:bg-line/70"
              >
                <ExternalLink className="size-4" /> Buka
              </a>
              <Button size="sm" className="flex-1" onClick={() => setManaging(device.id)}>
                <Settings2 className="size-4" /> Kelola
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {current && (
        <ManageSheet
          key={current.id}
          device={current}
          onClose={() => setManaging(null)}
          onChanged={refresh}
          onDeleted={() => {
            setManaging(null);
            toast('Perangkat dihapus');
            refresh();
          }}
        />
      )}
      {adding && (
        <AddSheet
          existing={devices}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            refresh().then(() => setManaging(id));
          }}
        />
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`${label} disalin`);
          } catch {
            toast(value);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-surface px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
        <Copy className="size-4 shrink-0 text-muted" />
      </button>
    </div>
  );
}

function ManageSheet({
  device,
  onClose,
  onChanged,
  onDeleted,
}: {
  device: DeviceSummary;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: device.name, owner: device.owner, slug: device.slug });
  const [pin, setPin] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [origin] = useState(() => window.location.origin);
  const dirty = form.name !== device.name || form.owner !== device.owner || form.slug !== device.slug;

  const patch = async (body: Record<string, unknown>, success: string) => {
    const { ok, data } = await api(`/api/admin/devices/${device.id}`, 'PATCH', body);
    if (!ok) {
      toast(data.message ?? 'Gagal', 'error');
      return null;
    }
    toast(success);
    onChanged();
    return data as { token?: string };
  };

  return (
    <Sheet open onClose={onClose} title={`Kelola ${device.id}`}>
      <div className="space-y-6">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await patch(form, 'Perangkat disimpan');
          }}
        >
          <Field label="Nama perangkat">
            <input className={inputClass} value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Pemilik" hint="Nama orang yang memakai perangkat ini.">
            <input className={inputClass} value={form.owner} maxLength={40} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </Field>
          <Field label="Path URL">
            <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-accent">
              <span className="pl-3 text-sm text-muted">/</span>
              <input
                className="h-11 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-sm outline-none"
                value={form.slug}
                maxLength={40}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                aria-label="Path URL"
              />
            </div>
          </Field>
          {dirty && (
            <Button type="submit" className="w-full bg-ink text-bg hover:bg-ink/90">
              Simpan
            </Button>
          )}
        </form>

        <section className="space-y-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">
              <span className="block font-medium">Wajib PIN</span>
              <span className="text-muted">Kalau mati, siapa pun yang tahu alamatnya bisa mengontrol.</span>
            </span>
            <Switch
              checked={device.requirePin}
              label="Wajib PIN"
              onChange={(requirePin) => patch({ requirePin }, requirePin ? 'PIN diwajibkan' : 'PIN tidak diwajibkan')}
            />
          </div>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await patch({ pin }, `PIN ${device.id} direset`)) setPin('');
            }}
          >
            <input
              className={cn(inputClass, 'font-mono')}
              inputMode="numeric"
              placeholder="PIN baru (4–8 angka)"
              value={pin}
              maxLength={8}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              aria-label="PIN baru"
            />
            <Button type="submit" disabled={pin.length < 4}>
              Reset PIN
            </Button>
          </form>
        </section>

        <section className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <div>
            <h3 className="text-sm font-semibold">Setup ESP32</h3>
            <p className="mt-0.5 text-xs text-muted">
              Isi 3 nilai ini di halaman setup ESP32 (WiFi “Saklar-…”, buka 192.168.4.1).
            </p>
          </div>
          <CopyRow label="Server" value={origin} />
          <CopyRow label="ID perangkat" value={device.id} />
          {token ? (
            <CopyRow label="Token" value={token} />
          ) : (
            <Button
              size="sm"
              onClick={async () => {
                const { ok, data } = await api(`/api/admin/devices/${device.id}`, 'GET');
                if (ok) setToken(data.token);
              }}
            >
              Tampilkan token
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!window.confirm('Buat token baru? ESP32 dengan token lama akan berhenti tersambung sampai di-setup ulang.')) return;
              const data = await patch({ regenerateToken: true }, 'Token baru dibuat');
              if (data?.token) setToken(data.token);
            }}
          >
            <RefreshCw className="size-4" /> Buat token baru
          </Button>
        </section>

        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            const answer = window.prompt(`Ketik "${device.id}" untuk menghapus perangkat ini beserta semua jadwal & riwayatnya.`);
            if (answer !== device.id) return;
            const { ok } = await api(`/api/admin/devices/${device.id}`, 'DELETE');
            if (ok) onDeleted();
          }}
        >
          <Trash2 className="size-4" /> Hapus perangkat
        </Button>
      </div>
    </Sheet>
  );
}

function nextId(existing: DeviceSummary[]) {
  for (let n = 1; n < 100; n++) {
    const id = `sw${String(n).padStart(2, '0')}`;
    if (!existing.some((d) => d.id === id)) return id;
  }
  return '';
}

function AddSheet({
  existing,
  onClose,
  onCreated,
}: {
  existing: DeviceSummary[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const id = nextId(existing);
    return {
      id,
      slug: `perangkat-${id.replace(/^sw/, '')}`,
      name: `Perangkat ${id.replace(/^sw/, '')}`,
      owner: '',
      pin: String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0'),
      template: 'rumah',
    };
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Sheet
      open
      onClose={onClose}
      title="Tambah perangkat"
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="flex-1 bg-ink text-bg hover:bg-ink/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { ok, data } = await api('/api/admin/devices', 'POST', form);
              setBusy(false);
              if (!ok) return toast(data.message ?? 'Gagal', 'error');
              toast(`${form.id} dibuat. Catat PIN-nya: ${form.pin}`);
              onCreated(form.id);
            }}
          >
            {busy ? 'Membuat…' : 'Buat'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID ESP32" hint="Tidak bisa diganti.">
            <input className={cn(inputClass, 'font-mono')} value={form.id} maxLength={16} onChange={(e) => set({ id: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="PIN awal">
            <input
              className={cn(inputClass, 'font-mono')}
              inputMode="numeric"
              value={form.pin}
              maxLength={8}
              onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
        </div>
        <Field label="Path URL">
          <input className={cn(inputClass, 'font-mono')} value={form.slug} maxLength={40} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="Nama perangkat">
          <input className={inputClass} value={form.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Pemilik">
          <input className={inputClass} value={form.owner} maxLength={40} onChange={(e) => set({ owner: e.target.value })} />
        </Field>
        <Field label="Template awal" hint="Pemilik bisa menggantinya sendiri nanti.">
          <select className={inputClass} value={form.template} onChange={(e) => set({ template: e.target.value })}>
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Sheet>
  );
}
