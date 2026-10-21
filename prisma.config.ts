import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'prisma/config';

// baca .env pakai aturan Next.js, biar CLI Prisma & aplikasi pakai database yang sama
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./data/switch.db',
  },
});
