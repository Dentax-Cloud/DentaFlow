import Link from "next/link";

/** Standalone module entry points — browse mode without an active encounter. */
export function ClinicalBrowseLinks() {
  return (
    <p className="text-sm text-muted-foreground">
      Browse without an active encounter:{" "}
      <Link href="/clinical/perio" className="underline hover:text-foreground">
        Periodontal
      </Link>
      {" · "}
      <Link href="/clinical/radiographs" className="underline hover:text-foreground">
        Radiographs
      </Link>
      {" · "}
      <Link href="/clinical/photos" className="underline hover:text-foreground">
        Clinical photos
      </Link>
    </p>
  );
}
