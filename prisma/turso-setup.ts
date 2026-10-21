// Siapkan database Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) buat deploy di Vercel.
// `prisma db push` belum bisa ke URL libsql://, jadi tabel dibuat dari SQL hasil
// `prisma migrate diff`. Cuma jalan kalau database masih kosong.
//
//   npm run setup:turso

import { createClient } from '@libsql/client';
import { loadEnvConfig } from '@next/env';
import { execFileSync } from 'node:child_process';
import { dbConfig } from '../lib/db-config';

loadEnvConfig(process.cwd());

async function main() {
  const config = dbConfig();
  if (!config.url.startsWith('libsql://')) {
    throw new Error('Isi TURSO_DATABASE_URL (libsql://...) dan TURSO_AUTH_TOKEN di .env dulu.');
  }

  const client = createClient(config);
  try {
    const { rows } = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Device'",
    );
    if (rows.length > 0) {
      console.log('Tabel sudah ada, pembuatan tabel dilewati.');
      return;
    }

    const sql = execFileSync(
      'npx',
      ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'],
      { encoding: 'utf8' },
    );
    await client.executeMultiple(sql);
    console.log('Tabel dibuat di Turso.');
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
