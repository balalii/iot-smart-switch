'use client';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';

export function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="grid size-12 place-items-center rounded-2xl bg-ink text-bg">
        <ShieldCheck className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted">Kelola 12 perangkat: path, PIN, token ESP32, dan status.</p>

      {!configured ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-medium">Password admin belum diatur.</p>
          <p className="mt-1 text-muted">
            Isi <code className="font-mono text-ink">ADMIN_PASSWORD</code> di file <code className="font-mono text-ink">.env</code>,
            lalu restart server.
          </p>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const res = await fetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password }),
            }).catch(() => null);
            if (res?.ok) return window.location.reload();
            setError((await res?.json().catch(() => null))?.message ?? 'Tidak bisa terhubung ke server');
            setBusy(false);
          }}
        >
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full bg-ink text-bg hover:bg-ink/90" disabled={!password || busy}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      )}
    </main>
  );
}
