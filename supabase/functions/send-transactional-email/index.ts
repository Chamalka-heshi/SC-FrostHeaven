// @ts-nocheck
/**
 * SC Frost Heaven — Supabase Edge Function: send-transactional-email
 * Phase 8B Implementation
 *
 * Invoked via Supabase Database Webhook on `public.notifications` INSERT.
 *
 * WORKFLOW & ARCHITECTURE:
 * 1. Untrusted webhook payload received (validated for notification ID & user ID).
 * 2. Server-side re-fetch of notification & custom order from Supabase PostgreSQL.
 * 3. Strict Customer Isolation: Verifies order.customer_id === notification.user_id.
 * 4. Guest order protection: Safely skips if customer_id is NULL.
 * 5. Strict Data Allowlist: Extracts only customer-safe fields. NEVER exposes internal_notes,
 *    payment_reference, payment_notes, staff IDs, or kitchen timestamps.
 * 6. Generates responsive HTML & plain-text templates with SC Frost Heaven branding.
 * 7. Dispatches via Resend API using server-side RESEND_API_KEY (with Idempotency-Key).
 * 8. Non-blocking error resilience: Failures never alter order or payment state.
 */

// Ambient type declarations for VS Code / TypeScript editor compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";

const DEFAULT_SITE_URL = "https://scfrostheaven.com";
const DEFAULT_FROM_EMAIL = "SC Frost Heaven <orders@scfrostheaven.com>";
const BAKERY_PHONE = "+94 76 123 4567";
const BAKERY_EMAIL = "hello@scfrostheaven.com";
const BAKERY_LOCATION = "Sri Lanka";

interface WebhookRecord {
  id?: string;
  user_id?: string;
  type?: string;
  title?: string;
  message?: string;
  related_order_id?: string | null;
  is_read?: boolean;
  created_at?: string;
}

interface WebhookPayload {
  type?: string; // "INSERT", "UPDATE"
  table?: string; // "notifications"
  schema?: string; // "public"
  record?: WebhookRecord;
  old_record?: WebhookRecord | null;
  notification_id?: string; // Fallback for manual trigger
}

interface CustomerSafeOrderData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  eventType?: string | null;
  eventDate?: string | null;
  quotedPriceLkr?: number | null;
  depositAmountLkr?: number | null;
  amountPaidLkr?: number | null;
  paymentStatus?: string | null;
  targetPickupTime?: string | null;
  customerMessage?: string | null;
}

function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function buildAccountUrl(siteUrl: string, orderId: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/account?orderId=${encodeURIComponent(orderId)}`;
}

function buildTestimonialsUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/testimonials`;
}

function formatEmailDate(dateStr?: string | null): string {
  if (!dateStr) return "To be coordinated";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0] || "2026", 10);
      const month = parseInt(parts[1] || "1", 10) - 1;
      const day = parseInt(parts[2] || "1", 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function wrapHtmlLayout(
  headline: string,
  badgeText: string,
  badgeColor: string,
  bodyContentHtml: string,
  ctaButtonText: string,
  ctaButtonUrl: string,
  secondaryLinkHtml: string = "",
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2D2522;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #F0EAE1;">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background-color: #FFFFFF; border-bottom: 1px solid #F6F2EC;">
              <span style="font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #D48B80; display: block; margin-bottom: 6px;">SC FROST HEAVEN</span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #2D2522; line-height: 1.3;">${headline}</h1>
              <div style="margin-top: 12px;">
                <span style="display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 600; border-radius: 50px; background-color: ${badgeColor}; color: #2D2522;">
                  ${badgeText}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px;">
              ${bodyContentHtml}
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px; margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${ctaButtonUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: #FFFFFF; background-color: #D48B80; text-decoration: none; border-radius: 50px; box-shadow: 0 2px 8px rgba(212, 139, 128, 0.35);">
                      ${ctaButtonText}
                    </a>
                  </td>
                </tr>
              </table>
              ${secondaryLinkHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #FCFAF8; border-top: 1px solid #F6F2EC; text-align: center; font-size: 12px; color: #8C827A; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-weight: 500; color: #5C524C;">SC Frost Heaven Handcrafted Bakery</p>
              <p style="margin: 0 0 6px 0;">${BAKERY_LOCATION} • <a href="mailto:${BAKERY_EMAIL}" style="color: #D48B80; text-decoration: none;">${BAKERY_EMAIL}</a> • ${BAKERY_PHONE}</p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #A69C95;">You received this automated notification regarding your custom cake request.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderEmail(
  type: string,
  data: CustomerSafeOrderData,
  siteUrl: string = DEFAULT_SITE_URL,
): { subject: string; html: string; text: string } | null {
  const accountUrl = buildAccountUrl(siteUrl, data.orderId);
  const shortId = data.orderId ? data.orderId.slice(0, 8).toUpperCase() : "ORDER";
  const customerName = data.customerName || "Valued Customer";
  const eventType = data.eventType || "Celebration";
  const eventDateFormatted = formatEmailDate(data.eventDate);
  const customerMessage = data.customerMessage;

  switch (type) {
    case "quote_ready": {
      const subject = "Your SC Frost Heaven cake quotation is ready";
      const quotedPrice = formatLKR(data.quotedPriceLkr);
      const depositAmount =
        data.depositAmountLkr && data.depositAmountLkr > 0
          ? formatLKR(data.depositAmountLkr)
          : "No deposit required";

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Great news! Our bakery team has reviewed your custom cake request (<strong>#${shortId}</strong>) and prepared your official quotation.
        </p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FCFAF8; border: 1px solid #F0EAE1; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Celebration:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Event Date:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventDateFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Total Quoted Price:</td>
                  <td style="padding: 6px 0; font-size: 15px; font-weight: 700; text-align: right; color: #2D2522;">${quotedPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Required Deposit:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #D48B80;">${depositAmount}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF9F7; border-left: 3px solid #D48B80; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Message from Bakery:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          Please open your order in My Account to review the details and confirm your quotation.
        </p>
      `;

      const text = `Hi ${customerName},\n\nYour custom cake quote for #${shortId} (${eventType} on ${eventDateFormatted}) is ready.\n\nTotal Price: ${quotedPrice}\nRequired Deposit: ${depositAmount}\n\n${customerMessage ? `Message: ${customerMessage}\n\n` : ""}Review your quote: ${accountUrl}\n\nSC Frost Heaven\n${BAKERY_PHONE}`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Your Cake Quote Is Ready",
          "Quotation Ready",
          "#FCE8E6",
          htmlBody,
          "Review & Accept Quote",
          accountUrl,
        ),
        text,
      };
    }

    case "order_confirmed": {
      const subject = "Your SC Frost Heaven cake order is confirmed";
      const quotedPrice = formatLKR(data.quotedPriceLkr);
      const depositAmount =
        data.depositAmountLkr && data.depositAmountLkr > 0
          ? formatLKR(data.depositAmountLkr)
          : "No deposit required";

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Thank you for confirming your quotation! Your custom cake order (<strong>#${shortId}</strong>) has been officially confirmed and scheduled with our pastry team.
        </p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FCFAF8; border: 1px solid #F0EAE1; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Celebration:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Event Date:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventDateFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Total Quoted Price:</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 700; text-align: right; color: #2D2522;">${quotedPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Deposit:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${depositAmount}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF9F7; border-left: 3px solid #D48B80; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Bakery Note:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          We will notify you as soon as our pastry chefs begin baking and decorating your creation.
        </p>
      `;

      const text = `Hi ${customerName},\n\nYour order #${shortId} (${eventType} on ${eventDateFormatted}) is confirmed!\nTotal: ${quotedPrice}\nDeposit: ${depositAmount}\n\nView order: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Your Order Is Confirmed",
          "Order Confirmed",
          "#E6F4EA",
          htmlBody,
          "View Order in My Account",
          accountUrl,
        ),
        text,
      };
    }

    case "in_baking": {
      const subject = "Your SC Frost Heaven cake is now being prepared";
      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Exciting news! Our kitchen team has started active preparation and baking for your custom celebration cake (<strong>#${shortId}</strong>).
        </p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF5FF; border: 1px solid #E9D8FD; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6B46C1;">Status:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; text-align: right; color: #6B46C1;">🎂 In Kitchen Baking</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Event Date:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventDateFormatted}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF9F7; border-left: 3px solid #D48B80; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Kitchen Update:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
      `;
      const text = `Hi ${customerName},\n\nBaking has begun for your custom cake #${shortId} (${eventType} for ${eventDateFormatted})!\n\nTrack progress: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Baking Has Begun!",
          "In Production",
          "#F3E8FF",
          htmlBody,
          "Track Order Progress",
          accountUrl,
        ),
        text,
      };
    }

    case "order_ready": {
      const subject = "Your SC Frost Heaven cake is ready";
      const pickupTime = data.targetPickupTime ? data.targetPickupTime.slice(0, 5) : null;
      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Your custom cake (<strong>#${shortId}</strong>) is freshly baked, decorated, packaged, and ready for pickup!
        </p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E6FFFA; border: 1px solid #B2F5EA; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #234E52;">Ready State:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; text-align: right; color: #234E52;">✨ Ready for Pickup</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Event Date:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventDateFormatted}</td>
                </tr>
                ${
                  pickupTime
                    ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Target Time:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; text-align: right; color: #2D2522;">${pickupTime}</td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>
        </table>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF9F7; border-left: 3px solid #D48B80; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Pickup Guidance:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
      `;
      const text = `Hi ${customerName},\n\nYour custom cake #${shortId} is finished and ready for pickup!\nDate: ${eventDateFormatted}\n${pickupTime ? `Time: ${pickupTime}\n` : ""}\nView details: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Your Cake Is Ready!",
          "Ready for Pickup",
          "#E6FFFA",
          htmlBody,
          "View Order Details",
          accountUrl,
        ),
        text,
      };
    }

    case "order_completed": {
      const subject = "Thank you for choosing SC Frost Heaven";
      const testimonialsUrl = buildTestimonialsUrl(siteUrl);
      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Thank you for celebrating your ${eventType} with SC Frost Heaven! We hope your custom cake brought extra joy to your special day.
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Would you take a moment to share your experience with us?
        </p>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF9F7; border-left: 3px solid #D48B80; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          ${customerMessage}
        </div>`
            : ""
        }
      `;
      const text = `Hi ${customerName},\n\nThank you for choosing SC Frost Heaven for your ${eventType}!\n\nLeave a review: ${testimonialsUrl}\nOr view your completed order: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Thank You for Celebrating With Us!",
          "Completed",
          "#E6F4EA",
          htmlBody,
          "Leave a Review",
          testimonialsUrl,
        ),
        text,
      };
    }

    case "order_declined": {
      const subject = "Update regarding your SC Frost Heaven cake request";
      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Thank you for reaching out to SC Frost Heaven. We have reviewed your custom cake request (<strong>#${shortId}</strong>).
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Unfortunately, we are unable to fulfill this request at this time for the requested date (${eventDateFormatted}).
        </p>
        ${
          customerMessage
            ? `
        <div style="background-color: #FFF5F5; border-left: 3px solid #E53E3E; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Bakery Note:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
      `;
      const text = `Hi ${customerName},\n\nThank you for contacting SC Frost Heaven. Unfortunately, we are unable to fulfill custom request #${shortId} for ${eventDateFormatted}.\n\n${customerMessage ? `Note: ${customerMessage}\n\n` : ""}View request: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Custom Order Update",
          "Declined",
          "#FEE2E2",
          htmlBody,
          "View Request Details",
          accountUrl,
        ),
        text,
      };
    }

    case "order_cancelled": {
      const subject = "Your SC Frost Heaven cake order has been cancelled";
      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          This email confirms that your custom cake request (<strong>#${shortId}</strong>) has been cancelled.
        </p>
        ${
          customerMessage
            ? `
        <div style="background-color: #F7FAFC; border-left: 3px solid #718096; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #5C524C; line-height: 1.5;">
          <strong style="color: #2D2522;">Cancellation Notice:</strong><br/>
          ${customerMessage}
        </div>`
            : ""
        }
      `;
      const text = `Hi ${customerName},\n\nYour custom cake request #${shortId} has been cancelled.\n\nView account: ${accountUrl}\n\nSC Frost Heaven`;
      return {
        subject,
        html: wrapHtmlLayout(
          "Order Cancelled",
          "Cancelled",
          "#F3F4F6",
          htmlBody,
          "View Account & Orders",
          accountUrl,
        ),
        text,
      };
    }

    default:
      return null;
  }
}

serve(async (req: Request) => {
  // 1. CORS & HTTP Method Guard
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();

    // Extract notification record from webhook payload or fallback
    const record: WebhookRecord | undefined =
      payload.record || (payload.notification_id ? { id: payload.notification_id } : undefined);

    if (!record || !record.id) {
      console.log(
        "[TRANSACTIONAL_EMAIL] Ignored: Webhook payload contains no notification record.",
      );
      return new Response(JSON.stringify({ status: "ignored_no_record" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error(
        "[TRANSACTIONAL_EMAIL] Configuration Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in Edge Function environment.",
      );
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Re-fetch notification record from trusted database
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, related_order_id, created_at")
      .eq("id", record.id)
      .maybeSingle();

    if (notifError || !notification) {
      console.log(
        `[TRANSACTIONAL_EMAIL] Ignored: Notification ${record.id} not found in database.`,
      );
      return new Response(JSON.stringify({ status: "ignored_not_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If notification has no related order, skip safely
    if (!notification.related_order_id) {
      console.log(
        `[TRANSACTIONAL_EMAIL] Ignored: Notification ${notification.id} has no related custom order.`,
      );
      return new Response(JSON.stringify({ status: "ignored_no_related_order" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Re-fetch custom order and enforce STRICT CUSTOMER ISOLATION
    const { data: order, error: orderError } = await supabase
      .from("custom_orders")
      .select(
        "id, customer_id, customer_name, customer_email, event_type, event_date, quoted_price_lkr, deposit_amount_lkr, amount_paid_lkr, payment_status, target_pickup_time, customer_message",
      )
      .eq("id", notification.related_order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.log(
        `[TRANSACTIONAL_EMAIL] Ignored: Order ${notification.related_order_id} not found.`,
      );
      return new Response(JSON.stringify({ status: "ignored_order_not_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // STRICT CUSTOMER ISOLATION & GUEST ORDER GUARD:
    // Verify that the order's customer_id strictly matches the notification's user_id.
    // If customer_id is null (guest) or does not match, reject email delivery.
    if (!order.customer_id || order.customer_id !== notification.user_id) {
      console.warn(
        `[TRANSACTIONAL_EMAIL] Security Guard: Customer ID mismatch or guest order. Order customer_id=${order.customer_id}, Notification user_id=${notification.user_id}. Email delivery aborted.`,
      );
      return new Response(JSON.stringify({ status: "rejected_customer_mismatch" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Retrieve trusted customer email
    let recipientEmail = (order.customer_email || "").trim();

    if (!recipientEmail || !recipientEmail.includes("@")) {
      // Fallback lookup in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", notification.user_id)
        .maybeSingle();

      if (profile?.email && profile.email.includes("@")) {
        recipientEmail = profile.email.trim();
      }
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      console.warn(
        `[TRANSACTIONAL_EMAIL] Ignored: No valid customer email found for user ${notification.user_id}.`,
      );
      return new Response(JSON.stringify({ status: "ignored_no_valid_email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Construct customer-safe email data using explicit allowlist
    const safeData: CustomerSafeOrderData = {
      orderId: order.id,
      customerName: order.customer_name || "Valued Customer",
      customerEmail: recipientEmail,
      eventType: order.event_type,
      eventDate: order.event_date,
      quotedPriceLkr: order.quoted_price_lkr,
      depositAmountLkr: order.deposit_amount_lkr,
      amountPaidLkr: order.amount_paid_lkr,
      paymentStatus: order.payment_status,
      targetPickupTime: order.target_pickup_time,
      customerMessage: order.customer_message,
    };

    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("VITE_SITE_URL") || DEFAULT_SITE_URL;
    const rendered = renderEmail(notification.type, safeData, siteUrl);

    if (!rendered) {
      console.log(
        `[TRANSACTIONAL_EMAIL] Ignored: Notification type '${notification.type}' does not generate customer emails.`,
      );
      return new Response(JSON.stringify({ status: "ignored_unsupported_notification_type" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Resend API Dispatch
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_FROM_EMAIL;

    if (!resendApiKey) {
      console.warn(
        "[TRANSACTIONAL_EMAIL] Notice: RESEND_API_KEY is not set in environment. Email simulated successfully without external dispatch.",
      );
      return new Response(
        JSON.stringify({
          status: "simulated_no_api_key",
          type: notification.type,
          recipient: recipientEmail,
          subject: rendered.subject,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Dispatch to Resend with Idempotency Key
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${notification.id}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error(`[TRANSACTIONAL_EMAIL] Resend Error (${resendResponse.status}): ${errorText}`);

      // Return 200 so webhook does not loop catastrophically on provider rejections
      return new Response(
        JSON.stringify({
          status: "provider_error",
          code: resendResponse.status,
          error: errorText,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const resendData = await resendResponse.json();
    console.log(
      `[TRANSACTIONAL_EMAIL] Successfully sent '${notification.type}' email to ${recipientEmail} (Resend ID: ${resendData.id})`,
    );

    return new Response(JSON.stringify({ status: "sent", id: resendData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[TRANSACTIONAL_EMAIL] Exception: ${message}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
