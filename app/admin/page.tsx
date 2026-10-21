import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/admin-app';
import { AdminLogin } from '@/components/admin/admin-login';
import { listDevices } from '@/lib/admin';
import { adminConfigured, isAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin configured={adminConfigured()} />;
  return <AdminApp initial={await listDevices()} />;
}
