'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui';
import type { DeviceView } from '@/lib/types';

const POLL_MS = 1500;

export type TabKey = 'kontrol' | 'jadwal' | 'skenario' | 'energi' | 'riwayat' | 'pengaturan';

type ActOptions = {
  optimistic?: (view: DeviceView) => DeviceView;
  success?: string;
};

type Controller = {
  view: DeviceView;
  now: number; // jam lokal yang sudah dikoreksi ke jam server
  act: (body: Record<string, unknown>, opts?: ActOptions) => Promise<boolean>;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  isAdmin: boolean;
};

const DeviceContext = createContext<Controller | null>(null);

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice harus di dalam DeviceProvider');
  return ctx;
}

export function DeviceProvider({
  initial,
  isAdmin,
  children,
}: {
  initial: DeviceView;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [clock, setClock] = useState(() => Date.parse(initial.serverTime));
  const [tab, setTabState] = useState<TabKey>('kontrol');
  const inflight = useRef(0);

  const accept = useCallback((data: DeviceView) => {
    setView(data);
    setOffset(Date.parse(data.serverTime) - Date.now());
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current > 0) return;
    try {
      const res = await fetch(`/api/devices/${initial.id}`, { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      if (!res.ok || inflight.current > 0) return;
      accept(await res.json());
    } catch {
      // jaringan HP putus sebentar, coba lagi di polling berikutnya
    }
  }, [accept, initial.id]);

  // polling, berhenti kalau tab browser nggak kelihatan biar hemat baterai
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        refresh();
        timer = setInterval(refresh, POLL_MS);
      }
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', start);
    };
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // tab disimpan di hash URL, biar refresh halaman nggak balik ke Kontrol
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as TabKey;
    if (['kontrol', 'jadwal', 'skenario', 'energi', 'riwayat', 'pengaturan'].includes(fromHash)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTabState(fromHash);
    }
  }, []);

  const setTab = useCallback((next: TabKey) => {
    setTabState(next);
    window.history.replaceState(null, '', next === 'kontrol' ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0 });
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>, opts: ActOptions = {}) => {
      inflight.current += 1;
      if (opts.optimistic) setView((v) => opts.optimistic!(v));
      try {
        const res = await fetch(`/api/devices/${initial.id}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          window.location.reload();
          return false;
        }
        const data = await res.json().catch(() => ({ message: 'Respons server tidak valid' }));
        if (!res.ok) {
          toast(data.message ?? 'Gagal menyimpan', 'error');
          inflight.current -= 1;
          await refresh();
          inflight.current += 1;
          return false;
        }
        accept(data as DeviceView);
        if (opts.success) toast(opts.success);
        if ((data as DeviceView).slug !== window.location.pathname.slice(1)) {
          router.replace(`/${(data as DeviceView).slug}${window.location.hash}`);
        }
        return true;
      } catch {
        toast('Tidak bisa terhubung ke server', 'error');
        return false;
      } finally {
        inflight.current -= 1;
      }
    },
    [accept, initial.id, refresh, router, toast],
  );

  return (
    <DeviceContext.Provider value={{ view, now: clock + offset, act, tab, setTab, isAdmin }}>
      {children}
    </DeviceContext.Provider>
  );
}
