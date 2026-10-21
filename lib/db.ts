import 'server-only';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client';

// harus sama dengan default di prisma.config.ts
const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/switch.db';

function create() {
  return new PrismaClient({ adapter: new PrismaLibSql({ url: DATABASE_URL }) });
}

// satu klien per proses, disimpan di globalThis biar nggak dibuat ulang tiap hot reload
const globalForDb = globalThis as unknown as { __switchDb?: PrismaClient };
export const db = (globalForDb.__switchDb ??= create());
