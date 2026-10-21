// Helper format tampilan (dipakai di client).

export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// "2 j 15 m", "45 m", "30 d"
export function duration(ms: number) {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return `${Math.max(0, Math.floor(ms / 1000))} dtk`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} mnt`;
  return m ? `${h} j ${m} mnt` : `${h} jam`;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jakarta',
  });
}

export function shortDate(date: string) {
  // date = "YYYY-MM-DD" dari server, sudah jam Jakarta
  const [y, m, d] = date.split('-').map(Number);
  return DAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function rupiah(value: number) {
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

export function decimal(value: number, digits = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);
}

export function kwh(watt: number, ms: number) {
  return (watt * (ms / 3_600_000)) / 1000;
}

export function ago(iso: string | null, now: number) {
  if (!iso) return 'belum pernah';
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export function signal(rssi: number) {
  if (rssi === 0) return { bars: 0, label: '—' };
  if (rssi >= -55) return { bars: 4, label: 'Sangat kuat' };
  if (rssi >= -67) return { bars: 3, label: 'Kuat' };
  if (rssi >= -78) return { bars: 2, label: 'Cukup' };
  return { bars: 1, label: 'Lemah' };
}

export function daysSummary(days: number[]) {
  if (days.length === 7) return 'Setiap hari';
  const key = [...days].sort().join(',');
  if (key === '1,2,3,4,5') return 'Senin–Jumat';
  if (key === '0,6') return 'Akhir pekan';
  if (key === '1,2,3,4,5,6') return 'Senin–Sabtu';
  return [...days].sort().map((d) => DAY_SHORT[d]).join(', ');
}
