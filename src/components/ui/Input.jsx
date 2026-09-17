export default function Input({ className = '', error = false, ...props }) {
  return (
    <input
      className={[
        'w-full bg-white/60 border rounded-xl px-4 py-3 text-slate-800 shadow-inner transition-all',
        'focus:outline-none focus:bg-white focus:ring-2',
        error
          ? 'border-red-300 focus:ring-red-400/40 focus:border-red-500'
          : 'border-slate-200 focus:ring-brand-blue-500/40 focus:border-brand-blue-500',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
