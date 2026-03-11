import db from "../db.js";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";

/**
 * Interpolate {{variable}} placeholders in a message template.
 */
export const interpolate = (template: string, vars: Record<string, string | number | undefined>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));

/**
 * Create a reusable Nodemailer transporter when SMTP env vars are configured.
 */
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587"),
    secure: (SMTP_PORT || "587") === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
};

/**
 * Log a message to the DB and send via email when SMTP is configured.
 */
export const dispatchMessage = (opts: {
  customerId?: string | null;
  appointmentId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  channel: "email" | "sms";
  templateName: string;
  subject?: string | null;
  body: string;
}) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const mailer = getTransporter();
  const status = mailer && opts.channel === "email" && opts.recipientEmail ? "sent" : "simulated";

  db.prepare(
    `
        INSERT INTO messages
            (id, customerId, appointmentId, recipientEmail, recipientPhone,
             channel, templateName, subject, body, status, sentAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    opts.customerId ?? null,
    opts.appointmentId ?? null,
    opts.recipientEmail ?? null,
    opts.recipientPhone ?? null,
    opts.channel,
    opts.templateName,
    opts.subject ?? null,
    opts.body,
    status,
    now,
    now,
  );

  // Actually send email when SMTP is configured
  if (mailer && opts.channel === "email" && opts.recipientEmail) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
    mailer
      .sendMail({
        from,
        to: opts.recipientEmail,
        subject: opts.subject || "(no subject)",
        text: opts.body,
      })
      .catch((err: any) => {
        logger.error("Failed to send email", { messageId: id, error: err.message });
        db.prepare("UPDATE messages SET status = ? WHERE id = ?").run("failed", id);
      });
  }

  return { id, status };
};

/**
 * Server-side message templates for automatic notifications.
 */
export const SERVER_TEMPLATES: Record<string, { channel: "email" | "sms"; subject: string; body: string }> = {
  booking_confirmed: {
    channel: "email",
    subject: "Your appointment at Smarter Dog Grooming Salon is confirmed!",
    body: "Hi {{customerName}},\n\nYour appointment for {{petName}} ({{service}}) has been confirmed.\n\n📅 {{date}}\n⏰ {{time}}\n💰 £{{price}}\n\nPlease arrive 5 minutes early.\n\nSee you soon!\nSmarter Dog Grooming Salon",
  },
  booking_pending: {
    channel: "email",
    subject: "We've received your booking request",
    body: "Hi {{customerName}},\n\nThank you for your booking request for {{petName}} ({{service}}) on {{date}} at {{time}}.\n\nWe're reviewing it and will confirm shortly.\n\nSmarter Dog Grooming Salon",
  },
  ready_for_collection: {
    channel: "sms",
    subject: "{{petName}} is ready for collection! 🐾",
    body: "Hi {{customerName}}, {{petName}} is all done and looking fabulous! You can collect them now. – Smarter Dog Grooming Salon",
  },
  booking_cancelled: {
    channel: "email",
    subject: "Appointment cancelled",
    body: "Hi {{customerName}},\n\nYour appointment for {{petName}} on {{date}} has been cancelled.\n\nIf you would like to rebook, visit our booking page.\n\nSmarter Dog Grooming Salon",
  },
};

/**
 * Format a date string using explicit UTC offset to avoid server-locale drift.
 */
const formatDate = (isoDate: string) => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  const tz = process.env.TZ || "Europe/London";
  try {
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  } catch {
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }
};

const formatTime = (isoDate: string) => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  const tz = process.env.TZ || "Europe/London";
  try {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
};

/**
 * Fire an automatic notification based on appointment event.
 * Looks up customer contact info from DB if customerId is present on the appointment.
 */
export const autoNotify = (triggerKey: keyof typeof SERVER_TEMPLATES, appointment: any) => {
  const tpl = SERVER_TEMPLATES[triggerKey];
  if (!tpl) return;

  // Self-lookup customer contact info from DB
  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  let customerName = appointment.ownerName || "Valued Customer";

  if (appointment.customerId) {
    const cust = db.prepare("SELECT name, email, phone FROM customers WHERE id = ?").get(appointment.customerId) as any;
    if (cust) {
      customerEmail = cust.email || null;
      customerPhone = cust.phone || null;
      customerName = cust.name || customerName;
    }
  }

  const vars = {
    customerName,
    petName: appointment.petName || "your pet",
    service: appointment.service || "",
    date: formatDate(appointment.date),
    time: formatTime(appointment.date),
    price: appointment.price ?? "",
  };

  dispatchMessage({
    customerId: appointment.customerId ?? null,
    appointmentId: appointment.id ?? null,
    recipientEmail: customerEmail,
    recipientPhone: customerPhone,
    channel: tpl.channel,
    templateName: triggerKey as string,
    subject: interpolate(tpl.subject, vars),
    body: interpolate(tpl.body, vars),
  });
};
