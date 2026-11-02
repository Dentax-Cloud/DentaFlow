import { redirect } from "next/navigation";

export default function SoloAppointmentsRedirect() {
  redirect("/appointments");
}
