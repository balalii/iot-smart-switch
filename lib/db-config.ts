// Alamat database. Sengaja tanpa 'server-only' biar bisa dipakai juga oleh prisma/seed.ts
// & prisma/turso-setup.ts yang jalan di luar Next.js.
//
// Urutan: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (dipasang otomatis oleh integrasi Turso
// di Vercel), lalu DATABASE_URL, lalu file SQLite lokal. TURSO_* didahulukan karena di
// Vercel DATABASE_URL sering sudah dipakai integrasi lain (mis. Prisma Postgres).

// Fungsi, bukan konstanta, biar env yang dimuat belakangan (loadEnvConfig) tetap kebaca.
export function dbConfig() {
  return {
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./data/switch.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  };
}
