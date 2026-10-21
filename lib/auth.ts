import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';
import type { Device } from './generated/prisma/client';

// Dua jenis sesi:
// - admin  : 1 cookie, pegang semua perangkat (password dari env ADMIN_PASSWORD)
// - device : 1 cookie per perangkat setelah PIN benar. Isinya sessionVersion,
//            jadi ganti PIN = semua HP yang pernah login otomatis keluar.

const ADMIN_COOKIE = 'sw_admin';
const DEVICE_COOKIE = (id: string) => `sw_d_${id}`;
const MAX_AGE = 60 * 60 * 24 * 90; // 90 hari, biar nggak tiap buka harus PIN lagi

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const dir = path.join(process.cwd(), 'data');
  const file = path.join(dir, '.session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const key = new TextEncoder().encode(loadSecret());

async function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key);
}

async function verify(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

async function setCookie(name: string, value: string) {
  const proto = (await headers()).get('x-forwarded-proto');
  (await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: proto === 'https',
    path: '/',
    maxAge: MAX_AGE,
  });
}

// --- admin ---

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function loginAdmin() {
  await setCookie(ADMIN_COOKIE, await sign({ admin: true }));
}

export async function isAdmin() {
  const payload = await verify((await cookies()).get(ADMIN_COOKIE)?.value);
  return payload?.admin === true;
}

export async function logoutAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
}

// --- perangkat ---

export async function loginDevice(device: Pick<Device, 'id' | 'sessionVersion'>) {
  await setCookie(DEVICE_COOKIE(device.id), await sign({ d: device.id, v: device.sessionVersion }));
}

export async function logoutDevice(id: string) {
  (await cookies()).delete(DEVICE_COOKIE(id));
}

export async function canAccess(device: Pick<Device, 'id' | 'requirePin' | 'sessionVersion'>) {
  if (!device.requirePin) return true;
  if (await isAdmin()) return true;
  const payload = await verify((await cookies()).get(DEVICE_COOKIE(device.id))?.value);
  return payload?.d === device.id && payload?.v === device.sessionVersion;
}

// buat route handler: balikin device kalau boleh diakses, null kalau nggak
export async function authorizeDevice(id: string) {
  const device = await db.device.findUnique({ where: { id } });
  if (!device || !(await canAccess(device))) return null;
  return device;
}

// --- PIN ---

export const PIN_PATTERN = /^\d{4,8}$/;

export function hashPin(pin: string) {
  return bcrypt.hashSync(pin, 10);
}

export function checkPin(pin: string, hash: string) {
  return bcrypt.compareSync(pin, hash);
}

// anti tebak PIN: 5x salah -> dikunci 5 menit (per perangkat + IP)
const globalAttempts = globalThis as unknown as {
  __switchAttempts?: Map<string, { count: number; until: number }>;
};
const attempts = (globalAttempts.__switchAttempts ??= new Map());

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60_000;

export async function attemptKey(scope: string) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  return `${scope}|${ip}`;
}

export function lockedFor(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.until <= Date.now()) return 0;
  return entry.until - Date.now();
}

export function recordFailure(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.count = 0;
    entry.until = Date.now() + LOCK_MS;
  }
  attempts.set(key, entry);
}

export function clearFailures(key: string) {
  attempts.delete(key);
}

// --- token ESP32 ---

export function newDeviceToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
