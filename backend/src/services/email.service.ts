import "dotenv/config";
import { deliverToTestMailbox } from "./test-mailbox.service.js";

interface VerificationEmail {
  to: string;
  firstName: string;
  code: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const sendVerificationEmail = async ({
  to,
  firstName,
  code,
}: VerificationEmail): Promise<void> => {
  if (await deliverToTestMailbox(to, code)) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email delivery is not configured for production.",
      );
    }

    console.info(
      `[LOCAL DEVELOPMENT ONLY] CloudDrop verification code for ${to}: ${code}`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your CloudDrop email",
      text: [
        `Hello ${firstName},`,
        "",
        `Your CloudDrop verification code is: ${code}`,
        "",
        "This code expires in 10 minutes.",
        "If you did not create a CloudDrop account, you can ignore this email.",
      ].join("\n"),
      html: `
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your CloudDrop verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">
          ${code}
        </p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create a CloudDrop account, you can ignore this email.</p>
      `,
    }),
  });

  if (!response.ok) {
    // Avoid logging API keys or other sensitive request data.
    console.error(
      `Verification email delivery failed with HTTP ${response.status}.`,
    );
    throw new Error("Unable to send verification email.");
  }
};
