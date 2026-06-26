export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 text-center">
        <div className="mb-4 text-6xl">🔧</div>
        <h1 className="mb-2 text-2xl font-bold">Under Maintenance</h1>
        <p className="text-muted-foreground">
          DentaFlow is currently undergoing scheduled maintenance. We will be back shortly. Thank
          you for your patience.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          If you are a system administrator, please log in at{" "}
          <a href="/superadmin" className="text-blue-600 underline">
            /superadmin
          </a>
        </p>
      </div>
    </div>
  );
}
