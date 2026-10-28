import { Building2 } from 'lucide-react';

const STATUS_VIEW = {
  loading: { dot: 'bg-amber-400 animate-pulse', label: 'Menghubungkan…' },
  ready: { dot: 'bg-emerald-500', label: 'Tersinkron' },
  error: { dot: 'bg-red-500', label: 'Terputus' },
};

export default function AppHeader({ tabs, activeTab, onTabChange, status }) {
  const statusView = STATUS_VIEW[status];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-blue-600 p-2 text-white">
            <Building2 className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">
              Office Room Management
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              Monitoring occupancy & jalur tamu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600" role="status">
          <span className={`size-2 rounded-full ${statusView.dot}`} aria-hidden />
          <span className="hidden sm:inline">{statusView.label}</span>
        </div>
      </div>

      <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6" aria-label="Menu utama">
        <ul className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onTabChange(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
