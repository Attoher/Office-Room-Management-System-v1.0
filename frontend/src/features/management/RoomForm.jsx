import { useState } from 'react';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { MAX_NAME_LENGTH, validateRoomInput } from '../../domain/roomValidation';

const EMPTY = { nama_ruangan: '', luas: '', kapasitas_max: '' };

/**
 * Form tambah/edit ruangan. `onSubmit(values)` boleh melempar AppError;
 * fieldErrors-nya ditampilkan di bawah field terkait, pesan lainnya di atas form.
 */
export default function RoomForm({
  initialValues = EMPTY,
  currentOccupancy = 0,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: validationErrors } = validateRoomInput(values, { currentOccupancy });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
      if (resetOnSuccess) setValues(EMPTY);
    } catch (error) {
      if (error.fieldErrors) setErrors(error.fieldErrors);
      else setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {formError}
        </p>
      )}

      <Field label="Nama ruangan" error={errors.nama_ruangan}>
        {(id) => (
          <Input
            id={id}
            name="nama_ruangan"
            value={values.nama_ruangan}
            onChange={handleChange}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Contoh: Ruang Rapat A"
            error={errors.nama_ruangan}
            disabled={submitting}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Luas (m²)" error={errors.luas}>
          {(id) => (
            <Input
              id={id}
              name="luas"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values.luas}
              onChange={handleChange}
              placeholder="25"
              error={errors.luas}
              disabled={submitting}
            />
          )}
        </Field>
        <Field
          label="Kapasitas (orang)"
          error={errors.kapasitas_max}
          hint={currentOccupancy > 0 ? `Saat ini terisi ${currentOccupancy} orang` : undefined}
        >
          {(id) => (
            <Input
              id={id}
              name="kapasitas_max"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={values.kapasitas_max}
              onChange={handleChange}
              placeholder="10"
              error={errors.kapasitas_max}
              disabled={submitting}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Batal
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
