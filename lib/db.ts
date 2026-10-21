import 'server-only';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { dbConfig } from './db-config';
import { PrismaClient } from './generated/prisma/client';

function create() {
  return new PrismaClient({ adapter: new PrismaLibSql(dbConfig()) });
}

// satu klien per proses, disimpan di globalThis biar nggak dibuat ulang tiap hot reload
const globalForDb = globalThis as unknown as { __switchDb?: PrismaClient };
export const db = (globalForDb.__switchDb ??= create());
