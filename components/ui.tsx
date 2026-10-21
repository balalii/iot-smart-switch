'use client';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Komponen dasar. Sengaja ditulis sendiri (tanpa library UI) biar bundle kecil
// dan gampang diutak-atik.

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const BUTTON = {
  primary: 'bg-accent text-on-accent hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface-2 text-ink hover:bg-line/70',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON;
  size?: 'sm' | 'md' | 'icon';
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'icon' && 'size-10',
        BUTTON[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

export const inputClass =
  'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            'h-9 flex-1 cursor-pointer rounded-lg px-2 text-sm font-medium transition',
            value === option.key ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}

// --- sheet: <dialog> native, Esc & fokus sudah diurus browser ---

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col rounded-t-3xl border border-line bg-surface text-ink sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup" className="-mr-2">
              <X className="size-5" />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="flex gap-2 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

// --- toast ---

type Toast = { id: number; message: string; tone: 'info' | 'error' };

const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'animate-rise rounded-xl px-4 py-2.5 text-sm font-medium shadow-card',
              toast.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// --- tema ---

export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // baca class yang dipasang script di layout (sebelum hydrate)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  }, []);

  return { dark, toggle };
}
