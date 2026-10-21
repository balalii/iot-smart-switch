import { NextResponse } from 'next/server';
import {
  adminConfigured,
  attemptKey,
  checkAdminPassword,
  clearFailures,
  lockedFor,
  loginAdmin,
  logoutAdmin,
  recordFailure,
} from '@/lib/auth';
import { readJson, str } from '@/lib/input';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ message: 'ADMIN_PASSWORD belum diisi di file .env' }, { status: 503 });
  }

  const key = await attemptKey('admin');
  const locked = lockedFor(key);
  if (locked > 0) {
    return NextResponse.json(
      { message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(locked / 60_000)} menit.` },
      { status: 429 },
    );
  }

  const password = str((await readJson(request)).password, 200);
  if (!checkAdminPassword(password)) {
    recordFailure(key);
    return NextResponse.json({ message: 'Password salah' }, { status: 401 });
  }

  clearFailures(key);
  await loginAdmin();
  return NextResponse.json({ message: 'OK' });
}

export async function DELETE() {
  await logoutAdmin();
  return NextResponse.json({ message: 'OK' });
}
