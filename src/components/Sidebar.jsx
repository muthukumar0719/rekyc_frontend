import { Info, Landmark, Users, FileEdit, FileText } from 'lucide-react';

const TABS = [
  { id: 'personal', label: 'Personal', icon: Info },
  { id: 'bank', label: 'Bank', icon: Landmark },
  { id: 'nominee', label: 'Nominee', icon: Users },
  { id: 'others', label: 'DDPI', icon: FileEdit },
  { id: 'document', label: 'Document', icon: FileText },
];

export default function Sidebar({ active, onSelect, completed = {}, canAccess = () => true }) {
  const activeIndex = TABS.findIndex((t) => t.id === active);

  return (
    <nav className="w-full md:w-[280px] shrink-0 md:sticky md:top-6 self-start">
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-brand-blue-100/40 p-4 md:p-6 relative">
        {/* Vertical Dotted Line */}
        <div className="absolute left-[35px] top-10 bottom-10 w-0 border-l-2 border-dotted border-slate-300" />

        <ul className="space-y-6 relative z-10">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            const isCompleted = index <= activeIndex || !!completed[tab.id];
            const locked = !canAccess(tab.id);
            const handleClick = () => onSelect(tab.id);

            return (
              <li
                key={tab.id}
                className={`relative flex items-center group cursor-pointer ${locked ? 'opacity-50' : ''}`}
              >
                {/* Timeline Dot */}
                <div
                  className="relative z-10 w-6 h-6 shrink-0 flex items-center justify-center bg-transparent"
                  onClick={handleClick}
                >
                  <div className="absolute inset-0 bg-white rounded-full scale-110" />
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-500 to-brand-coral-400 rounded-full animate-ping opacity-40" />
                  )}
                  <div
                    className={`relative w-3.5 h-3.5 rounded-full transition-colors duration-300 ${
                      isCompleted ? 'bg-gradient-to-br from-brand-blue-600 to-brand-coral-500' : 'bg-slate-200'
                    }`}
                  />
                </div>

                {/* Tab Button */}
                <div className="ml-4 flex-1">
                  <button
                    onClick={handleClick}
                    className={`w-full flex items-center gap-3 px-5 py-3 rounded-r-3xl rounded-l-3xl text-[15px] font-semibold transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-blue-600 to-brand-coral-500 text-white shadow-[0_8px_20px_-6px_rgba(240,64,95,0.45)] scale-[1.02]'
                        : 'text-slate-600 hover:bg-white hover:text-brand-blue-700 hover:translate-x-1 hover:shadow-sm'
                    }`}
                  >
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-blue-600'}`}
                    />
                    {tab.label}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
