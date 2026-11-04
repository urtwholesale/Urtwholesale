/**
 * Shared Button & Interactive Element Style Guide
 *
 * Variants:
 * - primary:   bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active, shadow-xs, rounded-xl, font-semibold, focus-visible:ring-2 ring-ring ring-offset-2
 * - secondary: bg-primary-soft text-primary border border-primary-border hover:bg-primary-soft/70
 * - outline:   bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle
 * - ghost:     bg-transparent text-primary hover:bg-primary-soft
 * - danger:    bg-danger text-white hover:bg-danger/90 (never teal)
 * - disabled:  opacity-50, cursor-not-allowed, no hover change
 *
 * Sizes:
 * - sm: h-9 px-3 text-sm rounded-xl font-semibold
 * - md: h-11 px-4 text-sm rounded-xl font-semibold
 * - lg: h-12 px-6 text-base rounded-xl font-semibold
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon-md';

export const buttonBase =
  'inline-flex items-center justify-center gap-2 transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-xs rounded-xl font-semibold focus-visible:ring-2 ring-ring ring-offset-2',
  secondary:
    'bg-primary-soft text-primary border border-primary-border hover:bg-primary-soft/70 shadow-xs rounded-xl font-semibold focus-visible:ring-2 ring-ring ring-offset-2',
  outline:
    'bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle shadow-xs rounded-xl font-semibold focus-visible:ring-2 ring-ring ring-offset-2',
  ghost:
    'bg-transparent text-primary hover:bg-primary-soft rounded-xl font-semibold focus-visible:ring-2 ring-ring ring-offset-2',
  danger:
    'bg-danger text-white hover:bg-danger/90 shadow-xs rounded-xl font-semibold focus-visible:ring-2 ring-danger ring-offset-2',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl font-semibold',
  md: 'h-11 px-4 text-sm rounded-xl font-semibold',
  lg: 'h-12 px-6 text-base rounded-xl font-semibold',
  'icon-xs': 'h-7 w-7 p-0 rounded-lg text-xs',
  'icon-sm': 'h-9 w-9 p-0 rounded-xl',
  'icon-md': 'h-11 w-11 p-0 rounded-xl',
};

export const pillVariants = {
  active: 'bg-primary text-on-primary font-semibold shadow-xs',
  inactive:
    'bg-transparent border border-surface-border text-slate-700 dark:text-slate-200 hover:bg-surface-card-subtle font-medium',
};

export function buttonClasses(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const variant = options?.variant ?? 'primary';
  const size = options?.size ?? 'md';
  const extra = options?.className ? ` ${options.className}` : '';
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}${extra}`.trim();
}

