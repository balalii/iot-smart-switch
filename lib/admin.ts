import 'server-only';
import { db } from './db';
import { isOnline } from './engine';
import type { DeviceSummary } from './types';

export async function listDevices(): Promise<DeviceSummary[]> {
  const devices = await db.device.findMany({
    orderBy: { id: 'asc' },
    include: { channels: { orderBy: { index: 'asc' } } },
  });
  const now = new Date();

  return devices.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    owner: d.owner,
    accent: d.accent,
    template: d.template,
    requirePin: d.requirePin,
    online: isOnline(d, now),
    lastSeen: d.lastSeen?.toISOString() ?? null,
    rssi: d.rssi,
    fw: d.fw,
    ip: d.ip,
    channels: d.channels.map((c) => ({ name: c.name, icon: c.icon, on: c.on, visible: c.visible })),
  }));
}
