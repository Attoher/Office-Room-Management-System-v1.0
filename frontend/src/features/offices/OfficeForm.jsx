import { useState } from 'react';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

/** Form nama & alamat kantor. `onSubmit(values)` boleh melempar error; pesannya ditampilkan. */
export default function OfficeForm({
  initialValues = { nama: '', alamat: '' },
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}
      <Field label="Nama kantor">
        {(id) => (
          <Input
            id={id}
            value={values.nama}
            maxLength={60}
            placeholder="Contoh: Kantor Pusat Surabaya"
            onChange={(e) => setValues((v) => ({ ...v, nama: e.target.value }))}
          />
        )}
      </Field>
      <Field label="Alamat (opsional)">
        {(id) => (
          <Input
            id={id}
            value={values.alamat}
            maxLength={120}
            placeholder="Contoh: Jl. Raya ITS, Sukolilo"
            onChange={(e) => setValues((v) => ({ ...v, alamat: e.target.value }))}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
