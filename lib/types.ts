// Bentuk data yang dikirim server ke UI. Dipakai bareng sama client component,
// jadi jangan import apa pun yang server-only di sini.

export type ChannelView = {
  index: number;
  name: string;
  icon: string;
  watt: number;
  visible: boolean;
  behavior: 'toggle' | 'pulse';
  pulseSec: number;
  maxOnMin: number;
  interlock: number;
  bootState: 'last' | 'off' | 'on';
  on: boolean;
  onSince: string | null;
  timerEndsAt: string | null;
  timerReason: '' | 'timer' | 'pulse';
  scheduled: boolean; // ada jadwal aktif yang sedang berjalan buat channel ini
  synced: boolean; // state ESP32 sudah sama dengan server
  todayMs: number;
};

export type ScheduleView = {
  id: string;
  label: string;
  enabled: boolean;
  onTime: string;
  offTime: string;
  days: number[];
  channels: number[];
};

export type SceneView = {
  id: string;
  name: string;
  icon: string;
  actions: (boolean | null)[];
};

export type LogView = {
  id: number;
  at: string;
  channel: number | null;
  source: string;
  message: string;
};

export type DeviceView = {
  id: string;
  slug: string;
  name: string;
  owner: string;
  description: string;
  accent: string;
  template: string;
  requirePin: boolean;
  schedulesOn: boolean;
  tariff: number;
  activeLow: boolean;
  pollMs: number;
  failsafe: 'keep' | 'off';
  failsafeSec: number;
  online: boolean;
  lastSeen: string | null;
  rssi: number;
  uptime: number;
  ip: string;
  fw: string;
  serverTime: string;
  channels: ChannelView[];
  schedules: ScheduleView[];
  scenes: SceneView[];
  logs: LogView[];
  week: { date: string; ms: number[] }[]; // 7 hari terakhir, ms nyala per channel
};

// ringkasan buat dashboard admin
export type DeviceSummary = {
  id: string;
  slug: string;
  name: string;
  owner: string;
  accent: string;
  template: string;
  requirePin: boolean;
  online: boolean;
  lastSeen: string | null;
  rssi: number;
  fw: string;
  ip: string;
  channels: { name: string; icon: string; on: boolean; visible: boolean }[];
};
