import { Building2 } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { useToast } from '../../components/ui/feedbackContext';
import { createOffice } from '../../services/officeService';
import OfficeForm from './OfficeForm';

/** Tampilan awal ketika belum ada kantor sama sekali. */
export default function OfficeOnboarding({ onCreated }) {
  const toast = useToast();
  return (
    <Card className="mx-auto max-w-md">
      <CardBody>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Building2 className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Buat kantor pertama</p>
            <p className="text-sm text-slate-500">
              Setiap kantor punya lantai, ruangan, dan denahnya sendiri.
            </p>
          </div>
        </div>
        <OfficeForm
          submitLabel="Buat kantor"
          onSubmit={async (values) => {
            const id = await createOffice(values);
            toast.success(`${values.nama.trim()} dibuat.`);
            onCreated(id);
          }}
        />
      </CardBody>
    </Card>
  );
}
