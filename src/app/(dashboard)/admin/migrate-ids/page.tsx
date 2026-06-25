import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function MigrateIdsPage() {
  redirect("/admin/id-migration");
}
