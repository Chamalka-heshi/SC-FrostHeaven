import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Download, CheckCircle2, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReceiptItem {
  title: string;
  quantity: number;
  price: number;
}

export interface ReceiptOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null | undefined;
  customer_address?: string | null | undefined;
  event_type: string;
  event_date?: string | null | undefined;
  cake_details?: string | null | undefined;
  items?: ReceiptItem[] | undefined;
  fulfillment_method?: string | null | undefined;
  delivery_fee_lkr?: number | null | undefined;
  status: string;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | null | undefined;
  payment_status?: string | null | undefined;
  payment_method?: string | null | undefined;
  payment_reference?: string | null | undefined;
  target_pickup_time?: string | null | undefined;
  deposit_paid_at?: string | null | undefined;
  fully_paid_at?: string | null | undefined;
  created_at?: string | undefined;
}

interface OrderReceiptModalProps {
  order: ReceiptOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Immediate Bakery Order";
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
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/**
 * Generates an isolated, print-perfect, 1-page HTML document for printing and PDF saving.
 * This guarantees zero blank background pages and crisp rendering across all browsers.
 */
function generatePrintableInvoiceHtml(order: ReceiptOrder): string {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const quotedPrice = order.quoted_price_lkr || 0;
  const amountPaid = order.amount_paid_lkr || 0;
  const remainingBalance = Math.max(0, quotedPrice - amountPaid);
  const isFullyPaid = remainingBalance === 0 && amountPaid > 0;
  const isDepositPaid = order.payment_status === "deposit_paid" || (amountPaid > 0 && !isFullyPaid);
  const paymentReferences = order.payment_reference
    ? order.payment_reference.split(",").map((ref) => ref.trim()).filter(Boolean)
    : [];
  const printDate = formatDate(new Date().toISOString().split("T")[0]);

  const itemsHtml = order.items && order.items.length > 0
    ? `
      <table style="width:100%; border-collapse:collapse; margin-top:14px; font-size:13px;">
        <thead>
          <tr style="background:#f9f9fb; border-bottom:2px solid #e5e7eb; text-transform:uppercase; font-size:11px; color:#6b7280;">
            <th style="padding:8px 12px; text-align:left;">Item</th>
            <th style="padding:8px 12px; text-align:center;">Qty</th>
            <th style="padding:8px 12px; text-align:right;">Price (LKR)</th>
            <th style="padding:8px 12px; text-align:right;">Total (LKR)</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((it) => `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px 12px; font-weight:600; color:#111827;">${it.title}</td>
              <td style="padding:8px 12px; text-align:center; color:#4b5563;">${it.quantity}</td>
              <td style="padding:8px 12px; text-align:right; color:#4b5563;">${formatLKR(it.price)}</td>
              <td style="padding:8px 12px; text-align:right; font-weight:600; color:#111827;">${formatLKR(it.price * it.quantity)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : order.cake_details
    ? `
      <div style="margin-top:14px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; font-size:13px;">
        <div style="font-weight:700; color:#111827; margin-bottom:4px;">Custom Handcrafted Cake — ${order.event_type}</div>
        <div style="color:#4b5563; line-height:1.5;">${order.cake_details}</div>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice INV-${shortId} — SC Frost Heaven Bakery</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.45;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-paid {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-deposit {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .details-grid {
      display: table;
      width: 100%;
      margin-bottom: 16px;
    }
    .details-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      background: #f9fafb;
      padding: 12px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .details-col:first-child {
      border-right: 6px solid #ffffff;
    }
    .details-col:last-child {
      border-left: 6px solid #ffffff;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.75px;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 13px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .ledger-table th {
      background: #f9fafb;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
    .ledger-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f3f4f6;
    }
    .footer-note {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #d1d5db;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- Header -->
    <table class="header-table" style="width:100%;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:11px; font-weight:800; letter-spacing:1px; color:#be185d; text-transform:uppercase; margin-bottom:2px;">
            SC FROST HEAVEN BAKERY
          </div>
          <div style="font-size:22px; font-weight:800; color:#111827; margin-bottom:4px;">
            Official Payment Receipt & Tax Invoice
          </div>
          <div style="font-size:11px; color:#4b5563; max-width:320px; line-height:1.4;">
            "Chamathka", Wilegodawaththa, Henwala, Mirissa, Matara District, Southern Province, Sri Lanka
          </div>
          <div style="font-size:11px; color:#4b5563; margin-top:3px;">
            Hotline: <strong>+94 70 241 1623</strong> • Email: <strong>scfrostheaven@gmail.com</strong>
          </div>
        </td>
        <td style="vertical-align:top; text-align:right;">
          <div style="display:inline-block; text-align:right; background:#f9fafb; padding:12px 16px; border:1px solid #e5e7eb; border-radius:8px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">Receipt Ref #</div>
            <div style="font-family:monospace; font-size:16px; font-weight:800; color:#111827; margin:2px 0 4px 0;">
              INV-${shortId}
            </div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:6px;">
              Date: <strong>${printDate}</strong>
            </div>
            <div>
              ${isFullyPaid
                ? '<span class="badge badge-paid">✓ Fully Paid</span>'
                : isDepositPaid
                ? '<span class="badge badge-deposit">✓ Deposit Paid</span>'
                : '<span class="badge badge-paid">Payment Verified</span>'
              }
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Customer and Event Grid -->
    <div class="details-grid">
      <div class="details-col">
        <div class="section-title">Billed To</div>
        <div style="font-size:14px; font-weight:700; color:#111827;">${order.customer_name}</div>
        <div style="color:#4b5563; margin-top:2px;">${order.customer_email}</div>
        ${order.customer_phone ? `<div style="color:#4b5563;">${order.customer_phone}</div>` : ""}
        ${order.customer_address ? `<div style="color:#4b5563; margin-top:2px;">${order.customer_address}</div>` : ""}
      </div>
      <div class="details-col">
        <div class="section-title">Order & Delivery Coordinates</div>
        <div style="color:#111827;"><span style="color:#6b7280;">Order Type:</span> <strong>${order.event_type}</strong></div>
        ${order.event_date ? `<div style="color:#111827; margin-top:2px;"><span style="color:#6b7280;">Scheduled Date:</span> <strong>${formatDate(order.event_date)}</strong></div>` : ""}
        ${order.fulfillment_method ? `<div style="color:#111827; margin-top:2px;"><span style="color:#6b7280;">Fulfillment:</span> <strong style="text-transform:uppercase;">${order.fulfillment_method}</strong></div>` : ""}
        ${order.target_pickup_time ? `<div style="color:#111827; margin-top:2px;"><span style="color:#6b7280;">Target Pickup Time:</span> <strong>${order.target_pickup_time.slice(0, 5)}</strong></div>` : ""}
      </div>
    </div>

    <!-- Items or Cake Description -->
    ${itemsHtml}

    <!-- Financial Summary Ledger -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th>Financial Ledger Item</th>
          <th style="text-align:right;">Amount (LKR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:600; color:#111827;">Total Order Amount</td>
          <td style="text-align:right; font-weight:700; color:#111827;">${formatLKR(quotedPrice)}</td>
        </tr>
        ${order.delivery_fee_lkr && order.delivery_fee_lkr > 0 ? `
          <tr>
            <td style="color:#4b5563;">Delivery Fee</td>
            <td style="text-align:right; color:#4b5563;">${formatLKR(order.delivery_fee_lkr)}</td>
          </tr>
        ` : ""}
        ${order.deposit_amount_lkr && order.deposit_amount_lkr > 0 ? `
          <tr>
            <td style="color:#4b5563;">Required Advance Booking Deposit (50%)</td>
            <td style="text-align:right; color:#4b5563;">${formatLKR(order.deposit_amount_lkr)}</td>
          </tr>
        ` : ""}
        <tr style="background:#f0fdf4;">
          <td style="font-weight:700; color:#166534;">Total Amount Paid & Verified to Date (PayHere)</td>
          <td style="text-align:right; font-weight:800; color:#15803d; font-size:14px;">${formatLKR(amountPaid)}</td>
        </tr>
        <tr style="background:#f9fafb; font-weight:700;">
          <td style="color:#111827;">Remaining Balance Due</td>
          <td style="text-align:right; color:#111827; font-size:14px;">${remainingBalance === 0 ? "LKR 0 (Fully Settled)" : formatLKR(remainingBalance)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Payment References Box -->
    ${paymentReferences.length > 0 ? `
      <div style="margin-top:14px; padding:10px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; font-size:11px;">
        <div style="font-weight:700; text-transform:uppercase; color:#6b7280; margin-bottom:4px;">Verified Payment Gateway Transactions</div>
        ${paymentReferences.map((ref) => `
          <div style="font-family:monospace; color:#111827; padding:2px 0;">
            • ${ref} <span style="color:#16a34a; font-weight:700;">(✓ Verified via PayHere)</span>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <!-- Footer Note -->
    <div class="footer-note">
      <div style="font-weight:700; color:#111827; margin-bottom:2px;">Thank you for your order with SC Frost Heaven!</div>
      <div>Official Bakery Hotline: +94 70 241 1623 • Email: scfrostheaven@gmail.com • Mirissa, Sri Lanka</div>
      <div style="margin-top:4px; font-size:10px; color:#9ca3af;">This is an electronically generated official sales invoice and receipt.</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers clean 1-page PDF print/download via a standalone hidden iframe.
 * Completely eliminates background website leakage and blank pages.
 */
function triggerCleanInvoicePrint(order: ReceiptOrder) {
  const html = generatePrintableInvoiceHtml(order);

  // Use a hidden iframe for 100% clean isolation
  let printFrame = document.getElementById("sc-frostheaven-print-frame") as HTMLIFrameElement | null;
  if (!printFrame) {
    printFrame = document.createElement("iframe");
    printFrame.id = "sc-frostheaven-print-frame";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
    printFrame.style.visibility = "hidden";
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!frameDoc) {
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  // Allow styles and DOM to settle, then invoke clean print dialog
  setTimeout(() => {
    try {
      printFrame?.contentWindow?.focus();
      printFrame?.contentWindow?.print();
    } catch {
      window.print();
    }
  }, 250);
}

export function OrderReceiptModal({ order, isOpen, onClose }: OrderReceiptModalProps) {
  // Prevent background scrolling when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !order || typeof document === "undefined") return null;

  const shortId = order.id.slice(0, 8).toUpperCase();
  const quotedPrice = order.quoted_price_lkr || 0;
  const amountPaid = order.amount_paid_lkr || 0;
  const remainingBalance = Math.max(0, quotedPrice - amountPaid);
  const isFullyPaid = remainingBalance === 0 && amountPaid > 0;
  const isDepositPaid = order.payment_status === "deposit_paid" || (amountPaid > 0 && !isFullyPaid);

  const paymentReferences = order.payment_reference
    ? order.payment_reference.split(",").map((ref) => ref.trim()).filter(Boolean)
    : [];

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-card border border-border shadow-2xl p-6 sm:p-8 my-auto space-y-6 text-foreground max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Official Customer Receipt & Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => triggerCleanInvoicePrint(order)}
              className="rounded-full text-xs gap-1.5 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Invoice (PDF)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerCleanInvoicePrint(order)}
              className="rounded-full text-xs gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              <span>Print</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* RECEIPT HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/50 pb-5">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-widest text-primary uppercase block">
              SC FROST HEAVEN BAKERY
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Official Tax Invoice & Receipt
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              &quot;Chamathka&quot;, Wilegodawaththa, Henwala, Mirissa, Matara District, Sri Lanka
            </p>
            <p className="text-xs text-muted-foreground">
              Tel: +94 70 241 1623 • Email: scfrostheaven@gmail.com
            </p>
          </div>

          <div className="sm:text-right space-y-1 bg-secondary/30 p-3.5 rounded-2xl border border-border/50 shrink-0">
            <div className="text-xs text-muted-foreground">Invoice / Receipt #</div>
            <div className="font-mono text-base font-bold text-foreground">
              INV-{shortId}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Date: {formatDate(new Date().toISOString().split("T")[0])}
            </div>
            <div className="pt-1">
              {isFullyPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Fully Paid
                </span>
              ) : isDepositPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="h-3 w-3" /> Deposit Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  Payment Completed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CUSTOMER & ORDER DETAILS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="rounded-2xl bg-secondary/20 p-3.5 border border-border/40 space-y-1">
            <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">
              Billed To
            </span>
            <p className="font-bold text-sm text-foreground">{order.customer_name}</p>
            <p className="text-muted-foreground">{order.customer_email}</p>
            {order.customer_phone && (
              <p className="text-muted-foreground">{order.customer_phone}</p>
            )}
            {order.customer_address && (
              <p className="text-muted-foreground">{order.customer_address}</p>
            )}
          </div>

          <div className="rounded-2xl bg-secondary/20 p-3.5 border border-border/40 space-y-1">
            <span className="font-semibold block text-[10px] uppercase tracking-wider text-muted-foreground">
              Order & Fulfillment Details
            </span>
            <p className="font-medium text-foreground">
              Type: <span className="font-bold">{order.event_type}</span>
            </p>
            {order.event_date && (
              <p className="text-muted-foreground">
                Scheduled Date: <span className="font-semibold text-foreground">{formatDate(order.event_date)}</span>
              </p>
            )}
            {order.fulfillment_method && (
              <p className="text-muted-foreground">
                Method: <span className="font-semibold text-foreground uppercase">{order.fulfillment_method}</span>
              </p>
            )}
            {order.target_pickup_time && (
              <p className="text-muted-foreground">
                Target Pickup Time: <span className="font-semibold text-foreground">{order.target_pickup_time.slice(0, 5)}</span>
              </p>
            )}
          </div>
        </div>

        {/* ORDER ITEMS OR CUSTOM CAKE DESCRIPTION */}
        {order.items && order.items.length > 0 ? (
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase font-semibold text-muted-foreground">
                  <th className="py-2 px-3.5">Item</th>
                  <th className="py-2 px-3.5 text-center">Qty</th>
                  <th className="py-2 px-3.5 text-right">Price (LKR)</th>
                  <th className="py-2 px-3.5 text-right">Total (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {order.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3.5 font-medium text-foreground">
                      {it.title}
                    </td>
                    <td className="py-2 px-3.5 text-center">{it.quantity}</td>
                    <td className="py-2 px-3.5 text-right">{formatLKR(it.price)}</td>
                    <td className="py-2 px-3.5 text-right font-semibold">{formatLKR(it.price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : order.cake_details ? (
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            <div className="bg-muted/40 px-3.5 py-2 border-b border-border/60 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
              Order Description
            </div>
            <div className="p-3.5 text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Custom Handcrafted Cake — {order.event_type}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {order.cake_details}
              </p>
            </div>
          </div>
        ) : null}

        {/* FINANCIAL SUMMARY TABLE */}
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase font-semibold text-muted-foreground">
                <th className="py-2 px-3.5">Financial Ledger</th>
                <th className="py-2 px-3.5 text-right">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr>
                <td className="py-2 px-3.5 font-medium text-foreground">
                  Total Order Amount
                </td>
                <td className="py-2 px-3.5 text-right font-semibold text-foreground">
                  {formatLKR(quotedPrice)}
                </td>
              </tr>
              {order.delivery_fee_lkr && order.delivery_fee_lkr > 0 ? (
                <tr className="text-muted-foreground">
                  <td className="py-2 px-3.5">Delivery Fee</td>
                  <td className="py-2 px-3.5 text-right">{formatLKR(order.delivery_fee_lkr)}</td>
                </tr>
              ) : null}
              {order.deposit_amount_lkr && order.deposit_amount_lkr > 0 && (
                <tr className="text-muted-foreground">
                  <td className="py-2 px-3.5">Required Booking Deposit (50%)</td>
                  <td className="py-2 px-3.5 text-right">{formatLKR(order.deposit_amount_lkr)}</td>
                </tr>
              )}
              <tr className="bg-emerald-500/5 font-medium">
                <td className="py-2 px-3.5 text-emerald-800 dark:text-emerald-400">
                  Total Paid & Verified to Date (PayHere)
                </td>
                <td className="py-2 px-3.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  {formatLKR(amountPaid)}
                </td>
              </tr>
              <tr className="bg-secondary/40 font-bold text-sm">
                <td className="py-2.5 px-3.5 text-foreground">
                  Remaining Balance Due
                </td>
                <td className="py-2.5 px-3.5 text-right text-primary">
                  {remainingBalance === 0 ? "LKR 0 (Fully Settled)" : formatLKR(remainingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TRANSACTION LEDGER / PAYMENT METHODS */}
        {paymentReferences.length > 0 && (
          <div className="rounded-2xl bg-secondary/20 p-3 border border-border/40 space-y-1.5 text-xs">
            <span className="font-semibold text-foreground block text-[10px] uppercase tracking-wider text-muted-foreground">
              Recorded Payment References & PayHere Gateway
            </span>
            <div className="space-y-1">
              {paymentReferences.map((ref, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-mono bg-card p-2 rounded-xl border border-border/40">
                  <span className="text-foreground">{ref}</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">✓ Verified via PayHere</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER & THANK YOU */}
        <div className="pt-2 text-center text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            Thank you for choosing SC Frost Heaven for your celebration!
          </p>
          <p className="text-[11px]">
            Hotline: +94 70 241 1623 • Email: scfrostheaven@gmail.com
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-border/40">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-full text-xs px-5 cursor-pointer"
          >
            Close
          </Button>
          <Button
            onClick={() => triggerCleanInvoicePrint(order)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-5 gap-1.5 shadow-xs cursor-pointer font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Invoice / PDF</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
