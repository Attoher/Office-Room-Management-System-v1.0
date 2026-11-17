import { useState } from 'react';
import { Building, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { createOffice, deleteOffice, updateOffice } from '../../services/officeService';
import OfficeForm from '../offices/OfficeForm';

/** Nomor lokal 08… → 628… untuk link WhatsApp. */
const whatsappNumber = (phone) => phone.replace(/^\+/, '').replace(/^0/, '62');

/** Daftar kantor beserta PIC-nya; tambah, ubah, dan hapus kantor. */
export default function OfficePicTable({
  offices,
  floors,
  summaries,
  activeOfficeId,
  onSelectOffice,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // kantor yang diubah, atau 'baru'

  const missingPic = offices.filter((o) => !o.pic_nama || !o.pic_telp).length;

  const remove = async (office) => {
    const ok = await confirm({
      title: `Hapus ${office.nama}?`,
      message: 'Kantor yang sudah tidak punya lantai akan dihapus.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteOffice(office, floors);
      toast.success(`${office.nama} dihapus.`);
      if (office.id === activeOfficeId) {
        onSelectOffice(offices.find((o) => o.id !== office.id)?.id ?? null);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Kantor & PIC"
        description={
          missingPic > 0
            ? `${missingPic} kantor belum punya PIC. Klik ubah untuk melengkapinya.`
            : 'Setiap kantor punya penanggung jawab yang bisa dihubungi.'
        }
        action={
          <Button size="sm" icon={Plus} onClick={() => setEditing('baru')}>
            Tambah kantor
          </Button>
        }
      />
      <CardBody>
        {offices.length === 0 ? (
          <EmptyState icon={Building} title="Belum ada kantor" />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Kantor</th>
                  <th className="px-3 py-2.5">PIC</th>
                  <th className="px-3 py-2.5">Telepon</th>
                  <th className="px-3 py-2.5">Isi</th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offices.map((office) => {
                  const summary = summaries.get(office.id);
                  return (
                    <tr key={office.id} className="align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{office.nama}</p>
                        {office.alamat && <p className="text-xs text-slate-500">{office.alamat}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {office.pic_nama ? (
                          <span className="text-slate-800">{office.pic_nama}</span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Belum diisi
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {office.pic_telp ? (
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`tel:${office.pic_telp}`}
                              className="inline-flex items-center gap-1.5 tabular-nums text-blue-600 hover:underline"
                            >
                              <Phone className="size-3.5" aria-hidden />
                              {office.pic_telp}
                            </a>
                            <a
                              href={`https://wa.me/${whatsappNumber(office.pic_telp)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-700 hover:underline"
                            >
                              WhatsApp
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                        {summary
                          ? `${summary.floors} lantai · ${summary.rooms} ruangan · ${summary.occupancy}/${summary.capacity} orang`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          icon={Pencil}
                          onClick={() => setEditing(office)}
                          aria-label={`Ubah ${office.nama}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          icon={Trash2}
                          onClick={() => remove(office)}
                          className="hover:bg-red-50 hover:text-red-600"
                          aria-label={`Hapus ${office.nama}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>

      <Modal
        open={editing !== null}
        title={editing === 'baru' ? 'Tambah kantor' : `Ubah ${editing?.nama ?? ''}`}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <OfficeForm
            initialValues={
              editing === 'baru'
                ? undefined
                : {
                    nama: editing.nama,
                    alamat: editing.alamat,
                    pic_nama: editing.pic_nama,
                    pic_telp: editing.pic_telp,
                  }
            }
            submitLabel={editing === 'baru' ? 'Tambah kantor' : 'Simpan'}
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing === 'baru') {
                await createOffice(values);
                toast.success(`${values.nama.trim()} ditambahkan.`);
              } else {
                await updateOffice(editing.id, values);
                toast.success('Data kantor disimpan.');
              }
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
