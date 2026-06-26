export const runtime = "nodejs";

export default async function PortalDisabledPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="py-16 text-center">
      <p className="mb-4 text-4xl">🔒</p>
      <h1 className="text-xl font-bold">Portal unavailable</h1>
      <p className="mt-2 text-muted-foreground">
        The patient portal is currently disabled. Please contact your clinic.
      </p>
      <a href={`/portal/${slug}`} className="mt-4 inline-block text-blue-600 hover:underline">
        Back
      </a>
    </div>
  );
}
