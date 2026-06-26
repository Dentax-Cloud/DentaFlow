export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getBookingRequests } from "./actions";
import BookingRequestsClient from "./booking-requests-client";

export default async function BookingRequestsPage() {
  await requireRouteAccess("appointments", "read");
  const bookings = await getBookingRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Online booking requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and confirm appointments requested via the patient portal
        </p>
      </div>
      <BookingRequestsClient bookings={bookings} />
    </div>
  );
}
