import { useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import Button from '../../components/ui/Button';
import { signOutAdmin, subscribeAdmin } from '../../services/authService';
import AdminLogin from './AdminLogin';
import OfficeDetail from './OfficeDetail';
import OfficeDirectory from './OfficeDirectory';

/**
 * Halaman admin berbasis kantor (tanpa tab): daftar kantor, lalu detail satu kantor berisi data &
 * PIC, denah, aturan status, ruangan, dan riwayat tamunya.
 */
export default function BackOfficeView({ offices, floors, rooms, doors, elements }) {
  const [admin, setAdmin] = useState(null); // null = memeriksa sesi
  const [openId, setOpenId] = useState(null);
  const realOffices = useMemo(() => offices.filter((o) => !o.virtual), [offices]);
  const data = useMemo(
    () => ({ floors, rooms, doors, elements }),
    [floors, rooms, doors, elements],
  );

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

  const open = realOffices.find((o) => o.id === openId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Back Office</h2>
          <p className="text-sm text-slate-500">
            Kantor beserta PIC, denah, aturan status, ruangan, dan riwayat tamunya.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} onClick={() => signOutAdmin()}>
          Keluar
        </Button>
      </div>

      {open ? (
        <OfficeDetail
          key={open.id}
          office={open}
          offices={realOffices}
          data={data}
          onBack={() => setOpenId(null)}
        />
      ) : (
        <OfficeDirectory offices={realOffices} data={data} onOpen={setOpenId} />
      )}
    </div>
  );
}
