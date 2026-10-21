'use client';
import { Delete, Lock } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/components/ui';

// layar PIN gaya keypad HP, biar gampang diketik pakai jempol
export function PinGate({
  device,
}: {
  device: { id: string; name: string; owner: string; accent: string; icon: string };
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (value.length < 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/devices/${device.id}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      });
      if (res.ok) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'PIN salah');
      setPin('');
    } catch {
      setError('Tidak bisa terhubung ke server');
    } finally {
      setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (pin.length >= 8) return;
    setError('');
    setPin(pin + digit);
  };

  return (
    <main
      data-accent={device.accent}
      className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-10"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-on-accent">
        <Icon name={device.icon} className="size-7" />
      </div>
      <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">{device.name}</h1>
      {device.owner && <p className="text-sm text-muted">{device.owner}</p>}
      <p className="mt-6 flex items-center gap-1.5 text-sm text-muted">
        <Lock className="size-3.5" /> Masukkan PIN
      </p>

      <form
        className="mt-4 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          submit(pin);
        }}
      >
        {/* input asli tetap ada buat keyboard fisik & password manager */}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          aria-label="PIN"
          value={pin}
          maxLength={8}
          onChange={(e) => {
            setError('');
            setPin(e.target.value.replace(/\D/g, ''));
          }}
          className="sr-only"
        />
        <div className="flex h-6 justify-center gap-3" aria-hidden>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 transition',
                i < pin.length ? 'border-accent bg-accent' : 'border-line',
                error && 'border-danger',
              )}
            />
          ))}
        </div>
        <p role="alert" className="mt-3 h-5 text-center text-sm text-danger">
          {error}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={() => setPin(pin.slice(0, -1))} label="Hapus">
            <Delete className="size-6" />
          </Key>
          <Key onClick={() => press('0')}>0</Key>
          <button
            type="submit"
            disabled={pin.length < 4 || busy}
            className="h-16 cursor-pointer rounded-2xl bg-accent text-base font-semibold text-on-accent transition active:scale-95 disabled:opacity-40"
          >
            {busy ? '…' : 'Masuk'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-16 cursor-pointer place-items-center rounded-2xl bg-surface text-2xl font-medium shadow-card transition active:scale-95 active:bg-surface-2"
    >
      {children}
    </button>
  );
}
