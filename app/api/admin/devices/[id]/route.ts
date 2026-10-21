import { NextResponse } from 'next/server';
import { hashPin, isAdmin, newDeviceToken, PIN_PATTERN } from '@/lib/auth';
import { normalizeSlug, RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/catalog';
import { db } from '@/lib/db';
import { readJson, str } from '@/lib/input';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// lihat token (buat setup ESP32)
export async function GET(_request: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Khusus admin' }, { status: 401 });
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id }, select: { id: true, token: true } });
  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });
  return NextResponse.json(device);
}

// ubah identitas, reset PIN, atau bikin token baru
export async function PATCH(request: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Khusus admin' }, { status: 401 });
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  const body = await readJson(request);
  const data: Record<string, unknown> = {};
  const notes: string[] = [];

  if (body.name !== undefined) data.name = str(body.name, 40) || device.name;
  if (body.owner !== undefined) data.owner = str(body.owner, 40);
  if (body.requirePin !== undefined) data.requirePin = Boolean(body.requirePin);

  if (body.slug !== undefined) {
    const slug = normalizeSlug(str(body.slug, 60));
    if (!SLUG_PATTERN.test(slug) || slug.length < 3 || RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json({ message: 'Path tidak valid' }, { status: 400 });
    }
    const taken = await db.device.findUnique({ where: { slug } });
    if (taken && taken.id !== id) return NextResponse.json({ message: 'Path sudah dipakai' }, { status: 409 });
    if (slug !== device.slug) notes.push(`path diganti ke /${slug}`);
    data.slug = slug;
  }

  if (body.pin) {
    const pin = str(body.pin, 8);
    if (!PIN_PATTERN.test(pin)) return NextResponse.json({ message: 'PIN harus 4–8 angka' }, { status: 400 });
    data.pinHash = hashPin(pin);
    data.sessionVersion = device.sessionVersion + 1;
    notes.push('PIN direset');
  }

  let token: string | undefined;
  if (body.regenerateToken) {
    token = newDeviceToken();
    data.token = token;
    notes.push('token ESP32 diganti');
  }

  await db.device.update({ where: { id }, data });
  if (notes.length > 0) {
    await db.log.create({ data: { deviceId: id, source: 'admin', message: `Admin: ${notes.join(', ')}` } });
  }

  return NextResponse.json({ message: 'OK', token });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Khusus admin' }, { status: 401 });
  const { id } = await params;
  await db.device.deleteMany({ where: { id } });
  return NextResponse.json({ message: 'OK' });
}
