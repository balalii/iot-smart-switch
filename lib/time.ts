// Semua hitungan jam (jadwal, statistik harian) pakai Asia/Jakarta,
// nggak peduli server-nya jalan di zona waktu mana.

export const TIMEZONE = 'Asia/Jakarta';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function jakarta(date: Date) {
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  // beberapa versi ICU nulis tengah malam sebagai "24"
  const hour = parseInt(parts.hour, 10) % 24;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: WEEKDAYS.indexOf(parts.weekday),
    minutes: hour * 60 + parseInt(parts.minute, 10),
  };
}

// tanggal "YYYY-MM-DD" n hari ke belakang dari hari ini (jam Jakarta)
export function jakartaDateDaysAgo(now: Date, days: number) {
  return jakarta(new Date(now.getTime() - days * 86_400_000)).date;
}

export function toMinutes(time: string) {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function hasBit(mask: number, bit: number) {
  return (mask & (1 << bit)) !== 0;
}

export function maskToList(mask: number, size: number) {
  return Array.from({ length: size }, (_, i) => i).filter((i) => hasBit(mask, i));
}

export function listToMask(list: number[]) {
  return list.reduce((mask, i) => mask | (1 << i), 0);
}

// offTime <= onTime artinya jadwalnya lewat tengah malam (22:00 -> 05:00)
export function isWindowActive(
  window: { onTime: string; offTime: string; days: number },
  day: number,
  minutes: number,
) {
  const start = toMinutes(window.onTime);
  const end = toMinutes(window.offTime);
  const yesterday = (day + 6) % 7;

  if (window.days === 0 || start === end) return false;

  if (start < end) {
    return hasBit(window.days, day) && minutes >= start && minutes < end;
  }

  // window kepotong tengah malam, cek dua sisinya
  return (hasBit(window.days, day) && minutes >= start) || (hasBit(window.days, yesterday) && minutes < end);
}
