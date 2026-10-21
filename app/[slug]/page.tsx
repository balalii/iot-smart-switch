import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeviceApp } from '@/components/device/shell';
import { PinGate } from '@/components/pin-gate';
import { canAccess, isAdmin } from '@/lib/auth';
import { findTemplate } from '@/lib/catalog';
import { db } from '@/lib/db';
import { getDeviceView } from '@/lib/engine';

type Props = { params: Promise<{ slug: string }> };

// 12 perangkat, 1 halaman yang sama. Bedanya cuma di path: /perangkat-01, /kamar-andi, ...
export default async function DevicePage({ params }: Props) {
  const { slug } = await params;
  const device = await db.device.findUnique({ where: { slug } });
  if (!device) notFound();

  if (!(await canAccess(device))) {
    return (
      <PinGate
        device={{
          id: device.id,
          name: device.name,
          owner: device.owner,
          accent: device.accent,
          icon: findTemplate(device.template).icon,
        }}
      />
    );
  }

  const view = await getDeviceView(device.id);
  if (!view) notFound();

  return <DeviceApp key={device.id} initial={view} isAdmin={await isAdmin()} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const device = await db.device.findUnique({ where: { slug }, select: { name: true } });
  if (!device) return { title: 'Tidak ditemukan' };

  return {
    title: device.name,
    manifest: `/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: device.name },
    robots: { index: false },
  };
}
