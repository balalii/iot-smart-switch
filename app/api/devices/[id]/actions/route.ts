import { NextResponse } from 'next/server';
import { authorizeDevice, checkPin, hashPin, isAdmin, loginDevice, PIN_PATTERN } from '@/lib/auth';
import {
  ACCENTS,
  BOOT_STATES,
  CHANNEL_COUNT,
  findTemplate,
  ICONS,
  normalizeSlug,
  RESERVED_SLUGS,
  SCENE_ICONS,
  SLUG_PATTERN,
  TEMPLATES,
} from '@/lib/catalog';
import { db } from '@/lib/db';
import { buildView, Ctx, parseActions, resetScheduleTargets, runEngine, setChannel, setTimer, withDevice } from '@/lib/engine';
import type { Channel } from '@/lib/generated/prisma/client';
import { indexList, int, num, oneOf, readJson, str, time } from '@/lib/input';
import { channelConfig, templateExtras } from '@/lib/provision';
import { listToMask } from '@/lib/time';

export const dynamic = 'force-dynamic';

class ActionError extends Error {}

function fail(message: string): never {
  throw new ActionError(message);
}

// Semua aksi dashboard lewat sini: { action, ...payload }.
// Balasannya state terbaru, jadi UI nggak perlu nunggu polling berikutnya.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = await authorizeDevice(id);
  if (!device) return NextResponse.json({ message: 'Sesi berakhir, masukkan PIN lagi.' }, { status: 401 });

  const body = await readJson(request);
  const admin = await isAdmin();

  try {
    const view = await withDevice(id, async () => {
      const ctx = await Ctx.load(id);
      if (!ctx) fail('Perangkat tidak ditemukan');
      runEngine(ctx);
      await handle(ctx, body, admin);
      await ctx.save();
      // load ulang: jadwal & skenario bisa berubah di luar ctx
      const fresh = await Ctx.load(id);
      return buildView(fresh ?? ctx);
    });
    return NextResponse.json(view);
  } catch (error) {
    if (error instanceof ActionError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ message: 'Terjadi kesalahan di server' }, { status: 500 });
  }
}

function channelOf(ctx: Ctx, value: unknown): Channel {
  const channel = ctx.ch(int(value, -1, CHANNEL_COUNT - 1, -1));
  return channel ?? fail('Channel tidak dikenal');
}

async function handle(ctx: Ctx, body: Record<string, unknown>, admin: boolean) {
  const { device } = ctx;

  switch (body.action) {
    // --- kontrol ---

    case 'set': {
      const channel = channelOf(ctx, body.channel);
      setChannel(ctx, channel, Boolean(body.on), 'ui');
      return;
    }

    case 'all': {
      const on = Boolean(body.on);
      const targets = ctx.channels.filter((c) => c.visible && c.behavior === 'toggle');
      // interlock: kalau "nyalakan semua", cuma channel pertama tiap grup yang dinyalakan
      const usedGroups = new Set<number>();
      for (const channel of targets) {
        if (on && channel.interlock > 0) {
          if (usedGroups.has(channel.interlock)) continue;
          usedGroups.add(channel.interlock);
        }
        setChannel(ctx, channel, on, 'ui', { silent: true });
      }
      ctx.log(on ? 'Semua channel dinyalakan' : 'Semua channel dimatikan', 'ui');
      return;
    }

    case 'timer': {
      const channel = channelOf(ctx, body.channel);
      setTimer(ctx, channel, int(body.minutes, 0, 24 * 60), 'ui');
      return;
    }

    case 'scene-run': {
      const scene = await db.scene.findFirst({ where: { id: str(body.id, 40), deviceId: device.id } });
      if (!scene) fail('Skenario tidak ditemukan');
      const actions = parseActions(scene.actions);
      // matikan dulu baru nyalakan, biar interlock nggak saling tendang
      for (const on of [false, true]) {
        actions.forEach((action, index) => {
          const channel = ctx.ch(index);
          if (channel && action === on) setChannel(ctx, channel, on, 'skenario', { silent: true });
        });
      }
      ctx.log(`Skenario "${scene.name}" dijalankan`, 'skenario');
      return;
    }

    // --- jadwal ---

    case 'schedules-on': {
      const on = Boolean(body.value);
      if (on === device.schedulesOn) return;
      ctx.patchDevice({ schedulesOn: on });
      resetScheduleTargets(ctx);
      ctx.log(on ? 'Jadwal otomatis diaktifkan' : 'Mode libur: semua jadwal dijeda', 'ui');
      runEngine(ctx);
      return;
    }

    case 'schedule-save': {
      const input = (body.schedule ?? {}) as Record<string, unknown>;
      const days = indexList(input.days, 7);
      const channels = indexList(input.channels, CHANNEL_COUNT);
      if (channels.length === 0) fail('Pilih minimal satu channel');
      if (days.length === 0) fail('Pilih minimal satu hari');

      const data = {
        label: str(input.label, 40),
        enabled: input.enabled !== false,
        onTime: time(input.onTime, '18:00'),
        offTime: time(input.offTime, '22:00'),
        days: listToMask(days),
        channels: listToMask(channels),
      };
      if (data.onTime === data.offTime) fail('Jam nyala dan jam mati tidak boleh sama');

      const existing = ctx.device.schedules.find((s) => s.id === input.id);
      const affected = data.channels | (existing?.channels ?? 0);
      if (existing) {
        await db.schedule.update({ where: { id: existing.id }, data });
        Object.assign(existing, data);
        ctx.log(`Jadwal "${data.label || `${data.onTime}–${data.offTime}`}" diubah`, 'ui');
      } else {
        if (ctx.device.schedules.length >= 30) fail('Maksimal 30 jadwal per perangkat');
        const created = await db.schedule.create({
          data: { ...data, deviceId: device.id, sort: ctx.device.schedules.length },
        });
        ctx.device.schedules.push(created);
        ctx.log(`Jadwal "${data.label || `${data.onTime}–${data.offTime}`}" ditambahkan`, 'ui');
      }
      resetScheduleTargets(ctx, affected);
      runEngine(ctx);
      return;
    }

    case 'schedule-delete': {
      const target = ctx.device.schedules.find((s) => s.id === body.id);
      if (!target) fail('Jadwal tidak ditemukan');
      await db.schedule.delete({ where: { id: target.id } });
      ctx.device.schedules = ctx.device.schedules.filter((s) => s.id !== target.id);
      ctx.log(`Jadwal "${target.label || `${target.onTime}–${target.offTime}`}" dihapus`, 'ui');
      resetScheduleTargets(ctx, target.channels);
      runEngine(ctx);
      return;
    }

    // --- skenario ---

    case 'scene-save': {
      const input = (body.scene ?? {}) as Record<string, unknown>;
      const raw = Array.isArray(input.actions) ? input.actions : [];
      const actions = Array.from({ length: CHANNEL_COUNT }, (_, i) =>
        typeof raw[i] === 'boolean' ? raw[i] : null,
      );
      if (actions.every((a) => a === null)) fail('Atur minimal satu channel (nyala atau mati)');

      const data = {
        name: str(input.name, 30) || 'Skenario',
        icon: oneOf(input.icon, [...SCENE_ICONS, ...ICONS], 'sparkles'),
        actions: JSON.stringify(actions),
      };
      const existing = input.id
        ? await db.scene.findFirst({ where: { id: str(input.id, 40), deviceId: device.id } })
        : null;
      if (existing) {
        await db.scene.update({ where: { id: existing.id }, data });
      } else {
        const count = await db.scene.count({ where: { deviceId: device.id } });
        if (count >= 12) fail('Maksimal 12 skenario per perangkat');
        await db.scene.create({ data: { ...data, deviceId: device.id, sort: count } });
      }
      ctx.log(`Skenario "${data.name}" disimpan`, 'ui');
      return;
    }

    case 'scene-delete': {
      const scene = await db.scene.findFirst({ where: { id: str(body.id, 40), deviceId: device.id } });
      if (!scene) fail('Skenario tidak ditemukan');
      await db.scene.delete({ where: { id: scene.id } });
      ctx.log(`Skenario "${scene.name}" dihapus`, 'ui');
      return;
    }

    // --- pengaturan channel ---

    case 'channel-config': {
      const channel = channelOf(ctx, body.channel);
      const input = (body.config ?? {}) as Record<string, unknown>;
      const next = {
        name: str(input.name, 24) || channel.name,
        icon: oneOf(input.icon, ICONS, channel.icon as (typeof ICONS)[number]),
        watt: num(input.watt, 0, 5000, channel.watt),
        visible: input.visible === undefined ? channel.visible : Boolean(input.visible),
        behavior: oneOf(input.behavior, ['toggle', 'pulse'] as const, channel.behavior as 'toggle'),
        pulseSec: int(input.pulseSec, 1, 600, channel.pulseSec),
        maxOnMin: int(input.maxOnMin, 0, 24 * 60, channel.maxOnMin),
        interlock: int(input.interlock, 0, 2, channel.interlock),
        bootState: oneOf(input.bootState, BOOT_STATES.map((b) => b.key), channel.bootState as 'last'),
      };

      const hardwareChanged =
        next.behavior !== channel.behavior ||
        next.pulseSec !== channel.pulseSec ||
        next.interlock !== channel.interlock ||
        next.bootState !== channel.bootState;

      // ganti perilaku / sembunyikan channel -> matikan dulu biar nggak nyangkut nyala
      if (channel.on && (next.behavior !== channel.behavior || !next.visible || next.interlock !== channel.interlock)) {
        setChannel(ctx, channel, false, 'ui', { message: `${channel.name} dimatikan karena pengaturan berubah` });
      }

      ctx.patch(channel, next);
      if (hardwareChanged) ctx.patchDevice({ configVer: ctx.device.configVer + 1 });
      ctx.log(`Pengaturan ${next.name} disimpan`, 'ui', channel.index);
      return;
    }

    case 'template-apply': {
      const template = findTemplate(str(body.template, 20));
      if (!TEMPLATES.some((t) => t.key === body.template)) fail('Template tidak dikenal');

      for (const channel of ctx.channels) {
        setChannel(ctx, channel, false, 'ui', { silent: true });
        ctx.patch(channel, { ...channelConfig(template.channels[channel.index]), scheduleTarget: null });
      }

      if (body.withExtras) {
        const extras = templateExtras(template.key);
        await db.$transaction([
          db.schedule.deleteMany({ where: { deviceId: device.id } }),
          db.scene.deleteMany({ where: { deviceId: device.id } }),
          db.schedule.createMany({ data: extras.schedules.map((s) => ({ ...s, deviceId: device.id })) }),
          db.scene.createMany({ data: extras.scenes.map((s) => ({ ...s, deviceId: device.id })) }),
        ]);
      }

      ctx.patchDevice({ template: template.key, configVer: ctx.device.configVer + 1 });
      ctx.log(`Template "${template.name}" diterapkan, semua channel dimatikan`, 'ui');
      return;
    }

    // --- pengaturan perangkat ---

    case 'device-config': {
      const input = (body.config ?? {}) as Record<string, unknown>;
      const next = {
        name: str(input.name, 40) || device.name,
        description: str(input.description, 120, device.description),
        accent: oneOf(input.accent, ACCENTS.map((a) => a.key), device.accent as 'amber'),
        tariff: num(input.tariff, 0, 100_000, device.tariff),
        activeLow: input.activeLow === undefined ? device.activeLow : Boolean(input.activeLow),
        pollMs: int(input.pollMs, 500, 10_000, device.pollMs),
        failsafe: oneOf(input.failsafe, ['keep', 'off'] as const, device.failsafe as 'keep'),
        failsafeSec: int(input.failsafeSec, 15, 3600, device.failsafeSec),
      };

      const hardwareChanged =
        next.activeLow !== device.activeLow ||
        next.pollMs !== device.pollMs ||
        next.failsafe !== device.failsafe ||
        next.failsafeSec !== device.failsafeSec;

      ctx.patchDevice({ ...next, ...(hardwareChanged ? { configVer: device.configVer + 1 } : {}) });
      ctx.log('Pengaturan perangkat disimpan', 'ui');
      return;
    }

    case 'slug': {
      const slug = normalizeSlug(str(body.slug, 60));
      if (!SLUG_PATTERN.test(slug) || slug.length < 3) fail('Path minimal 3 karakter: huruf kecil, angka, dan tanda -');
      if (RESERVED_SLUGS.includes(slug)) fail('Path itu dipakai sistem, pilih yang lain');
      if (slug === device.slug) return;
      if (await db.device.findUnique({ where: { slug } })) fail('Path sudah dipakai perangkat lain');
      ctx.patchDevice({ slug });
      ctx.log(`Path diganti menjadi /${slug}`, 'ui');
      return;
    }

    case 'pin': {
      const next = str(body.next, 8);
      if (!PIN_PATTERN.test(next)) fail('PIN baru harus 4–8 angka');
      if (!admin && !checkPin(str(body.current, 8), device.pinHash)) fail('PIN lama salah');
      const sessionVersion = device.sessionVersion + 1;
      ctx.patchDevice({ pinHash: hashPin(next), sessionVersion });
      // HP ini tetap login, HP lain otomatis keluar
      await loginDevice({ id: device.id, sessionVersion });
      ctx.log('PIN diganti, semua sesi lain dikeluarkan', 'ui');
      return;
    }

    case 'require-pin': {
      const value = Boolean(body.value);
      if (!value && !admin && !checkPin(str(body.current, 8), device.pinHash)) fail('PIN salah');
      ctx.patchDevice({ requirePin: value });
      ctx.log(value ? 'Akses dengan PIN diaktifkan' : 'Akses tanpa PIN diaktifkan', 'ui');
      return;
    }

    case 'logs-clear': {
      await db.log.deleteMany({ where: { deviceId: device.id } });
      ctx.log('Riwayat dibersihkan', 'ui');
      return;
    }

    case 'usage-reset': {
      await db.usage.deleteMany({ where: { deviceId: device.id } });
      for (const channel of ctx.channels) {
        if (channel.on) ctx.patch(channel, { statsMark: ctx.now });
      }
      ctx.log('Statistik pemakaian direset', 'ui');
      return;
    }

    default:
      fail('Aksi tidak dikenal');
  }
}
