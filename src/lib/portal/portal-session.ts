import { cookies } from "next/headers";

const PORTAL_PATIENT_COOKIE = "dentaflow_portal_patientId";

export async function getPortalPreferredPatientId(): Promise<string | undefined> {
  const store = await cookies();
  const value = store.get(PORTAL_PATIENT_COOKIE)?.value;
  return value || undefined;
}

export async function setPortalPreferredPatientId(patientId: string) {
  const store = await cookies();
  store.set(PORTAL_PATIENT_COOKIE, patientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearPortalPreferredPatientId() {
  const store = await cookies();
  store.set(PORTAL_PATIENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
}

