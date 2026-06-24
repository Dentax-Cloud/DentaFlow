export default function EmergencyLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="flex gap-3">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-8 w-24 rounded bg-red-100" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
