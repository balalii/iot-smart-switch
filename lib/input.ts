// Sanitasi input dari request. Sengaja manual (tanpa zod) karena bentuknya kecil-kecil.

export function str(value: unknown, max = 60, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

export function int(value: unknown, min: number, max: number, fallback = min) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function num(value: unknown, min: number, max: number, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export function time(value: unknown, fallback: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export function indexList(value: unknown, size: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < size))].sort();
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
