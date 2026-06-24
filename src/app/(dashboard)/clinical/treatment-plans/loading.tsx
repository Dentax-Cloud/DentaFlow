export default function TreatmentPlansLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4">
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
