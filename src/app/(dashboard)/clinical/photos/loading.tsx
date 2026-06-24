export default function PhotoLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-10 w-72 rounded bg-muted" />
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
