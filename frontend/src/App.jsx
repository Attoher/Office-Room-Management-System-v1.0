import { Suspense, lazy, useEffect, useState } from 'react';
import { Activity, Loader2, Route, Settings2, WifiOff } from 'lucide-react';
import AppHeader from './components/layout/AppHeader';
import IntroDialog from './components/layout/IntroDialog';
import SplashScreen from './components/layout/SplashScreen';
import Button from './components/ui/Button';
import { Card } from './components/ui/Card';
import EmptyState from './components/ui/EmptyState';
import { StatusRulesContext } from './components/ui/statusRulesContext';
import { officeStatusRules } from './domain/occupancy';
import ManagementView from './features/management/ManagementView';
import MonitoringView from './features/monitoring/MonitoringView';
import OfficeOnboarding from './features/offices/OfficeOnboarding';
import OfficeSwitcher from './features/offices/OfficeSwitcher';
import { officeUrl, useActiveOffice } from './hooks/useActiveOffice';
import { useOfficeData } from './hooks/useOfficeData';

// Halaman jalur (denah + pencarian rute) baru dimuat saat dibuka
const PathfindingView = lazy(() => import('./features/pathfinding/PathfindingView'));
const BackOfficeView = lazy(() => import('./features/backoffice/BackOfficeView'));

const TABS = [
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'management', label: 'Manajemen', icon: Settings2 },
  { id: 'pathfinding', label: 'Jalur Tamu', icon: Route },
];

// Back Office tidak ada di menu; hanya dibuka lewat alamat /back-office (seperti dashboard)
const BACK_OFFICE = 'back-office';

// Tab aktif = path URL (/monitoring, /management, /pathfinding, /back-office) supaya bisa di-refresh dan
// dibagikan. vercel.json mengarahkan semua path ke index.html.
function readTabFromPath() {
  const id = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (id === BACK_OFFICE) return id;
  return TABS.some((tab) => tab.id === id) ? id : TABS[0].id;
}

function Loading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(readTabFromPath);
  const data = useOfficeData();
  const { status, error } = data;
  // Semua halaman hanya melihat isi kantor yang sedang dipilih
  const active = useActiveOffice(data);
  const { floors, floorIds, rooms, roomsById, doors, elements } = active;

  useEffect(() => {
    // Path tidak dikenal (termasuk "/") dirapikan ke tab yang ditampilkan
    if (window.location.pathname !== `/${activeTab}`) {
      window.history.replaceState(null, '', `/${activeTab}${window.location.search}`);
    }
    const onPopState = () => setActiveTab(readTabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat pertama dimuat
  }, []);

  const navigate = (tabId) => {
    if (tabId === activeTab) return;
    // Kantor yang dipilih ikut di URL; pilihan khusus halaman (mis. asal/tujuan jalur) tidak
    window.history.pushState(null, '', officeUrl(`/${tabId}`, active.officeId));
    setActiveTab(tabId);
    window.scrollTo({ top: 0 });
  };

  if (status === 'loading') return <SplashScreen />;

  let content;
  if (status === 'error') {
    content = (
      <Card>
        <EmptyState
          icon={WifiOff}
          title="Gagal memuat data"
          description={error?.message}
          action={<Button onClick={() => window.location.reload()}>Muat ulang</Button>}
        />
      </Card>
    );
  } else if (data.offices.length === 0) {
    content = <OfficeOnboarding onCreated={active.selectOffice} />;
  } else if (activeTab === 'monitoring') {
    content = (
      <MonitoringView
        key={active.officeId}
        office={active.office}
        floors={floors}
        rooms={rooms}
        doors={doors}
        onNavigate={navigate}
      />
    );
  } else if (activeTab === 'management') {
    content = (
      <ManagementView
        key={active.officeId}
        office={active.office}
        floors={floors}
        floorIds={floorIds}
        rooms={rooms}
        roomsById={roomsById}
        doors={doors}
        elements={elements}
      />
    );
  } else if (activeTab === BACK_OFFICE) {
    content = (
      <Suspense fallback={<Loading label="Memuat back office…" />}>
        <BackOfficeView
          offices={data.offices}
          floors={data.floors}
          rooms={data.rooms}
          doors={data.doors}
          elements={data.elements}
        />
      </Suspense>
    );
  } else {
    content = (
      <Suspense fallback={<Loading label="Memuat peta ruangan…" />}>
        <PathfindingView
          key={active.officeId}
          office={active.office}
          floors={floors}
          rooms={rooms}
          roomsById={roomsById}
          doors={doors}
          elements={elements}
          onNavigate={navigate}
        />
      </Suspense>
    );
  }

  // Back Office berdiri sendiri: tanpa menu tab, pemilih kantor, dan intro
  const isBackOffice = activeTab === BACK_OFFICE;

  return (
    // Halaman biasa memakai aturan status kantor yang dipilih; Back Office mengatur per kantor
    <StatusRulesContext.Provider value={officeStatusRules(active.office)}>
      <div className="flex min-h-screen flex-col">
        <AppHeader
          tabs={isBackOffice ? [] : TABS}
          subtitle={isBackOffice ? 'Back Office' : undefined}
          activeTab={activeTab}
          onTabChange={navigate}
          status={status}
          officeSwitcher={
            !isBackOffice &&
            data.offices.length > 0 && (
              <OfficeSwitcher
                offices={data.offices}
                floors={data.floors}
                office={active.office}
                summaries={active.summaries}
                onSelect={active.selectOffice}
              />
            )
          }
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 print:max-w-none print:p-0 sm:px-6">
          {content}
        </main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
          Office Room Management · Institut Teknologi Sepuluh Nopember · {new Date().getFullYear()}
        </footer>
        {!isBackOffice && <IntroDialog />}
      </div>
    </StatusRulesContext.Provider>
  );
}
