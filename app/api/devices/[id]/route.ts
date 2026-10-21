import { NextResponse } from 'next/server';
import { authorizeDevice } from '@/lib/auth';
import { getDeviceView } from '@/lib/engine';
import { int } from '@/lib/input';

export const dynamic = 'force-dynamic';

// dipolling dashboard tiap ~1,5 detik
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await authorizeDevice(id))) {
    return NextResponse.json({ message: 'Sesi berakhir, masukkan PIN lagi.' }, { status: 401 });
  }

  const logs = int(new URL(request.url).searchParams.get('logs'), 10, 300, 40);
  const view = await getDeviceView(id, logs);
  if (!view) return NextResponse.json({ message: 'Perangkat tidak ditemukan' }, { status: 404 });

  return NextResponse.json(view);
}
