import { useEffect, useState } from 'react';
import { Building, DoorOpen, Gauge, Loader2, LogOut } from 'lucide-react';
import Button from '../../components/ui/Button';
import { signOutAdmin, subscribeAdmin } from '../../services/authService';
import AdminLogin from './AdminLogin';
import OfficePicTable from './OfficePicTable';
import RoomDirectory from './RoomDirectory';
import StatusRulesForm from './StatusRulesForm';

const SECTIONS = [
  { id: 'ruangan', label: 'Ruangan', icon: DoorOpen },
  { id: 'kantor', label: 'Kantor & PIC', icon: Building },
  { id: 'status', label: 'Aturan status', icon: Gauge },
];

/** Halaman admin: ruangan (detail, denah, riwayat tamu, PDF), PIC kantor, dan batas warna status. */
export default function BackOfficeView({
  offices,
  floors,
  rooms,
  doors,
  elements,
  summaries,
  activeOfficeId,
  statusRules,
  onSelectOffice,
}) {
  const [section, setSection] = useState('ruangan');
  const [admin, setAdmin] = useState(null); // null = memeriksa sesi
  const realOffices = offices.filter((o) => !o.virtual);

  useEffect(() => subscribeAdmin(setAdmin), []);

  if (admin === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Memeriksa sesi admin…
      </div>
    );
  }
  if (!admin) return <AdminLogin />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Back Office</h2>
          <p className="text-sm text-slate-500">
            Ruangan beserta riwayat tamunya, penanggung jawab (PIC) kantor, dan aturan warna status.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={() => signOutAdmin()}>
          Keluar
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Bagian back office"
        className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 print:hidden"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              section === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {section === 'ruangan' && (
        <RoomDirectory
          offices={offices}
          floors={floors}
          rooms={rooms}
          doors={doors}
          elements={elements}
          activeOfficeId={activeOfficeId}
        />
      )}
      {section === 'kantor' && (
        <OfficePicTable
          offices={realOffices}
          floors={floors}
          summaries={summaries}
          activeOfficeId={activeOfficeId}
          onSelectOffice={onSelectOffice}
        />
      )}
      {section === 'status' && (
        <StatusRulesForm
          key={`${statusRules.kuning}-${statusRules.merah}`}
          rules={statusRules}
          offices={offices}
          floors={floors}
          rooms={rooms}
        />
      )}
    </div>
  );
}
