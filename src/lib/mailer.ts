import nodemailer, { type SendMailOptions } from "nodemailer";
import { env } from "../config/env.js";

const hasMailConfig =
  Boolean(env.mailHost) &&
  Boolean(env.mailPort) &&
  Boolean(env.mailUser) &&
  Boolean(env.mailPass) &&
  Boolean(env.mailFromEmail);

const transporter = hasMailConfig
  ? nodemailer.createTransport({
      host: env.mailHost,
      port: env.mailPort,
      secure: env.mailSecure,
      auth: {
        user: env.mailUser,
        pass: env.mailPass,
      },
    })
  : null;

export function isMailerConfigured() {
  return Boolean(transporter);
}

export async function sendMail(options: SendMailOptions) {
  if (!transporter) {
    throw new Error(
      "Mailer is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, and MAIL_FROM_EMAIL.",
    );
  }

  return transporter.sendMail({
    from: `"${env.mailFromName}" <${env.mailFromEmail}>`,
    ...options,
  });
}
