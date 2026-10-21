// Pilihan yang bisa dipakai di server maupun UI: ikon, warna aksen, dan template kegunaan.
// Template inilah yang bikin 12 perangkat bisa beda fungsi tanpa beda kode.

export const CHANNEL_COUNT = 4;

export const ICONS = [
  'lamp',
  'ceiling',
  'plug',
  'fan',
  'ac',
  'pump',
  'filter',
  'heater',
  'sun',
  'sprout',
  'fish',
  'bird',
  'egg',
  'door',
  'lock',
  'bell',
  'siren',
  'blinds',
  'motor',
  'tv',
  'speaker',
  'monitor',
  'router',
  'fridge',
  'washer',
  'coffee',
  'snowflake',
  'wind',
  'store',
  'car',
  'zap',
] as const;

export const SCENE_ICONS = ['sparkles', 'moon', 'sun', 'door', 'store', 'zap', 'coffee', 'tv'] as const;

export type IconName = (typeof ICONS)[number] | (typeof SCENE_ICONS)[number];

export const ACCENTS = [
  { key: 'amber', label: 'Kuning' },
  { key: 'orange', label: 'Oranye' },
  { key: 'rose', label: 'Merah' },
  { key: 'violet', label: 'Ungu' },
  { key: 'sky', label: 'Biru' },
  { key: 'teal', label: 'Tosca' },
  { key: 'emerald', label: 'Hijau' },
  { key: 'lime', label: 'Lime' },
] as const;

export type AccentKey = (typeof ACCENTS)[number]['key'];

export const BEHAVIORS = [
  { key: 'toggle', label: 'Saklar biasa', hint: 'Tekan sekali nyala, tekan lagi mati.' },
  { key: 'pulse', label: 'Tekan sesaat', hint: 'Nyala beberapa detik lalu mati sendiri. Cocok buat bel / kunci pintu.' },
] as const;

export const BOOT_STATES = [
  { key: 'last', label: 'Seperti terakhir' },
  { key: 'off', label: 'Selalu mati' },
  { key: 'on', label: 'Selalu nyala' },
] as const;

export type ChannelPreset = {
  name: string;
  icon: IconName;
  watt: number;
  behavior?: 'toggle' | 'pulse';
  pulseSec?: number;
  maxOnMin?: number;
  interlock?: number;
  bootState?: 'last' | 'off' | 'on';
};

export type SchedulePreset = {
  label: string;
  onTime: string;
  offTime: string;
  days: number[]; // 0 = Minggu
  channels: number[]; // 0 = CH1
};

export type ScenePreset = {
  name: string;
  icon: IconName;
  actions: (boolean | null)[];
};

export type Template = {
  key: string;
  name: string;
  description: string;
  icon: IconName;
  channels: ChannelPreset[];
  schedules: SchedulePreset[];
  scenes: ScenePreset[];
};

const EVERYDAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

export const TEMPLATES: Template[] = [
  {
    key: 'rumah',
    name: 'Rumah',
    description: 'Lampu teras, ruang tamu, kamar, dan stopkontak.',
    icon: 'lamp',
    channels: [
      { name: 'Lampu Teras', icon: 'lamp', watt: 10 },
      { name: 'Ruang Tamu', icon: 'ceiling', watt: 15 },
      { name: 'Kamar', icon: 'lamp', watt: 10 },
      { name: 'Stopkontak', icon: 'plug', watt: 100 },
    ],
    schedules: [{ label: 'Teras malam', onTime: '18:00', offTime: '05:30', days: EVERYDAY, channels: [0] }],
    scenes: [
      { name: 'Malam', icon: 'moon', actions: [true, false, true, null] },
      { name: 'Pergi', icon: 'door', actions: [true, false, false, false] },
    ],
  },
  {
    key: 'kandang',
    name: 'Kandang / Ternak',
    description: 'Lampu pemanas, kipas, pompa minum, dan lampu kandang.',
    icon: 'bird',
    channels: [
      { name: 'Lampu Pemanas', icon: 'heater', watt: 60, bootState: 'on' },
      { name: 'Kipas', icon: 'fan', watt: 45 },
      { name: 'Pompa Minum', icon: 'pump', watt: 125, maxOnMin: 15 },
      { name: 'Lampu Kandang', icon: 'lamp', watt: 15 },
    ],
    schedules: [
      { label: 'Pemanas malam', onTime: '17:00', offTime: '07:00', days: EVERYDAY, channels: [0] },
      { label: 'Isi minum pagi', onTime: '06:00', offTime: '06:10', days: EVERYDAY, channels: [2] },
      { label: 'Isi minum sore', onTime: '16:00', offTime: '16:10', days: EVERYDAY, channels: [2] },
    ],
    scenes: [{ name: 'Siang panas', icon: 'sun', actions: [false, true, null, false] }],
  },
  {
    key: 'akuarium',
    name: 'Akuarium / Kolam',
    description: 'Filter, lampu, heater, dan aerator.',
    icon: 'fish',
    channels: [
      { name: 'Filter', icon: 'filter', watt: 10, bootState: 'on' },
      { name: 'Lampu Akuarium', icon: 'lamp', watt: 20 },
      { name: 'Heater', icon: 'heater', watt: 100 },
      { name: 'Aerator', icon: 'wind', watt: 5, bootState: 'on' },
    ],
    schedules: [{ label: 'Lampu siang', onTime: '08:00', offTime: '16:00', days: EVERYDAY, channels: [1] }],
    scenes: [{ name: 'Kasih makan', icon: 'fish', actions: [false, true, null, false] }],
  },
  {
    key: 'kebun',
    name: 'Kebun / Hidroponik',
    description: 'Pompa siram, pompa nutrisi, grow light, dan kipas.',
    icon: 'sprout',
    channels: [
      { name: 'Pompa Siram', icon: 'pump', watt: 125, maxOnMin: 30 },
      { name: 'Pompa Nutrisi', icon: 'pump', watt: 30 },
      { name: 'Grow Light', icon: 'sun', watt: 50 },
      { name: 'Kipas', icon: 'fan', watt: 25 },
    ],
    schedules: [
      { label: 'Siram pagi', onTime: '06:00', offTime: '06:15', days: EVERYDAY, channels: [0] },
      { label: 'Siram sore', onTime: '17:00', offTime: '17:15', days: EVERYDAY, channels: [0] },
      { label: 'Cahaya tambahan', onTime: '06:00', offTime: '18:00', days: EVERYDAY, channels: [2] },
    ],
    scenes: [{ name: 'Sirkulasi', icon: 'zap', actions: [null, true, null, true] }],
  },
  {
    key: 'toko',
    name: 'Toko / Kantor',
    description: 'Lampu toko, papan nama, AC, dan kunci pintu.',
    icon: 'store',
    channels: [
      { name: 'Lampu Toko', icon: 'ceiling', watt: 40 },
      { name: 'Papan Nama', icon: 'zap', watt: 30 },
      { name: 'AC', icon: 'ac', watt: 750, maxOnMin: 720 },
      { name: 'Kunci Pintu', icon: 'door', watt: 12, behavior: 'pulse', pulseSec: 3, bootState: 'off' },
    ],
    schedules: [
      { label: 'Jam buka', onTime: '08:00', offTime: '21:00', days: [1, 2, 3, 4, 5, 6], channels: [0, 2] },
      { label: 'Papan nama', onTime: '18:00', offTime: '23:00', days: EVERYDAY, channels: [1] },
    ],
    scenes: [
      { name: 'Buka toko', icon: 'store', actions: [true, null, true, null] },
      { name: 'Tutup toko', icon: 'moon', actions: [false, true, false, null] },
    ],
  },
  {
    key: 'gorden',
    name: 'Gorden / Motor',
    description: 'Motor buka-tutup yang saling mengunci, plus lampu dan stopkontak.',
    icon: 'blinds',
    channels: [
      { name: 'Gorden Buka', icon: 'blinds', watt: 40, behavior: 'pulse', pulseSec: 15, interlock: 1, bootState: 'off' },
      { name: 'Gorden Tutup', icon: 'blinds', watt: 40, behavior: 'pulse', pulseSec: 15, interlock: 1, bootState: 'off' },
      { name: 'Lampu', icon: 'lamp', watt: 10 },
      { name: 'Stopkontak', icon: 'plug', watt: 100 },
    ],
    schedules: [
      { label: 'Buka pagi', onTime: '06:00', offTime: '06:01', days: WEEKDAYS, channels: [0] },
      { label: 'Tutup malam', onTime: '18:30', offTime: '18:31', days: EVERYDAY, channels: [1] },
    ],
    scenes: [],
  },
  {
    key: 'kustom',
    name: 'Kustom',
    description: 'Empat channel kosong, atur sendiri sesuai kebutuhan.',
    icon: 'plug',
    channels: [
      { name: 'Channel 1', icon: 'plug', watt: 10 },
      { name: 'Channel 2', icon: 'plug', watt: 10 },
      { name: 'Channel 3', icon: 'plug', watt: 10 },
      { name: 'Channel 4', icon: 'plug', watt: 10 },
    ],
    schedules: [],
    scenes: [],
  },
];

export function findTemplate(key: string) {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}

// path yang dipakai aplikasi sendiri, nggak boleh jadi slug perangkat
export const RESERVED_SLUGS = ['admin', 'api', 'login', 'logout', 'setup', 'icon', 'manifest', 'favicon.ico', '_next'];

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
