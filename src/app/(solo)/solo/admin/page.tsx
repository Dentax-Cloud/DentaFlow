import { redirect } from "next/navigation";

export default function SoloAdminRedirect() {
  redirect("/admin");
}
