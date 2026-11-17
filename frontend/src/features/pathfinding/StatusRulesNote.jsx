import { useStatusRules } from '../../components/ui/statusRulesContext';
import { STATUS_ORDER, hasOwnRules } from '../../domain/occupancy';

/** Aturan warna status ruangan yang berlaku (diatur di Back Office). */
export default function StatusRulesNote({ rooms = [] }) {
  const { meta } = useStatusRules();
  const ownRules = rooms.filter(hasOwnRules);
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
      <p className="text-sm font-medium text-slate-700">Aturan status umum</p>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {STATUS_ORDER.map((key) => (
          <li
            key={key}
            className={`rounded-md px-2 py-1.5 text-center ring-1 ring-inset ${meta[key].badge}`}
          >
            <span className="block text-xs font-semibold">{meta[key].label}</span>
            <span className="block text-sm font-semibold tabular-nums">{meta[key].range}</span>
            <span className="block text-[11px] opacity-80">{meta[key].description}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Persen = jumlah orang ÷ kapasitas. Ruangan ramai diberi biaya tambahan, dan ruangan yang
        sudah penuh (100%) dihindari.
      </p>
      {ownRules.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Aturan sendiri:{' '}
          {ownRules
            .map((r) => `${r.nama_ruangan} (kuning ${r.batas_kuning}%, merah ${r.batas_merah}%)`)
            .join(', ')}
          .
        </p>
      )}
    </div>
  );
}
