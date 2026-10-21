import { NextResponse } from 'next/server';
import { listDevices } from '@/lib/admin';
import { hashPin, isAdmin, newDeviceToken, PIN_PATTERN } from '@/lib/auth';
import { normalizeSlug, RESERVED_SLUGS, SLUG_PATTERN, TEMPLATES } from '@/lib/catalog';
import { db } from '@/lib/db';
import { readJson, str } from '@/lib/input';
import { newDeviceData } from '@/lib/provision';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Khusus admin' }, { status: 401 });
  return NextResponse.json(await listDevices());
}

// tambah perangkat baru (misal perangkat ke-13), balikin token buat ditanam di ESP32
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ message: 'Khusus admin' }, { status: 401 });

  const body = await readJson(request);
  const id = str(body.id, 16).toLowerCase();
  const slug = normalizeSlug(str(body.slug, 60));
  const pin = str(body.pin, 8);
  const template = TEMPLATES.some((t) => t.key === body.template) ? String(body.template) : 'rumah';

  if (!/^[a-z0-9]{2,16}$/.test(id)) {
    return NextResponse.json({ message: 'ID 2–16 karakter, huruf kecil & angka saja' }, { status: 400 });
  }
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || RESERVED_SLUGS.includes(slug)) {
    return NextResponse.json({ message: 'Path tidak valid' }, { status: 400 });
  }
  if (!PIN_PATTERN.test(pin)) {
    return NextResponse.json({ message: 'PIN harus 4–8 angka' }, { status: 400 });
  }
  if (await db.device.findFirst({ where: { OR: [{ id }, { slug }] } })) {
    return NextResponse.json({ message: 'ID atau path sudah dipakai' }, { status: 409 });
  }

  const token = newDeviceToken();
  await db.device.create({
    data: newDeviceData({
      id,
      slug,
      name: str(body.name, 40) || id.toUpperCase(),
      owner: str(body.owner, 40),
      pinHash: hashPin(pin),
      token,
      template,
    }),
  });

  return NextResponse.json({ id, slug, token });
}
