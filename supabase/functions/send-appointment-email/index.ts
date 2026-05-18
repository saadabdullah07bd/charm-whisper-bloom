import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

// MedHelp brand palette — matches the uploaded email template design.
const BRAND = {
  primary: "#4a4a43",        // warm charcoal, used for accent + buttons
  primaryFg: "#ffffff",
  bg: "#f1f1f1",             // page background
  card: "#ffffff",           // card background
  text: "#4a4a43",           // headings
  muted: "#666666",          // body text
  subtle: "#999999",         // footer text
  divider: "#eeeeee",
  panel: "#fafaf8",          // notice / details panel
  iconBg: "#f5f5f3",         // circular icon halo
  // Accent colors (kept subtle to stay on-brand)
  success: "#3f8a5f",
  warning: "#b07a2b",
  danger: "#a8453a",
  info: "#3b6c9c",
};

const FONT = "'Poppins', Arial, sans-serif";

/**
 * Renders the full email shell.
 *  - icon: inline SVG (24x24 viewBox, mono-color stroke) — set stroke="currentColor"
 *  - heading: large dark title
 *  - greeting: short single line under heading (optional)
 *  - body: main paragraph (HTML allowed)
 *  - cta: { text, url } optional primary call-to-action
 *  - footnote: small bordered notice below CTA (optional)
 *  - extras: any additional HTML blocks (details table, action button pair, etc.)
 *  - footerText: small muted footer line above © line
 */
interface LayoutOpts {
  title: string;
  icon?: string;
  heading: string;
  greeting?: string;
  body: string;
  cta?: { text: string; url: string };
  footnote?: string;
  extras?: string;
  footerText?: string;
}

function emailLayout(opts: LayoutOpts): string {
  const {
    title, icon, heading, greeting, body, cta, footnote, extras, footerText,
  } = opts;
  const safeIcon = icon ?? defaultIcons.envelope;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<!-- Brand wordmark -->
<tr><td align="center" style="padding:24px 0;">
<span style="font-family:${FONT};font-weight:500;font-size:28px;color:${BRAND.text};letter-spacing:0.5px;">MedHelp</span>
</td></tr>
<!-- Card -->
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border-radius:8px;box-shadow:0 1px 8px rgba(0,0,0,0.05);overflow:hidden;">
<!-- Accent bar -->
<tr><td style="height:2px;background:${BRAND.primary};line-height:2px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:44px 40px 40px;">
<!-- Circular icon -->
<div style="text-align:center;margin-bottom:24px;">
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td align="center" valign="middle" style="width:64px;height:64px;border-radius:32px;background:${BRAND.iconBg};">
${safeIcon}
</td></tr></table>
</div>
<!-- Heading -->
<h1 style="font-family:${FONT};font-weight:600;font-size:24px;color:${BRAND.text};text-align:center;margin:0 0 8px;line-height:1.3;">${heading}</h1>
${greeting ? `<p style="font-family:${FONT};font-weight:500;font-size:15px;color:${BRAND.text};text-align:center;margin:0 0 20px;">${greeting}</p>` : ""}
<!-- Body -->
<p style="font-family:${FONT};font-weight:400;font-size:14px;color:${BRAND.muted};text-align:center;line-height:1.7;margin:0 0 24px;">${body}</p>
${extras || ""}
${cta ? `<div style="text-align:center;margin:24px 0 8px;">
<a href="${cta.url}" style="display:inline-block;font-family:${FONT};font-weight:600;font-size:15px;color:#ffffff;background:${BRAND.primary};padding:14px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">${cta.text}</a>
</div>` : ""}
${footnote ? `<div style="height:1px;background:${BRAND.divider};margin:24px 0;"></div>
<div style="background:${BRAND.panel};border-radius:8px;padding:12px 16px;text-align:center;">
<p style="font-family:${FONT};font-weight:400;font-size:12px;color:${BRAND.text};margin:0;line-height:1.6;">${footnote}</p>
</div>` : ""}
</td></tr>
</table>
</td></tr>
<!-- Footer -->
<tr><td align="center" style="padding:28px 20px;">
<p style="font-family:${FONT};font-weight:400;font-size:12px;color:${BRAND.subtle};line-height:1.6;margin:0;">${footerText || "If you didn't expect this email, you can safely ignore it."}</p>
<p style="font-family:${FONT};font-weight:400;font-size:11px;color:#bbbbbb;margin:16px 0 0;">© ${new Date().getFullYear()} MedHelp. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Inline SVGs (24x24) — use currentColor so we can theme via stroke attr.
const defaultIcons = {
  envelope: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  calendarCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
  calendarClock: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="16" cy="16" r="3"/><path d="M16 14.5v1.5l1 1"/></svg>`,
  calendarX: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.danger}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m14 14-4 4M10 14l4 4"/></svg>`,
  bellRing: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.info}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.info}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h6"/></svg>`,
  pill: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${BRAND.success}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
};

// HTML-escape user-controlled strings before interpolation into email markup.
function esc(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Status badge — small rounded pill, used inside the card body.
function badge(text: string, color: string): string {
  return `<div style="text-align:center;margin:0 0 16px;">
<span style="display:inline-block;padding:5px 14px;border-radius:20px;background:${color}15;color:${color};font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.3px;">${text}</span>
</div>`;
}

function detailsTable(date: string, time: string, patientName: string, extraRows = ""): string {
  const row = (label: string, value: string) =>
    `<tr>
<td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};border-bottom:1px solid ${BRAND.divider};width:110px;text-align:left;">${label}</td>
<td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};border-bottom:1px solid ${BRAND.divider};text-align:left;">${value}</td>
</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border-radius:8px;margin:0 0 8px;">
${row("Patient", patientName)}
${row("Date", date)}
${time ? row("Time", time) : ""}
${row("Doctor", "Dr. Muhammad Abdul Bari")}
${extraRows}
</table>`;
}

// Secondary outlined link button (used for Meet / Calendar links inside cards).
function actionButton(text: string, url: string, color = BRAND.primary): string {
  return `<div style="text-align:center;margin:16px 0;">
<a href="${url}" style="display:inline-block;font-family:${FONT};font-weight:600;font-size:13px;color:${color};background:#ffffff;border:1.5px solid ${color};padding:11px 24px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">${text}</a>
</div>`;
}

interface EmailPayload {
  type: "booking_received" | "appointment_approved" | "appointment_cancelled_by_doctor" |
        "reschedule_requested" | "reschedule_approved" | "reschedule_rejected" |
        "appointment_cancelled_by_patient" | "doctor_notification" | "new_appointment_request" |
        "meeting_reminder" |
        "report_uploaded" | "reschedule_holding" | "prescription_ready";
  to: string;
  patientName: string;
  date: string;
  time: string;
  reason?: string;
  meetLink?: string;
  newDate?: string;
  newTime?: string;
  appointmentId?: string;
  reportName?: string;
  diagnosis?: string;
  medicines?: string;
}

function buildCalendarLink(date: string, time: string, patientName: string, meetLink?: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateOnly = date.replace(/-/g, "");
  const startTime = `${dateOnly}T${pad(hours)}${pad(minutes)}00`;
  let endH = hours, endM = minutes + 30;
  if (endM >= 60) { endH++; endM -= 60; }
  const endTime = `${dateOnly}T${pad(endH)}${pad(endM)}00`;
  const title = encodeURIComponent("Appointment with Dr. Muhammad Abdul Bari");
  let details = encodeURIComponent(`Patient: ${patientName}\nDoctor: Dr. Muhammad Abdul Bari\nMBBS, MD, FACP (USA)`);
  if (meetLink) {
    details = encodeURIComponent(`Patient: ${patientName}\nDoctor: Dr. Muhammad Abdul Bari\nMBBS, MD, FACP (USA)\n\nVideo Call: ${meetLink}`);
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&ctz=Asia/Dhaka`;
}

async function buildEmail(payload: EmailPayload): Promise<{ subject: string; html: string }> {
  const { type, date, time, meetLink, newDate, newTime } = payload;
  // Escape every user-controlled string before HTML interpolation.
  const patientName = esc(payload.patientName);
  const reason = esc(payload.reason);
  const reportName = esc(payload.reportName);
  const diagnosis = esc(payload.diagnosis);
  const medicines = esc(payload.medicines);
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const formattedNewDate = newDate ? new Date(newDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

  switch (type) {
    case "booking_received":
      return {
        subject: "Appointment Request Received – MedHelp",
        html: emailLayout({
          title: "Booking Received",
          icon: defaultIcons.calendarClock,
          heading: "Booking Received",
          greeting: `Dear ${patientName},`,
          body: "Your appointment request has been received. The doctor will review and confirm it shortly.",
          extras: badge("Pending Review", BRAND.warning) + detailsTable(formattedDate, time, patientName),
          footnote: "You'll receive another email as soon as your appointment is confirmed.",
        }),
      };

    case "appointment_approved": {
      const calLink = buildCalendarLink(date, time, payload.patientName, meetLink);
      const meetRow = meetLink ? `<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};width:110px;">Video Call</td><td style="padding:10px 14px;font-size:13px;font-family:${FONT};"><a href="${meetLink}" style="color:${BRAND.info};text-decoration:underline;word-break:break-all;">${meetLink}</a></td></tr>` : "";
      return {
        subject: "Appointment Confirmed – MedHelp",
        html: emailLayout({
          title: "Appointment Confirmed",
          icon: defaultIcons.calendarCheck,
          heading: "Appointment Confirmed",
          greeting: `Dear ${patientName},`,
          body: "Your appointment has been successfully confirmed. We're looking forward to seeing you.",
          extras: badge("Confirmed", BRAND.success)
            + detailsTable(formattedDate, time, patientName, meetRow)
            + (meetLink ? actionButton("Join Video Call", meetLink, BRAND.info) : "")
            + (calLink ? actionButton("Add to Google Calendar", calLink) : ""),
          footnote: meetLink
            ? "If you need to reschedule or cancel, please do so at least 2 hours before the appointment."
            : "Your Video Call link will appear in your dashboard and be emailed 10 minutes before the appointment.",
        }),
      };
    }

    case "meeting_reminder": {
      const calLink = buildCalendarLink(date, time, payload.patientName, meetLink);
      const meetRow = meetLink ? `<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};width:110px;">Video Call</td><td style="padding:10px 14px;font-size:13px;font-family:${FONT};"><a href="${meetLink}" style="color:${BRAND.info};text-decoration:underline;word-break:break-all;">${meetLink}</a></td></tr>` : "";
      return {
        subject: "Your Appointment Starts Soon – MedHelp",
        html: emailLayout({
          title: "Meeting Reminder",
          icon: defaultIcons.bellRing,
          heading: "Your Appointment Starts Soon",
          greeting: `Dear ${patientName},`,
          body: "Here is your Video Call link for the upcoming consultation. Please join a couple of minutes early.",
          extras: badge("Starting Soon", BRAND.info)
            + detailsTable(formattedDate, time, patientName, meetRow)
            + (meetLink ? `<div style="text-align:center;margin:16px 0 4px;"><a href="${meetLink}" style="display:inline-block;font-family:${FONT};font-weight:600;font-size:15px;color:#ffffff;background:${BRAND.primary};padding:14px 40px;border-radius:8px;text-decoration:none;">Join Video Call</a></div>` : "")
            + (calLink ? actionButton("Open in Calendar", calLink) : ""),
          footnote: "This link expires after the appointment ends.",
        }),
      };
    }

    case "appointment_cancelled_by_doctor":
      return {
        subject: "Appointment Cancelled – MedHelp",
        html: emailLayout({
          title: "Appointment Cancelled",
          icon: defaultIcons.calendarX,
          heading: "Appointment Cancelled",
          greeting: `Dear ${patientName},`,
          body: "Unfortunately, your appointment has been cancelled by the doctor.",
          extras: badge("Cancelled", BRAND.danger)
            + detailsTable(formattedDate, time, patientName)
            + (reason ? `<div style="background:${BRAND.panel};border-left:3px solid ${BRAND.danger};border-radius:6px;padding:12px 16px;margin:16px 0 0;"><p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.text};"><strong>Reason:</strong> ${reason}</p></div>` : ""),
          footnote: "Please book a new appointment at your convenience from the patient portal.",
        }),
      };

    case "reschedule_requested":
      return {
        subject: `Reschedule Request – ${patientName}`,
        html: emailLayout({
          title: "Reschedule Request",
          icon: defaultIcons.calendarClock,
          heading: "Reschedule Request",
          body: `Patient <strong>${patientName}</strong> has requested to reschedule their appointment.`,
          extras: badge("Reschedule Requested", BRAND.warning)
            + `<p style="font-family:${FONT};font-size:12px;color:${BRAND.muted};margin:0 0 6px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Current Appointment</p>`
            + detailsTable(formattedDate, time, patientName)
            + (newDate ? `<p style="font-family:${FONT};font-size:12px;color:${BRAND.muted};margin:16px 0 6px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Requested New Time</p>${detailsTable(formattedNewDate, newTime || "", patientName)}` : ""),
          footnote: "Review and approve or decline this request from your dashboard.",
        }),
      };

    case "reschedule_approved":
      return {
        subject: "Reschedule Approved – MedHelp",
        html: emailLayout({
          title: "Reschedule Approved",
          icon: defaultIcons.calendarCheck,
          heading: "Reschedule Approved",
          greeting: `Dear ${patientName},`,
          body: "Your reschedule request has been approved. Here are your new appointment details.",
          extras: badge("Confirmed", BRAND.success)
            + detailsTable(formattedNewDate || formattedDate, newTime || time, patientName),
          footnote: "Need further changes? Please update at least 2 hours before the appointment.",
        }),
      };

    case "appointment_cancelled_by_patient":
      return {
        subject: "Appointment Cancelled – MedHelp",
        html: emailLayout({
          title: "Appointment Cancelled",
          icon: defaultIcons.calendarX,
          heading: "Appointment Cancelled",
          greeting: `Dear ${patientName},`,
          body: "Your appointment has been successfully cancelled as per your request.",
          extras: badge("Cancelled", BRAND.danger) + detailsTable(formattedDate, time, patientName),
          footnote: "You can book a new appointment anytime through the patient portal.",
        }),
      };

    case "doctor_notification":
      return {
        subject: `Patient Cancellation – ${patientName}`,
        html: emailLayout({
          title: "Patient Cancellation",
          icon: defaultIcons.calendarX,
          heading: "Patient Cancelled",
          body: `Patient <strong>${patientName}</strong> has cancelled their appointment.`,
          extras: badge("Cancelled by Patient", BRAND.danger)
            + detailsTable(formattedDate, time, patientName)
            + (reason ? `<div style="background:${BRAND.panel};border-left:3px solid ${BRAND.danger};border-radius:6px;padding:12px 16px;margin:16px 0 0;"><p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.text};"><strong>Patient's reason:</strong> ${reason}</p></div>` : ""),
          footnote: "The time slot is now available for other patients.",
        }),
      };

    case "reschedule_rejected":
      return {
        subject: "Reschedule Request Not Approved – MedHelp",
        html: emailLayout({
          title: "Reschedule Declined",
          icon: defaultIcons.calendarClock,
          heading: "Reschedule Not Approved",
          greeting: `Dear ${patientName},`,
          body: "Unfortunately, your reschedule request was not approved. Your original appointment remains active.",
          extras: badge("Original Appointment Active", BRAND.info) + detailsTable(formattedDate, time, patientName),
          footnote: "Please attend at the originally scheduled time. Contact us if you have any questions.",
        }),
      };

    case "new_appointment_request": {
      return {
        subject: `New Appointment Request – ${patientName}`,
        html: emailLayout({
          title: "New Appointment Request",
          icon: defaultIcons.calendarClock,
          heading: "New Booking Request",
          body: `Patient <strong>${patientName}</strong> has requested a new appointment.`,
          extras: badge("Pending Review", BRAND.warning) + detailsTable(formattedDate, time, patientName),
          footnote: "Please review and approve or decline this request from your dashboard.",
        }),
      };
    }

    case "report_uploaded":
      return {
        subject: `New Report Uploaded – ${patientName}`,
        html: emailLayout({
          title: "Report Uploaded",
          icon: defaultIcons.fileText,
          heading: "New Report Uploaded",
          body: `Patient <strong>${patientName}</strong> has uploaded a new report${reportName ? `: <strong>${reportName}</strong>` : ""}.`,
          extras: badge("New Report", BRAND.info)
            + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border-radius:8px;margin:0 0 8px;">
<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};border-bottom:1px solid ${BRAND.divider};width:110px;text-align:left;">Patient</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};border-bottom:1px solid ${BRAND.divider};text-align:left;">${patientName}</td></tr>
${reportName ? `<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};width:110px;text-align:left;">File</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};text-align:left;">${reportName}</td></tr>` : ""}
</table>`,
          footnote: "View the report from the patient's profile in your dashboard.",
        }),
      };

    case "reschedule_holding":
      return {
        subject: "Reschedule Request Submitted – MedHelp",
        html: emailLayout({
          title: "Reschedule Pending",
          icon: defaultIcons.calendarClock,
          heading: "Reschedule Request Pending",
          greeting: `Dear ${patientName},`,
          body: "Your reschedule request has been submitted and is awaiting the doctor's review.",
          extras: badge("On Hold", BRAND.warning)
            + `<p style="font-family:${FONT};font-size:12px;color:${BRAND.muted};margin:0 0 6px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Requested New Schedule</p>`
            + detailsTable(formattedNewDate || formattedDate, newTime || time, patientName),
          footnote: "You'll be notified once the doctor approves or declines your request.",
        }),
      };

    case "prescription_ready":
      return {
        subject: "Your Prescription – MedHelp",
        html: emailLayout({
          title: "Prescription Ready",
          icon: defaultIcons.pill,
          heading: "Your Prescription is Ready",
          greeting: `Dear ${patientName},`,
          body: "Dr. Muhammad Abdul Bari has issued a prescription for you.",
          extras: badge("Prescription Issued", BRAND.success)
            + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border-radius:8px;margin:0 0 8px;">
<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};border-bottom:1px solid ${BRAND.divider};width:110px;text-align:left;">Patient</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};border-bottom:1px solid ${BRAND.divider};text-align:left;">${patientName}</td></tr>
${diagnosis ? `<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};border-bottom:1px solid ${BRAND.divider};width:110px;text-align:left;">Diagnosis</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};border-bottom:1px solid ${BRAND.divider};text-align:left;">${diagnosis}</td></tr>` : ""}
${medicines ? `<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};border-bottom:1px solid ${BRAND.divider};width:110px;text-align:left;">Medicines</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};border-bottom:1px solid ${BRAND.divider};text-align:left;">${medicines}</td></tr>` : ""}
<tr><td style="padding:10px 14px;color:${BRAND.muted};font-size:12px;font-family:${FONT};width:110px;text-align:left;">Date</td><td style="padding:10px 14px;font-size:13px;font-weight:500;color:${BRAND.text};font-family:${FONT};text-align:left;">${formattedDate}</td></tr>
</table>`,
          footnote: "View your full prescription from the Patient Portal.",
        }),
      };

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authentication & authorization context
  // - Service role: full trust (internal edge-function-to-edge-function calls)
  // - Doctor user: full trust (can email any recipient)
  // - Other authenticated user (patient): only allowed to send to themselves
  //   or to the configured doctor email
  let callerKind: "service" | "doctor" | "user" | "none" = "none";
  let callerEmail = "";
  let doctorEmail = "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (SERVICE_ROLE && token === SERVICE_ROLE) {
      callerKind = "service";
    } else if (SUPABASE_URL && ANON_KEY) {
      // Validate as user JWT
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      });
      if (!userResp.ok) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userJson = await userResp.json();
      callerEmail = (userJson?.email ?? "").toLowerCase();
      const userId: string | undefined = userJson?.id;

      // Check if caller has the doctor role
      if (userId) {
        const roleResp = await fetch(
          `${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${userId}&role=eq.doctor`,
          { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } },
        );
        if (roleResp.ok) {
          const rows = await roleResp.json();
          callerKind = Array.isArray(rows) && rows.length > 0 ? "doctor" : "user";
        } else {
          callerKind = "user";
        }
      } else {
        callerKind = "user";
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const payload: EmailPayload = await req.json();

    if (!payload.to || !payload.type || !payload.patientName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Restrict `to` for non-doctor/non-service callers (patients) to prevent
    // arbitrary-recipient phishing via the doctor's verified email domain.
    if (callerKind === "user") {
      // Look up doctor email server-side using service role
      if (SUPABASE_URL && SERVICE_ROLE) {
        const dResp = await fetch(
          `${SUPABASE_URL}/rest/v1/doctor_settings?select=email&limit=1`,
          { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
        );
        if (dResp.ok) {
          const drows = await dResp.json();
          doctorEmail = (Array.isArray(drows) && drows[0]?.email ? drows[0].email : "").toLowerCase();
        }
      }
      const target = (payload.to ?? "").toLowerCase();
      const allowed = target === callerEmail || (doctorEmail && target === doctorEmail);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Recipient not allowed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Default date/time for types that don't require them
    payload.date = payload.date || new Date().toISOString().split("T")[0];
    payload.time = payload.time || "";

    const { subject, html } = await buildEmail(payload);

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {

        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Dr. M Abdul Bari <noreply@drmabari.com>",
        to: [payload.to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Email send failed", details: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
