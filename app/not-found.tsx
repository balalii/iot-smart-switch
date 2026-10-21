import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Perangkat tidak ditemukan</h1>
      <p className="mt-2 text-muted">
        Alamatnya mungkin salah ketik, atau sudah diganti oleh pemiliknya. Tanyakan alamat terbaru ke admin.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium underline underline-offset-4">
        Kembali ke halaman depan
      </Link>
    </main>
  );
}
