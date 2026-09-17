const VARIANTS = {
  primary:
    'bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 hover:from-brand-blue-500 hover:to-brand-coral-400 text-white shadow-[0_8px_20px_-6px_rgba(47,62,232,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(240,64,95,0.45)] hover:-translate-y-0.5',
  secondary:
    'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  outline:
    'border border-brand-blue-200 text-brand-blue-700 hover:bg-brand-blue-50',
  danger:
    'border border-red-200 text-red-600 hover:bg-red-50',
  success:
    'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)] hover:-translate-y-0.5',
  subtle:
    'bg-slate-100 text-slate-700 hover:bg-slate-200',
  link:
    'text-brand-blue-600 hover:text-brand-blue-800 underline-offset-2 hover:underline px-0 py-0',
};

const SIZES = {
  sm: 'px-4 py-2 text-xs rounded-lg',
  md: 'px-6 py-3 text-sm rounded-xl',
  lg: 'px-8 py-3.5 text-sm rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  uppercase = false,
  as: Component = 'button',
  className = '',
  children,
  ...props
}) {
  const sizeClass = variant === 'link' ? '' : SIZES[size];

  return (
    <Component
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none',
        VARIANTS[variant],
        sizeClass,
        fullWidth ? 'w-full' : '',
        uppercase ? 'uppercase tracking-wider font-bold' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Component>
  );
}
