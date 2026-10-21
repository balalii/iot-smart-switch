// Bikin 12 perangkat awal (sw01..sw12). Aman dijalankan berulang:
// perangkat yang sudah ada dilewati, jadi PIN & token lama nggak berubah.
//
//   npm run db:seed
//
// PIN & token perangkat baru ditulis ke data/akun-perangkat.txt — bagikan PIN ke
// masing-masing pemilik, token ditanam di ESP32 lewat halaman setup.

import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dbConfig } from '../lib/db-config';
import { PrismaClient } from '../lib/generated/prisma/client';
import { newDeviceData } from '../lib/provision';

const DEVICE_COUNT = 12;

const db = new PrismaClient({
  adapter: new PrismaLibSql(dbConfig()),
});

async function main() {
  const created: string[] = [];

  for (let n = 1; n <= DEVICE_COUNT; n++) {
    const num = String(n).padStart(2, '0');
    const id = `sw${num}`;
    if (await db.device.findUnique({ where: { id } })) continue;

    const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const token = crypto.randomBytes(18).toString('base64url');

    await db.device.create({
      data: newDeviceData({
        id,
        slug: `perangkat-${num}`,
        name: `Perangkat ${num}`,
        pinHash: bcrypt.hashSync(pin, 10),
        token,
        template: 'rumah',
      }),
    });

    created.push(`${id}  path: /perangkat-${num}  PIN: ${pin}  token: ${token}`);
  }

  if (created.length === 0) {
    console.log('Semua perangkat sudah ada, tidak ada yang dibuat.');
    return;
  }

  const file = path.join(process.cwd(), 'data', 'akun-perangkat.txt');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `# dibuat ${new Date().toISOString()}\n${created.join('\n')}\n\n`, { mode: 0o600 });

  console.log(`${created.length} perangkat dibuat:\n`);
  console.log(created.join('\n'));
  console.log(`\nDisimpan juga di ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
