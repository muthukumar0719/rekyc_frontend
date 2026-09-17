import aionionLogo from '../../assets/aionion-logo.png';

export default function PageShell({ children, className = '', contentClassName = '', showLogo = false }) {
  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-rose-50 ${className}`}>
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-brand-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob pointer-events-none" />
      <div className="fixed top-[15%] right-[-10%] w-96 h-96 bg-brand-coral-300/25 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[20%] w-[500px] h-[500px] bg-brand-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000 pointer-events-none" />

      <div className={`relative z-10 ${contentClassName}`}>
        {showLogo && (
          <div className="flex justify-center pt-8 pb-2">
            <img src={aionionLogo} alt="Aionion Capital" className="h-14 md:h-16 object-contain drop-shadow-sm" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
