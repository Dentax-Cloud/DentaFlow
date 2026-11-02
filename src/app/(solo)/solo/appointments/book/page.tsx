import { redirect } from "next/navigation";

export default function SoloBookRedirect() {
  redirect("/appointments/book");
}
