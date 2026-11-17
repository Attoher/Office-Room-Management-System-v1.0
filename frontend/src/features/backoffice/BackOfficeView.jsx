import { useEffect, useState } from 'react';
import { Building, Gauge, History, Loader2, LogOut } from 'lucide-react';
import Button from '../../components/ui/Button';
import { signOutAdmin, subscribeAdmin } from '../../services/authService';
import AdminLogin from './AdminLogin';
import GuestLog from './GuestLog';
import OfficePicTable from './OfficePicTable';
import StatusRulesForm from './StatusRulesForm';

const SECTIONS = [
  { id: 'tamu', label: 'Riwayat tamu', icon: History },
  { id: 'kantor', label: 'Kantor & PIC', icon: Building },
  { id: 'status', label: 'Aturan status', icon: Gauge },
];

/** Halaman admin: riwayat tamu semua kantor, data PIC kantor, dan batas warna status. */
export default function BackOfficeView({
  offices,
  floors,
  rooms,
  summaries,
  activeOfficeId,
  statusRules,
  onSelectOffice,
}) {
  const [section, setSection] = useState('tamu');
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Back Office</h2>
          <p className="text-sm text-slate-500">
            Riwayat tamu, penanggung jawab (PIC) kantor, dan aturan warna status ruangan.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={() => signOutAdmin()}>
          Keluar
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Bagian back office"
        className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
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

      {section === 'tamu' && <GuestLog offices={offices} activeOfficeId={activeOfficeId} />}
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
