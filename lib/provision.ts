// Bikin data perangkat baru dari template. Sengaja tanpa 'server-only' & tanpa import db,
// biar bisa dipakai juga oleh prisma/seed.ts yang jalan di luar Next.js.

import { CHANNEL_COUNT, findTemplate, type ChannelPreset } from './catalog';
import type { Prisma } from './generated/prisma/client';
import { listToMask } from './time';

export function channelConfig(preset: ChannelPreset) {
  return {
    name: preset.name,
    icon: preset.icon,
    watt: preset.watt,
    visible: true,
    behavior: preset.behavior ?? 'toggle',
    pulseSec: preset.pulseSec ?? 1,
    maxOnMin: preset.maxOnMin ?? 0,
    interlock: preset.interlock ?? 0,
    bootState: preset.bootState ?? 'last',
  };
}

export function templateExtras(templateKey: string) {
  const template = findTemplate(templateKey);
  return {
    schedules: template.schedules.map((s, i) => ({
      label: s.label,
      onTime: s.onTime,
      offTime: s.offTime,
      days: listToMask(s.days),
      channels: listToMask(s.channels),
      sort: i,
    })),
    scenes: template.scenes.map((s, i) => ({
      name: s.name,
      icon: s.icon,
      actions: JSON.stringify(s.actions),
      sort: i,
    })),
  };
}

export function newDeviceData(input: {
  id: string;
  slug: string;
  name: string;
  owner?: string;
  pinHash: string;
  token: string;
  template: string;
}): Prisma.DeviceCreateInput {
  const template = findTemplate(input.template);
  const extras = templateExtras(template.key);

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    owner: input.owner ?? '',
    pinHash: input.pinHash,
    token: input.token,
    template: template.key,
    channels: {
      create: Array.from({ length: CHANNEL_COUNT }, (_, index) => ({
        index,
        ...channelConfig(template.channels[index]),
      })),
    },
    schedules: { create: extras.schedules },
    scenes: { create: extras.scenes },
    logs: { create: { source: 'sistem', message: `Perangkat dibuat dengan template ${template.name}` } },
  };
}
