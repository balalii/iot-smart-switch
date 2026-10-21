import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// manifest per perangkat: "Tambahkan ke layar utama" langsung membuka path perangkat itu
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const device = await db.device.findUnique({ where: { slug }, select: { name: true } });
  if (!device) return new Response('Not found', { status: 404 });

  const manifest = {
    name: device.name,
    short_name: device.name.slice(0, 12),
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: 'standalone',
    background_color: '#f5f3ef',
    theme_color: '#f5f3ef',
    icons: [
      { src: '/api/pwa-icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/api/pwa-icon?size=512', sizes: '512x512', type: 'image/png' },
      { src: '/api/pwa-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
