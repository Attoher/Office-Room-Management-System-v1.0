import { useEffect, useMemo, useState } from 'react';
import { Download, History, Search, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Field, Input, Select } from '../../components/ui/Field';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import {
  VISIT_STATUS_LABEL,
  formatDateTime,
  matchesVisit,
  startOfDay,
  visitsToCsv,
} from '../../domain/guestVisit';
import { deleteGuestVisit, subscribeGuestVisits } from '../../services/guestVisitService';

const STATUS_BADGE = {
  aman: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  penuh: 'bg-red-50 text-red-700 ring-red-600/20',
  'tidak-ada-jalur': 'bg-slate-50 text-slate-700 ring-slate-600/20',
};

// <input type="date"> memakai format YYYY-MM-DD menurut waktu lokal
const toDateInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDay = (text) =>
  fromDateInput(text).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
function fromDateInput(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function defaultRange() {
  const today = startOfDay();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(today) };
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Riwayat tamu: filter tanggal, kantor, kata kunci, export CSV, dan hapus. Dengan `office` hanya
 * tamu kantor itu (tanpa pilihan kantor); klik baris memanggil `onSelectVisit`.
 */
export default function GuestLog({
  offices,
  activeOfficeId,
  office = null,
  selectedVisitId = null,
  onSelectVisit,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [range, setRange] = useState(defaultRange);
  const [officeFilter, setOfficeFilter] = useState(
    office ? String(office.id) : String(activeOfficeId ?? 'semua'),
  );
  const showOffice = !office && officeFilter === 'semua';
  const [search, setSearch] = useState('');
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState(null);

  const rangeValid = Boolean(range.from && range.to && range.from <= range.to);

  useEffect(() => {
    if (!rangeValid) return undefined;
    setVisits(null);
    const until = fromDateInput(range.to);
    until.setDate(until.getDate() + 1); // sampai akhir hari "sampai"
    return subscribeGuestVisits(
      { since: fromDateInput(range.from), until },
      (data) => {
        setVisits(data);
        setError(null);
      },
      setError,
    );
  }, [range.from, range.to, rangeValid]);

  const officeNames = useMemo(() => new Map(offices.map((o) => [o.id, o.nama])), [offices]);
  const officeName = (id) => officeNames.get(id) ?? 'Kantor terhapus';

  const shown = useMemo(
    () =>
      (visits ?? []).filter(
        (v) =>
          (officeFilter === 'semua' || v.office_id === Number(officeFilter)) &&
          matchesVisit(v, search),
      ),
    [visits, officeFilter, search],
  );

  const instanceCount = new Set(shown.map((v) => v.instansi.toLowerCase())).size;

  const remove = async (visit) => {
    const ok = await confirm({
      title: 'Hapus catatan tamu?',
      message: `${visit.nama} (${visit.instansi}), ${formatDateTime(visit.created_at)}.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGuestVisit(visit.id);
      toast.success('Catatan tamu dihapus.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const exportCsv = () => {
    const prefix = office
      ? `riwayat-tamu-${office.nama.toLowerCase().replace(/\s+/g, '-')}`
      : 'riwayat-tamu';
    downloadText(visitsToCsv(shown, officeName), `${prefix}-${range.from}_${range.to}.csv`);
  };

  let body;
  if (!rangeValid) {
    body = <EmptyState icon={History} title="Tanggal 'dari' harus sebelum 'sampai'" />;
  } else if (error) {
    body = (
      <EmptyState icon={History} title="Riwayat tidak bisa dimuat" description={error.message} />
    );
  } else if (visits === null) {
    body = <p className="py-10 text-center text-sm text-slate-500">Memuat riwayat…</p>;
  } else if (shown.length === 0) {
    body = (
      <EmptyState
        icon={History}
        title="Tidak ada tamu"
        description="Belum ada kunjungan yang cocok dengan filter ini."
      />
    );
  } else {
    body = (
      <div className="-mx-5 overflow-x-auto print:mx-0 print:overflow-visible">
        <table className="w-full min-w-[760px] text-left text-sm print:min-w-0">
          <thead className="border-y border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Waktu</th>
              <th className="px-3 py-2.5">Tamu</th>
              {showOffice && <th className="px-3 py-2.5">Kantor</th>}
              <th className="px-3 py-2.5">Jalur</th>
              <th className="px-3 py-2.5 text-right">Jarak</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-5 py-2.5 print:hidden">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((visit) => (
              <tr
                key={visit.id}
                onClick={onSelectVisit ? () => onSelectVisit(visit) : undefined}
                aria-selected={onSelectVisit ? visit.id === selectedVisitId : undefined}
                className={`align-top print:break-inside-avoid ${onSelectVisit ? 'cursor-pointer' : ''} ${
                  visit.id === selectedVisitId
                    ? 'bg-blue-50'
                    : onSelectVisit
                      ? 'hover:bg-slate-50'
                      : ''
                }`}
              >
                <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600">
                  {formatDateTime(visit.created_at)}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{visit.nama}</p>
                  <p className="text-xs text-slate-500">{visit.instansi}</p>
                </td>
                {showOffice && (
                  <td className="px-3 py-3 text-slate-600">{officeName(visit.office_id)}</td>
                )}
                <td className="px-3 py-3 text-slate-700">
                  {visit.asal_nama} → {visit.tujuan_nama}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                  {visit.jarak == null
                    ? '—'
                    : `${visit.jarak.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m`}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[visit.status] ?? STATUS_BADGE['tidak-ada-jalur']}`}
                  >
                    {VISIT_STATUS_LABEL[visit.status] ?? visit.status}
                  </span>
                </td>
                <td className="px-5 py-2 text-right print:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={Trash2}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(visit);
                    }}
                    className="hover:bg-red-50 hover:text-red-600"
                    aria-label={`Hapus catatan ${visit.nama}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title={office ? 'Riwayat tamu kantor ini' : 'Riwayat tamu'}
        description={
          visits && rangeValid ? (
            <>
              {shown.length} kunjungan · {instanceCount} instansi · {formatDay(range.from)} –{' '}
              {formatDay(range.to)}
              {onSelectVisit && shown.length > 0 && (
                <span className="print:hidden">. Klik tamu untuk melihat jalurnya di denah.</span>
              )}
            </>
          ) : (
            'Dicatat dari halaman Jalur Tamu'
          )
        }
        action={
          <span className="print:hidden">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              disabled={shown.length === 0}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          </span>
        }
      />
      <CardBody>
        <div
          className={`mb-4 grid grid-cols-1 gap-3 print:hidden sm:grid-cols-2 ${office ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          <Field label="Dari tanggal">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Sampai tanggal">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            )}
          </Field>
          {!office && (
            <Field label="Kantor">
              {(id) => (
                <Select
                  id={id}
                  value={officeFilter}
                  onChange={(e) => setOfficeFilter(e.target.value)}
                >
                  <option value="semua">Semua kantor</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Cari">
            {(id) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id={id}
                  type="search"
                  value={search}
                  placeholder="Nama, instansi, ruangan…"
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </Field>
        </div>
        {body}
      </CardBody>
    </Card>
  );
}
