'use client';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';

export function OpenDevice() {
  const router = useRouter();
  const [path, setPath] = useState('');
  const clean = path.trim().toLowerCase().replace(/^.*\//, '');

  return (
    <form
      className="mt-8 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) router.push(`/${clean}`);
      }}
    >
      <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-surface focus-within:border-ink">
        <span className="pl-3 text-muted">/</span>
        <input
          className="h-12 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 outline-none"
          placeholder="perangkat-01"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          aria-label="Alamat perangkat"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>
      <Button type="submit" className="h-12 bg-ink text-bg hover:bg-ink/90" disabled={!clean} aria-label="Buka">
        <ArrowRight className="size-5" />
      </Button>
    </form>
  );
}
