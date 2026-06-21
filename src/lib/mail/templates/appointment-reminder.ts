import { emailButton, emailLayout } from "./layout";

export type AppointmentReminderEmailData = {
  patientName: string;
  clinicName: string;
  appointmentDate: Date;
  appointmentTime: string;
  doctorName: string;
  confirmUrl?: string;
};

export function buildAppointmentReminderEmail(data: AppointmentReminderEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const dateStr = data.appointmentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Appointment reminder — ${data.clinicName} on ${dateStr}`;

  const text = [
    `Hi ${data.patientName},`,
    "",
    `This is a reminder for your upcoming appointment at ${data.clinicName}.`,
    "",
    `Date: ${dateStr}`,
    `Time: ${data.appointmentTime}`,
    `Doctor: ${data.doctorName}`,
    data.confirmUrl ? `Confirm: ${data.confirmUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Appointment reminder</p>
    <p style="margin:0 0 16px;">
      Hi ${data.patientName},<br><br>
      This is a reminder for your upcoming appointment at
      <strong style="color:#fafafa;">${data.clinicName}</strong>.
    </p>
    <div style="background:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:0 0 16px;">
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Date:</strong> ${dateStr}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Time:</strong> ${data.appointmentTime}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Doctor:</strong> ${data.doctorName}</p>
    </div>
    ${data.confirmUrl ? emailButton(data.confirmUrl, "Confirm appointment") : ""}
    <p style="margin:0;color:#71717a;font-size:13px;">
      Need to reschedule? Contact ${data.clinicName}.
    </p>
  `);

  return { subject, text, html };
}
