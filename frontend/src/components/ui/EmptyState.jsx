export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-slate-100 p-3">
          <Icon className="size-6 text-slate-400" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
