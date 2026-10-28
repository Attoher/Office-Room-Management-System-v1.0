import { useId } from 'react';

const controlClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500';

function controlRing(error) {
  return error ? 'ring-red-300' : 'ring-slate-300';
}

/** Label + kontrol + pesan error. `children` menerima id kontrol. */
export function Field({ label, hint, error, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function Input({ error, className = '', ...props }) {
  return (
    <input
      aria-invalid={Boolean(error)}
      className={`${controlClass} ${controlRing(error)} ${className}`}
      {...props}
    />
  );
}

export function Select({ error, className = '', children, ...props }) {
  return (
    <select
      aria-invalid={Boolean(error)}
      className={`${controlClass} ${controlRing(error)} pr-8 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
