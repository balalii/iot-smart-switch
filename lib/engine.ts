import 'server-only';
import { db } from './db';
import type { Channel, Device, Prisma, Schedule } from './generated/prisma/client';
import { isWindowActive, hasBit, jakarta, jakartaDateDaysAgo, maskToList } from './time';
import type { DeviceView } from './types';

// Otak sistemnya. Semua perubahan state lewat Ctx: load sekali, ubah di memori,
// simpan sekali. Timer/jadwal dievaluasi tiap kali state dibaca (ESP32 polling
// tiap detik), jadi nggak butuh cron.

const OFFLINE_MIN_MS = 10_000;
const STATS_FLUSH_MS = 15_000;
const MAX_LOGS = 300;

type FullDevice = Device & { channels: Channel[]; schedules: Schedule[] };

// --- kunci per perangkat ---
// UI dan ESP32 bisa nembak barengan; tanpa ini read-modify-write-nya bisa saling timpa.

const globalLocks = globalThis as unknown as { __switchLocks?: Map<string, Promise<unknown>> };
const locks = (globalLocks.__switchLocks ??= new Map());

export function withDevice<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(id, next.catch(() => undefined));
  return next;
}

// --- context ---

export class Ctx {
  readonly now = new Date();
  private deviceDirty: Prisma.DeviceUpdateInput = {};
  private channelDirty = new Map<number, Prisma.ChannelUpdateInput>();
  private logs: { channel: number | null; source: string; message: string }[] = [];
  private usage = new Map<string, number>();

  constructor(readonly device: FullDevice) {}

  static async load(id: string) {
    const device = await db.device.findUnique({
      where: { id },
      include: { channels: { orderBy: { index: 'asc' } }, schedules: { orderBy: { sort: 'asc' } } },
    });
    return device ? new Ctx(device) : null;
  }

  get channels() {
    return this.device.channels;
  }

  ch(index: number) {
    return this.device.channels.find((c) => c.index === index);
  }

  patchDevice(data: Partial<Device>) {
    Object.assign(this.device, data);
    Object.assign(this.deviceDirty, data);
  }

  patch(channel: Channel, data: Partial<Channel>) {
    Object.assign(channel, data);
    this.channelDirty.set(channel.id, { ...this.channelDirty.get(channel.id), ...data });
  }

  log(message: string, source: string, channel: number | null = null) {
    this.logs.push({ message, source, channel });
  }

  addUsage(channel: Channel, ms: number) {
    if (ms <= 0) return;
    const key = `${channel.index}|${jakarta(this.now).date}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + Math.round(ms));
  }

  async save() {
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const deviceId = this.device.id;

    if (Object.keys(this.deviceDirty).length > 0) {
      ops.push(db.device.update({ where: { id: deviceId }, data: this.deviceDirty }));
    }

    for (const [id, data] of this.channelDirty) {
      ops.push(db.channel.update({ where: { id }, data }));
    }

    if (this.logs.length > 0) {
      // createMany nggak jamin urutan id, jadi tiap log dikasih jarak 1 ms
      const base = this.now.getTime();
      ops.push(
        db.log.createMany({
          data: this.logs.map((l, i) => ({ ...l, deviceId, at: new Date(base + i) })),
        }),
      );
    }

    for (const [key, ms] of this.usage) {
      const [channel, date] = key.split('|');
      const id = { deviceId, channel: Number(channel), date };
      ops.push(
        db.usage.upsert({
          where: { deviceId_channel_date: id },
          create: { ...id, onMs: ms },
          update: { onMs: { increment: ms } },
        }),
      );
    }

    if (ops.length > 0) await db.$transaction(ops);
    if (this.logs.length > 0 && Math.random() < 0.05) await pruneLogs(deviceId);

    this.deviceDirty = {};
    this.channelDirty.clear();
    this.logs = [];
    this.usage.clear();
  }
}

async function pruneLogs(deviceId: string) {
  const cutoff = await db.log.findFirst({
    where: { deviceId },
    orderBy: { at: 'desc' },
    skip: MAX_LOGS,
    select: { at: true },
  });
  if (cutoff) await db.log.deleteMany({ where: { deviceId, at: { lte: cutoff.at } } });
}

// --- helper state ---

export function offlineAfter(device: Device) {
  return Math.max(OFFLINE_MIN_MS, device.pollMs * 6);
}

export function isOnline(device: Device, now: Date) {
  return device.lastSeen ? now.getTime() - device.lastSeen.getTime() < offlineAfter(device) : false;
}

function flushStats(ctx: Ctx, channel: Channel) {
  if (!channel.on || !channel.statsMark) return;
  ctx.addUsage(channel, ctx.now.getTime() - channel.statsMark.getTime());
  ctx.patch(channel, { statsMark: ctx.now });
}

type SetOptions = {
  message?: string;
  silent?: boolean;
  fromDevice?: boolean; // perubahan datang dari tombol fisik, ESP32 sudah ngerjain duluan
};

// satu-satunya jalan buat ubah relay, biar interlock, log, dan statistik nggak bocor
export function setChannel(ctx: Ctx, channel: Channel, on: boolean, source: string, opts: SetOptions = {}) {
  const now = ctx.now;

  if (on) {
    // interlock: matikan dulu channel lain di grup yang sama
    if (channel.interlock > 0) {
      for (const other of ctx.channels) {
        if (other.index !== channel.index && other.interlock === channel.interlock && other.on) {
          setChannel(ctx, other, false, source, { message: `${other.name} dimatikan (interlock)` });
        }
      }
    }

    if (channel.behavior === 'pulse') {
      if (channel.on) flushStats(ctx, channel);
      ctx.patch(channel, {
        on: true,
        onSince: now,
        statsMark: now,
        timerEndsAt: new Date(now.getTime() + channel.pulseSec * 1000),
        timerReason: 'pulse',
        pulsePending: !opts.fromDevice,
      });
      if (!opts.silent) ctx.log(opts.message ?? `${channel.name} ditekan`, source, channel.index);
      return;
    }

    if (channel.on) return;
    ctx.patch(channel, { on: true, onSince: now, statsMark: now });
    if (!opts.silent) ctx.log(opts.message ?? `${channel.name} dinyalakan`, source, channel.index);
    return;
  }

  if (!channel.on) {
    if (channel.timerEndsAt) ctx.patch(channel, { timerEndsAt: null, timerReason: '' });
    return;
  }

  flushStats(ctx, channel);
  ctx.patch(channel, {
    on: false,
    onSince: null,
    statsMark: null,
    timerEndsAt: null,
    timerReason: '',
    pulsePending: false,
  });
  if (!opts.silent) ctx.log(opts.message ?? `${channel.name} dimatikan`, source, channel.index);
}

// nyalakan selama n menit; 0 = batalkan timer
export function setTimer(ctx: Ctx, channel: Channel, minutes: number, source: string) {
  if (channel.behavior === 'pulse') return;

  if (minutes <= 0) {
    if (channel.timerReason === 'timer') {
      ctx.patch(channel, { timerEndsAt: null, timerReason: '' });
      ctx.log(`Timer ${channel.name} dibatalkan`, source, channel.index);
    }
    return;
  }

  setChannel(ctx, channel, true, source, { silent: true });
  ctx.patch(channel, {
    timerEndsAt: new Date(ctx.now.getTime() + minutes * 60_000),
    timerReason: 'timer',
  });
  ctx.log(`${channel.name} dinyalakan, mati otomatis dalam ${formatMinutes(minutes)}`, source, channel.index);
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

// --- engine, jalan tiap kali state dibaca ---

export function runEngine(ctx: Ctx) {
  const { device, now } = ctx;

  if (device.online && !isOnline(device, now)) {
    ctx.patchDevice({ online: false });
    ctx.log('Perangkat offline, tidak ada kabar dari ESP32', 'perangkat');
  }

  for (const channel of ctx.channels) {
    if (channel.on && channel.statsMark && now.getTime() - channel.statsMark.getTime() >= STATS_FLUSH_MS) {
      flushStats(ctx, channel);
    }

    if (channel.timerEndsAt && now >= channel.timerEndsAt) {
      const pulse = channel.timerReason === 'pulse';
      setChannel(ctx, channel, false, 'timer', {
        silent: pulse,
        message: `Timer habis, ${channel.name} dimatikan`,
      });
      continue;
    }

    if (
      channel.on &&
      channel.behavior === 'toggle' &&
      channel.maxOnMin > 0 &&
      channel.onSince &&
      now.getTime() - channel.onSince.getTime() >= channel.maxOnMin * 60_000
    ) {
      setChannel(ctx, channel, false, 'sistem', {
        message: `${channel.name} dimatikan, batas nyala ${formatMinutes(channel.maxOnMin)} tercapai`,
      });
    }
  }

  runSchedules(ctx);
}

function runSchedules(ctx: Ctx) {
  const { device, now } = ctx;
  const { day, minutes } = jakarta(now);

  for (const channel of ctx.channels) {
    const related = device.schedules.filter((s) => s.enabled && hasBit(s.channels, channel.index));

    if (!device.schedulesOn || related.length === 0) {
      if (channel.scheduleTarget !== null) ctx.patch(channel, { scheduleTarget: null });
      continue;
    }

    const active = related.find((s) => isWindowActive(s, day, minutes));
    const target = Boolean(active);

    // sengaja cuma bertindak pas jadwal berubah kondisi, bukan tiap tick.
    // efeknya: override manual bertahan sampai batas jadwal berikutnya.
    if (target === channel.scheduleTarget) continue;

    const first = channel.scheduleTarget === null;
    ctx.patch(channel, { scheduleTarget: target });

    // evaluasi pertama di luar jam jadwal: jangan matikan yang lagi dinyalakan manual
    if (first && !target) continue;

    if (target) {
      const label = active!.label || `${active!.onTime}–${active!.offTime}`;
      setChannel(ctx, channel, true, 'jadwal', {
        message:
          channel.behavior === 'pulse'
            ? `Jadwal "${label}": ${channel.name} ditekan`
            : `Jadwal "${label}": ${channel.name} dinyalakan`,
      });
    } else if (channel.behavior === 'toggle') {
      setChannel(ctx, channel, false, 'jadwal', { message: `Jadwal selesai, ${channel.name} dimatikan` });
    }
  }
}

// jadwal diubah -> channel yang kena dievaluasi ulang dari awal.
// channel lain nggak disentuh, biar override manualnya nggak ketimpa.
export function resetScheduleTargets(ctx: Ctx, mask = 0b1111) {
  for (const channel of ctx.channels) {
    if (hasBit(mask, channel.index) && channel.scheduleTarget !== null) {
      ctx.patch(channel, { scheduleTarget: null });
    }
  }
}

// --- sinkron ESP32 ---

export type SyncBody = {
  r?: number[];
  ev?: [number, number][];
  cv?: number;
  rssi?: number;
  up?: number;
  ip?: string;
  fw?: string;
};

export async function syncDevice(id: string, body: SyncBody) {
  return withDevice(id, async () => {
    const ctx = await Ctx.load(id);
    if (!ctx) return null;
    const { device } = ctx;

    ctx.patchDevice({
      lastSeen: ctx.now,
      rssi: clampInt(body.rssi, -127, 0),
      uptime: clampInt(body.up, 0, 2_000_000_000),
      ip: String(body.ip ?? '').slice(0, 45),
      fw: String(body.fw ?? '').slice(0, 20),
    });

    if (!device.online) {
      ctx.patchDevice({ online: true });
      ctx.log(`Perangkat terhubung${body.ip ? ` (${body.ip})` : ''}`, 'perangkat');
    }

    // tombol fisik: ESP32 sudah ganti relay duluan, server tinggal nyusul
    for (const [index, value] of Array.isArray(body.ev) ? body.ev.slice(0, 20) : []) {
      const channel = ctx.ch(Number(index));
      if (!channel) continue;
      const on = Boolean(value);
      setChannel(ctx, channel, on, 'tombol', {
        fromDevice: true,
        message: `${channel.name} ${on ? (channel.behavior === 'pulse' ? 'ditekan' : 'dinyalakan') : 'dimatikan'} lewat tombol`,
      });
    }

    runEngine(ctx);

    if (Array.isArray(body.r)) {
      for (const channel of ctx.channels) {
        const reported = body.r[channel.index] === undefined ? null : Boolean(body.r[channel.index]);
        if (reported !== channel.reported) ctx.patch(channel, { reported });
      }
    }

    const pulses: [number, number][] = [];
    for (const channel of ctx.channels) {
      if (channel.pulsePending) {
        pulses.push([channel.index, channel.pulseSec * 1000]);
        ctx.patch(channel, { pulsePending: false });
      }
    }

    await ctx.save();

    const response: Record<string, unknown> = {
      // channel pulse dikendalikan ESP32 sendiri lewat "p", jadi di sini selalu 0
      r: ctx.channels.map((c) => (c.on && c.behavior === 'toggle' ? 1 : 0)),
      cv: device.configVer,
      t: Math.floor(ctx.now.getTime() / 1000),
    };
    if (pulses.length > 0) response.p = pulses;
    if (body.cv !== device.configVer) response.cfg = deviceConfig(ctx);
    return response;
  });
}

// config hardware yang disimpan ESP32 di flash, biar tetap jalan walau server mati
function deviceConfig(ctx: Ctx) {
  const { device, channels } = ctx;
  return {
    al: device.activeLow ? 1 : 0,
    poll: device.pollMs,
    fs: device.failsafe,
    fss: device.failsafeSec,
    il: channels.map((c) => c.interlock),
    bs: channels.map((c) => c.bootState),
    pl: channels.map((c) => (c.behavior === 'pulse' ? c.pulseSec * 1000 : 0)),
  };
}

function clampInt(value: unknown, min: number, max: number) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
}

// --- view buat UI ---

export async function getDeviceView(id: string, logLimit = 40): Promise<DeviceView | null> {
  return withDevice(id, async () => {
    const ctx = await Ctx.load(id);
    if (!ctx) return null;
    runEngine(ctx);
    await ctx.save();
    return buildView(ctx, logLimit);
  });
}

// dipanggil di dalam withDevice setelah aksi, biar UI langsung dapat state terbaru
export async function buildView(ctx: Ctx, logLimit = 40): Promise<DeviceView> {
  const { device, now } = ctx;
  const today = jakarta(now).date;
  const since = jakartaDateDaysAgo(now, 6);

  const [scenes, logs, usage] = await Promise.all([
    db.scene.findMany({ where: { deviceId: device.id }, orderBy: { sort: 'asc' } }),
    db.log.findMany({ where: { deviceId: device.id }, orderBy: { at: 'desc' }, take: logLimit }),
    db.usage.findMany({ where: { deviceId: device.id, date: { gte: since } } }),
  ]);

  // durasi yang belum di-flush ke tabel Usage
  const pending = (c: Channel) => (c.on && c.statsMark ? now.getTime() - c.statsMark.getTime() : 0);
  const online = isOnline(device, now);
  const { day, minutes } = jakarta(now);

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = jakartaDateDaysAgo(now, 6 - i);
    const ms = ctx.channels.map((c) => {
      const stored = usage.find((u) => u.date === date && u.channel === c.index)?.onMs ?? 0;
      return stored + (date === today ? pending(c) : 0);
    });
    return { date, ms };
  });

  return {
    id: device.id,
    slug: device.slug,
    name: device.name,
    owner: device.owner,
    description: device.description,
    accent: device.accent,
    template: device.template,
    requirePin: device.requirePin,
    schedulesOn: device.schedulesOn,
    tariff: device.tariff,
    activeLow: device.activeLow,
    pollMs: device.pollMs,
    failsafe: device.failsafe === 'off' ? 'off' : 'keep',
    failsafeSec: device.failsafeSec,
    online,
    lastSeen: device.lastSeen?.toISOString() ?? null,
    rssi: device.rssi,
    uptime: device.uptime,
    ip: device.ip,
    fw: device.fw,
    serverTime: now.toISOString(),
    channels: ctx.channels.map((c) => ({
      index: c.index,
      name: c.name,
      icon: c.icon,
      watt: c.watt,
      visible: c.visible,
      behavior: c.behavior === 'pulse' ? 'pulse' : 'toggle',
      pulseSec: c.pulseSec,
      maxOnMin: c.maxOnMin,
      interlock: c.interlock,
      bootState: c.bootState === 'on' || c.bootState === 'off' ? c.bootState : 'last',
      on: c.on,
      onSince: c.onSince?.toISOString() ?? null,
      timerEndsAt: c.timerEndsAt?.toISOString() ?? null,
      timerReason: c.timerReason === 'timer' || c.timerReason === 'pulse' ? c.timerReason : '',
      scheduled:
        device.schedulesOn &&
        device.schedules.some((s) => s.enabled && hasBit(s.channels, c.index) && isWindowActive(s, day, minutes)),
      // pulse dieksekusi ESP32 sendiri, jadi dianggap selalu sinkron
      synced: !online || c.behavior === 'pulse' || c.reported === null || c.reported === c.on,
      todayMs: week[6].ms[c.index] ?? 0,
    })),
    schedules: device.schedules.map((s) => ({
      id: s.id,
      label: s.label,
      enabled: s.enabled,
      onTime: s.onTime,
      offTime: s.offTime,
      days: maskToList(s.days, 7),
      channels: maskToList(s.channels, 4),
    })),
    scenes: scenes.map((s) => ({ id: s.id, name: s.name, icon: s.icon, actions: parseActions(s.actions) })),
    logs: logs.map((l) => ({
      id: l.id,
      at: l.at.toISOString(),
      channel: l.channel,
      source: l.source,
      message: l.message,
    })),
    week,
  };
}

export function parseActions(json: string): (boolean | null)[] {
  try {
    const value = JSON.parse(json);
    if (Array.isArray(value)) {
      return Array.from({ length: 4 }, (_, i) => (typeof value[i] === 'boolean' ? value[i] : null));
    }
  } catch {}
  return [null, null, null, null];
}
