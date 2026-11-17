import { useState } from 'react';
import { Building, ChevronRight, ExternalLink, FileDown, Phone, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/feedbackContext';
import { STATUS_ORDER, formatPercent, hasOwnRules, statusMeta } from '../../domain/occupancy';
import { createOffice } from '../../services/officeService';
import OfficeForm from '../offices/OfficeForm';
import { formatNumber, officeScope, publicOfficeUrl } from './officeScope';
import { printAsPdf } from './printPdf';

/** Daftar semua kantor dengan PIC, isi, dan aturan statusnya. Klik kantor untuk detail. */
export default function OfficeDirectory({ offices, data, onOpen }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Kantor"
        description={`${offices.length} kantor. Klik kantor untuk melihat denah, detail, aturan status, dan riwayat tamunya.`}
        action={
          <span className="flex gap-2 print:hidden">
            <Button
              variant="secondary"
              size="sm"
              icon={FileDown}
              disabled={offices.length === 0}
              onClick={() => printAsPdf('Daftar kantor')}
            >
              Export PDF
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Tambah kantor
            </Button>
          </span>
        }
      />
      <CardBody>
        {offices.length === 0 ? (
          <EmptyState icon={Building} title="Belum ada kantor" />
        ) : (
          <div className="-mx-5 overflow-x-auto print:mx-0 print:overflow-visible">
            <table className="w-full min-w-[820px] text-left text-sm print:min-w-0">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Kantor</th>
                  <th className="px-3 py-2.5">PIC</th>
                  <th className="px-3 py-2.5">Isi kantor</th>
                  <th className="px-3 py-2.5">Status ruangan</th>
                  <th className="px-3 py-2.5">Aturan</th>
                  <th className="w-20 px-3 py-2.5 print:hidden">
                    <span className="sr-only">Buka</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offices.map((office) => {
                  const scope = officeScope(office, offices, data);
                  const meta = statusMeta(scope.rules);
                  const { summary } = scope;
                  return (
                    <tr
                      key={office.id}
                      onClick={() => onOpen(office.id)}
                      className="cursor-pointer align-top hover:bg-slate-50 print:break-inside-avoid"
                    >
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(office.id);
                          }}
                          className="text-left font-medium text-slate-900 hover:text-blue-600"
                        >
                          {office.nama}
                        </button>
                        {office.alamat && <p className="text-xs text-slate-500">{office.alamat}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {office.pic_nama ? (
                          <>
                            <p className="text-slate-800">{office.pic_nama}</p>
                            <p className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
                              <Phone className="size-3" aria-hidden />
                              {office.pic_telp}
                            </p>
                          </>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            PIC belum diisi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <p>
                          {scope.floors.length} lantai · {summary.totalRooms} ruangan
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatNumber(scope.totalArea)} m² · {summary.totalOccupancy}/
                          {summary.totalCapacity} orang
                          {summary.totalRooms > 0 &&
                            ` · rata-rata ${formatPercent(summary.averagePercent)}`}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {summary.totalRooms === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <>
                            <div className="flex h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                              {STATUS_ORDER.map((key) =>
                                summary.byStatus[key] > 0 ? (
                                  <div
                                    key={key}
                                    className={meta[key].bar}
                                    style={{
                                      width: `${(summary.byStatus[key] / summary.totalRooms) * 100}%`,
                                    }}
                                  />
                                ) : null,
                              )}
                            </div>
                            <p className="mt-1 flex gap-2 text-xs tabular-nums">
                              {STATUS_ORDER.map((key) => (
                                <span key={key} className={meta[key].text}>
                                  {summary.byStatus[key]} {meta[key].label.toLowerCase()}
                                </span>
                              ))}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        <p className="tabular-nums">
                          Kuning {scope.rules.kuning}% · Merah {scope.rules.merah}%
                        </p>
                        <p className="text-slate-400">
                          {hasOwnRules(office) ? 'aturan sendiri' : 'bawaan'}
                        </p>
                      </td>
                      <td className="px-3 py-2 print:hidden">
                        <span className="flex items-center justify-end gap-1">
                          <a
                            href={publicOfficeUrl(office)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Lihat halaman publik kantor ini"
                            aria-label={`Lihat halaman publik ${office.nama}`}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <ExternalLink className="size-4" aria-hidden />
                          </a>
                          <ChevronRight className="size-4 text-slate-400" aria-hidden />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>

      <Modal open={adding} title="Tambah kantor" onClose={() => setAdding(false)}>
        {adding && (
          <OfficeForm
            submitLabel="Tambah kantor"
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              const id = await createOffice(values);
              toast.success(`${values.nama.trim()} ditambahkan.`);
              setAdding(false);
              onOpen(id);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
