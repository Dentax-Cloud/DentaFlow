export default function TreatmentPlanDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 p-6">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-10 w-96 rounded bg-muted" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
      <div className="h-48 rounded-xl bg-muted" />
    </div>
  );
}
