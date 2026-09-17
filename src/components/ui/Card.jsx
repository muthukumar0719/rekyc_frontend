export default function Card({ children, className = '', as: Component = 'div', ...props }) {
  return (
    <Component
      className={`bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-100/50 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
