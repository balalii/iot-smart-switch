import { NextResponse } from 'next/server';
import { tokenMatches } from '@/lib/auth';
import { db } from '@/lib/db';
import { syncDevice, type SyncBody } from '@/lib/engine';
import { readJson } from '@/lib/input';

export const dynamic = 'force-dynamic';

// Endpoint ESP32. Satu request = heartbeat + lapor state + ambil perintah.
//
// Header : X-Device-Id, X-Device-Token
// Body   : {"r":[0,1,0,0],"ev":[[2,1]],"cv":3,"rssi":-60,"up":120,"ip":"192.168.1.7","fw":"2.0.0"}
// Balasan: {"r":[0,1,0,0],"cv":3,"t":1761000000,"p":[[3,3000]],"cfg":{...}}
//   r   = state relay yang diminta server
//   p   = pulse yang harus dijalankan [channel, durasi ms]
//   cfg = config hardware, cuma dikirim kalau cv ESP32 beda dari server

export async function POST(request: Request) {
  const id = request.headers.get('x-device-id') ?? '';
  const token = request.headers.get('x-device-token') ?? '';

  const device = id ? await db.device.findUnique({ where: { id }, select: { token: true } }) : null;
  if (!device || !tokenMatches(token, device.token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await readJson(request)) as SyncBody;
  const response = await syncDevice(id, body);
  if (!response) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json(response);
}
