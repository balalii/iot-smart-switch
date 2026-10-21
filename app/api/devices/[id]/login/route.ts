import { NextResponse } from 'next/server';
import {
  attemptKey,
  checkPin,
  clearFailures,
  lockedFor,
  loginDevice,
  logoutDevice,
  recordFailure,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { readJson, str } from '@/lib/input';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const key = await attemptKey(`pin:${id}`);
  const locked = lockedFor(key);
  if (locked > 0) {
    return NextResponse.json(
      { message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(locked / 60_000)} menit.` },
      { status: 429 },
    );
  }

  const pin = str((await readJson(request)).pin, 8);
  if (!checkPin(pin, device.pinHash)) {
    recordFailure(key);
    return NextResponse.json({ message: 'PIN salah' }, { status: 401 });
  }

  clearFailures(key);
  await loginDevice(device);
  return NextResponse.json({ message: 'OK' });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await logoutDevice(id);
  return NextResponse.json({ message: 'OK' });
}
