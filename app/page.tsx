import Link from 'next/link';
import { OpenDevice } from '@/components/open-device';

// Halaman depan sengaja nggak menampilkan daftar perangkat (privasi pemilik).
// Pemilik langsung buka path-nya sendiri, misal /kamar-andi.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <svg viewBox="0 0 64 64" className="size-14" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--ink)" />
        <rect x="13" y="13" width="38" height="38" rx="8" fill="var(--bg)" />
        <rect x="18" y="18" width="12.5" height="12.5" rx="3" fill="#f2b33d" />
        <rect x="33.5" y="18" width="12.5" height="12.5" rx="3" fill="var(--line)" />
        <rect x="18" y="33.5" width="12.5" height="12.5" rx="3" fill="var(--line)" />
        <rect x="33.5" y="33.5" width="12.5" height="12.5" rx="3" fill="#f2b33d" />
      </svg>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Smart Switch</h1>
      <p className="mt-2 text-muted">
        Kontrol relay 4 channel dari HP. Masukkan alamat perangkatmu, atau buka link yang diberikan admin.
      </p>
      <OpenDevice />
      <Link href="/admin" className="mt-10 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        Masuk sebagai admin
      </Link>
    </main>
  );
}
