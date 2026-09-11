/**
 * SC Frost Heaven — Transactional Email Templates & Renderer
 * Phase 8B Implementation
 *
 * Provides pure, zero-dependency, Deno/Browser/Node/Bun-compatible HTML and plain-text
 * email templates for the 7 canonical order milestone notification events:
 * 1. quote_ready
 * 2. order_confirmed
 * 3. in_baking
 * 4. order_ready
 * 5. order_completed
 * 6. order_declined
 * 7. order_cancelled
 *
 * STRICT DATA SECURITY & CUSTOMER ISOLATION:
 * - Employs an explicit allowlist of customer-safe fields.
 * - NEVER includes internal_notes, payment_reference, payment_notes, staff IDs,
 *   kitchen scheduling timestamps, priority, or complexity units.
 */

export type TransactionalEmailType =
  | "quote_ready"
  | "order_confirmed"
  | "in_baking"
  | "order_ready"
  | "order_completed"
  | "order_declined"
  | "order_cancelled";

export interface CustomerSafeOrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  eventType?: string | null | undefined;
  eventDate?: string | null | undefined;
  quotedPriceLkr?: number | null | undefined;
  depositAmountLkr?: number | null | undefined;
  amountPaidLkr?: number | null | undefined;
  paymentStatus?: string | null | undefined;
  targetPickupTime?: string | null | undefined;
  customerMessage?: string | null | undefined;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailRenderOptions {
  siteUrl?: string | undefined;
}

export const DEFAULT_SITE_URL = "https://scfrostheaven.com";
export const BAKERY_PHONE = "+94 76 123 4567";
export const BAKERY_EMAIL = "hello@scfrostheaven.com";
export const BAKERY_LOCATION = "Sri Lanka";

/**
 * Formats numbers as LKR currency strings (e.g. LKR 15,000).
 */
export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

/**
 * Builds the trusted absolute URL for an order in My Account.
 */
export function buildAccountUrl(siteUrl: string = DEFAULT_SITE_URL, orderId: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/account?orderId=${encodeURIComponent(orderId)}`;
}

/**
 * Builds the trusted absolute URL for the testimonials page.
 */
export function buildTestimonialsUrl(siteUrl: string = DEFAULT_SITE_URL): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/testimonials`;
}

/**
 * Formats human-readable dates for email presentation.
 */
export function formatEmailDate(dateStr?: string | null | undefined): string {
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

/**
 * Wraps content in the responsive SC Frost Heaven branded email layout.
 */
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
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2D2522;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #F0EAE1;">
          
          <!-- Header Branding Banner -->
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

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              ${bodyContentHtml}

              <!-- Primary CTA Button -->
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

          <!-- Footer Information -->
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

/**
 * Main Template Resolver:
 * Takes notification type and customer-safe order data, and produces { subject, html, text }.
 * Returns null if the type is unhandled (e.g. submitted / under_review).
 */
export function renderEmailTemplate(
  type: string,
  data: CustomerSafeOrderEmailData,
  options: EmailRenderOptions = {},
): RenderedEmail | null {
  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const accountUrl = buildAccountUrl(siteUrl, data.orderId);
  const shortId = data.orderId ? data.orderId.slice(0, 8).toUpperCase() : "ORDER";
  const customerName = data.customerName || "Valued Customer";
  const eventType = data.eventType || "Celebration";
  const eventDateFormatted = formatEmailDate(data.eventDate);
  const customerMessage = data.customerMessage;

  switch (type) {
    // 1. Quote Ready
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

        <!-- Financial Summary Box -->
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
          Please open your order in My Account to review the details and confirm your quotation so we can lock in your date on our kitchen schedule.
        </p>
      `;

      const text = `Hi ${customerName},

Great news! Your custom cake quote for #${shortId} (${eventType} on ${eventDateFormatted}) is ready to review.

Total Quoted Price: ${quotedPrice}
Required Deposit: ${depositAmount}

${customerMessage ? `Bakery Message: ${customerMessage}\n\n` : ""}
Review and accept your quote here:
${accountUrl}

Thank you,
SC Frost Heaven
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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

    // 2. Order Confirmed (Accepted)
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

        <!-- Order Summary Box -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FCFAF8; border: 1px solid #F0EAE1; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Celebration:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Scheduled Event Date:</td>
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

      const text = `Hi ${customerName},

Your custom cake order #${shortId} (${eventType} on ${eventDateFormatted}) has been confirmed!

Total Quoted Price: ${quotedPrice}
Deposit: ${depositAmount}

${customerMessage ? `Bakery Note: ${customerMessage}\n\n` : ""}
View your confirmed order anytime:
${accountUrl}

Thank you for choosing SC Frost Heaven!
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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

    // 3. In Baking
    case "in_baking": {
      const subject = "Your SC Frost Heaven cake is now being prepared";

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Exciting news! Our kitchen team has started active preparation and baking for your custom celebration cake (<strong>#${shortId}</strong>).
        </p>

        <!-- Progress Box -->
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
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Celebration:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventType}</td>
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

        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          We will send you another update as soon as your cake is finished, decorated, and packaged for pickup or delivery.
        </p>
      `;

      const text = `Hi ${customerName},

Your custom cake #${shortId} (${eventType} for ${eventDateFormatted}) is now in the kitchen being baked and prepared!

${customerMessage ? `Kitchen Update: ${customerMessage}\n\n` : ""}
Track live progress:
${accountUrl}

SC Frost Heaven Pastry Team
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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

    // 4. Order Ready
    case "order_ready": {
      const subject = "Your SC Frost Heaven cake is ready";
      const pickupTime = data.targetPickupTime ? data.targetPickupTime.slice(0, 5) : null;

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Your custom cake (<strong>#${shortId}</strong>) is freshly baked, beautifully decorated, packaged, and ready for pickup!
        </p>

        <!-- Ready Box -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E6FFFA; border: 1px solid #B2F5EA; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #234E52;">Ready State:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; text-align: right; color: #234E52;">✨ Ready for Pickup</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #8C827A;">Celebration:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; text-align: right; color: #2D2522;">${eventType}</td>
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

        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          Please remember to transport the cake on a flat, level surface in an air-conditioned vehicle.
        </p>
      `;

      const text = `Hi ${customerName},

Your custom cake #${shortId} (${eventType}) is finished and ready for pickup!
Event Date: ${eventDateFormatted}
${pickupTime ? `Target Time: ${pickupTime}\n` : ""}
${customerMessage ? `Pickup Guidance: ${customerMessage}\n\n` : ""}
View your order details:
${accountUrl}

SC Frost Heaven
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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

    // 5. Order Completed
    case "order_completed": {
      const subject = "Thank you for choosing SC Frost Heaven";
      const testimonialsUrl = buildTestimonialsUrl(siteUrl);

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Thank you for celebrating your ${eventType} with SC Frost Heaven! We hope your custom cake added extra sweetness and joy to your special day.
        </p>

        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Would you take a moment to share your experience with us? Your feedback helps our boutique bakery grow and helps other cake lovers in Sri Lanka find their dream cakes.
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

      const secondaryLink = `
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
          <tr>
            <td align="center">
              <a href="${accountUrl}" style="font-size: 12px; color: #8C827A; text-decoration: underline;">
                View completed order in My Account
              </a>
            </td>
          </tr>
        </table>
      `;

      const text = `Hi ${customerName},

Thank you for choosing SC Frost Heaven for your ${eventType}! We hope you and your guests loved your custom cake.

We'd love to hear your feedback. Please leave us a review here:
${testimonialsUrl}

Or view your completed order summary:
${accountUrl}

With love,
SC Frost Heaven Team
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

      return {
        subject,
        html: wrapHtmlLayout(
          "Thank You for Celebrating With Us!",
          "Completed",
          "#E6F4EA",
          htmlBody,
          "Leave a Review",
          testimonialsUrl,
          secondaryLink,
        ),
        text,
      };
    }

    // 6. Order Declined
    case "order_declined": {
      const subject = "Update regarding your SC Frost Heaven cake request";

      const htmlBody = `
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Thank you for reaching out to SC Frost Heaven. We have reviewed your custom cake request (<strong>#${shortId}</strong>).
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #5C524C;">
          Unfortunately, we are unable to fulfill this request at this time due to kitchen schedule capacity or technical constraints for the requested date (${eventDateFormatted}).
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

        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          We sincerely apologize for any inconvenience and hope to have the opportunity to bake for you for a future celebration.
        </p>
      `;

      const text = `Hi ${customerName},

Thank you for contacting SC Frost Heaven. We have reviewed your request #${shortId} for ${eventDateFormatted}.

Unfortunately, we are unable to fulfill this request at this time.

${customerMessage ? `Bakery Note: ${customerMessage}\n\n` : ""}
View your request update:
${accountUrl}

Sincerely,
SC Frost Heaven
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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

    // 7. Order Cancelled
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

        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #8C827A;">
          If you did not request this cancellation or would like to submit a new inquiry, please feel free to reach out to our team.
        </p>
      `;

      const text = `Hi ${customerName},

Your custom cake request #${shortId} has been cancelled.

${customerMessage ? `Cancellation Notice: ${customerMessage}\n\n` : ""}
View order history:
${accountUrl}

SC Frost Heaven
${BAKERY_PHONE} | ${BAKERY_EMAIL}`;

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
