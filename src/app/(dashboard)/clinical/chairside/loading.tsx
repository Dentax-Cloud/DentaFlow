export default function ChairsideLoading() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
