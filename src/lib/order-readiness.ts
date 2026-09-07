export type ProductionReadinessKey =
  | "awaiting_quote"
  | "awaiting_deposit"
  | "ready_for_production"
  | "in_production"
  | "ready_for_pickup"
  | "completed"
  | "declined"
  | "cancelled";

export interface ReadinessInfo {
  key: ProductionReadinessKey;
  label: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  dotClass: string;
  description: string;
}

export interface PaymentBadgeInfo {
  status: "unquoted" | "unpaid" | "partial_deposit" | "deposit_paid" | "fully_paid";
  label: string;
  badgeClass: string;
  isFullyPaid: boolean;
  isDepositPaid: boolean;
}

export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function getProductionReadiness(order: {
  status: string;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | null | undefined;
}): ReadinessInfo {
  const status = (order.status || "").toLowerCase();
  const deposit = Number(order.deposit_amount_lkr || 0);
  const paid = Number(order.amount_paid_lkr || 0);

  if (status === "submitted" || status === "under_review") {
    return {
      key: "awaiting_quote",
      label: "Awaiting Quote",
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      textClass: "text-amber-700",
      borderClass: "border-amber-500/20",
      bgClass: "bg-amber-500/10",
      dotClass: "bg-amber-500",
      description: "Quote required before acceptance",
    };
  }

  if (status === "quoted") {
    return {
      key: "awaiting_deposit",
      label: "Quoted (Awaiting Customer)",
      badgeClass: "bg-sky-500/10 text-sky-700 border-sky-500/20",
      textClass: "text-sky-700",
      borderClass: "border-sky-500/20",
      bgClass: "bg-sky-500/10",
      dotClass: "bg-sky-500",
      description: "Quotation issued; awaiting customer response",
    };
  }

  if (status === "accepted") {
    if (deposit > 0 && paid < deposit) {
      return {
        key: "awaiting_deposit",
        label: "Awaiting Deposit",
        badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
        textClass: "text-amber-700",
        borderClass: "border-amber-500/30",
        bgClass: "bg-amber-500/10",
        dotClass: "bg-amber-500",
        description: `Deposit of ${formatLKR(deposit)} required to bake`,
      };
    }
    return {
      key: "ready_for_production",
      label: "Ready for Production",
      badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
      textClass: "text-emerald-700",
      borderClass: "border-emerald-500/30",
      bgClass: "bg-emerald-500/10",
      dotClass: "bg-emerald-500",
      description: "Financially cleared for kitchen production",
    };
  }

  if (status === "in_baking") {
    return {
      key: "in_production",
      label: "In Production",
      badgeClass: "bg-purple-500/10 text-purple-700 border-purple-500/30",
      textClass: "text-purple-700",
      borderClass: "border-purple-500/30",
      bgClass: "bg-purple-500/10",
      dotClass: "bg-purple-500",
      description: "Currently in baking / decorating station",
    };
  }

  if (status === "ready") {
    return {
      key: "ready_for_pickup",
      label: "Ready for Pickup",
      badgeClass: "bg-teal-500/10 text-teal-700 border-teal-500/30",
      textClass: "text-teal-700",
      borderClass: "border-teal-500/30",
      bgClass: "bg-teal-500/10",
      dotClass: "bg-teal-500",
      description: "Finished & packaged; ready for handover",
    };
  }

  if (status === "completed") {
    return {
      key: "completed",
      label: "Completed",
      badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      textClass: "text-emerald-700",
      borderClass: "border-emerald-500/20",
      bgClass: "bg-emerald-500/10",
      dotClass: "bg-emerald-500",
      description: "Order completed & fulfilled",
    };
  }

  if (status === "declined") {
    return {
      key: "declined",
      label: "Declined",
      badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/20",
      textClass: "text-rose-700",
      borderClass: "border-rose-500/20",
      bgClass: "bg-rose-500/10",
      dotClass: "bg-rose-500",
      description: "Order declined",
    };
  }

  if (status === "cancelled") {
    return {
      key: "cancelled",
      label: "Cancelled",
      badgeClass: "bg-zinc-500/10 text-zinc-700 border-zinc-500/20",
      textClass: "text-zinc-700",
      borderClass: "border-zinc-500/20",
      bgClass: "bg-zinc-500/10",
      dotClass: "bg-zinc-500",
      description: "Order cancelled",
    };
  }

  return {
    key: "awaiting_quote",
    label: status.replace(/_/g, " "),
    badgeClass: "bg-secondary text-secondary-foreground border-border",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
    bgClass: "bg-secondary",
    dotClass: "bg-muted-foreground",
    description: "",
  };
}

export function getPaymentBadgeInfo(order: {
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | null | undefined;
  payment_status?: string | null | undefined;
}): PaymentBadgeInfo {
  const quoted = order.quoted_price_lkr;
  const deposit = Number(order.deposit_amount_lkr || 0);
  const paid = Number(order.amount_paid_lkr || 0);

  if (quoted === null || quoted === undefined) {
    return {
      status: "unquoted",
      label: "Not Quoted",
      badgeClass: "bg-muted text-muted-foreground border-border",
      isFullyPaid: false,
      isDepositPaid: false,
    };
  }

  if (paid >= quoted && quoted > 0) {
    return {
      status: "fully_paid",
      label: "Fully Paid",
      badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
      isFullyPaid: true,
      isDepositPaid: true,
    };
  }

  if (deposit > 0 && paid >= deposit) {
    return {
      status: "deposit_paid",
      label: "Deposit Paid",
      badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/30",
      isFullyPaid: false,
      isDepositPaid: true,
    };
  }

  if (deposit > 0 && paid > 0 && paid < deposit) {
    return {
      status: "partial_deposit",
      label: `Partial (${formatLKR(paid)} / ${formatLKR(deposit)})`,
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
      isFullyPaid: false,
      isDepositPaid: false,
    };
  }

  return {
    status: "unpaid",
    label: deposit > 0 ? "Deposit Pending" : "Payment Pending",
    badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/30",
    isFullyPaid: false,
    isDepositPaid: false,
  };
}

/**
 * Normalizes phone numbers specifically for WhatsApp wa.me links.
 * Handles Sri Lankan formats (07X, +947X, 947X) and international formats.
 * Returns null if the phone is missing, invalid, or cannot be parsed.
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;

  // Strip all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned || cleaned.length < 9) return null;

  // Sri Lankan local mobile format (07XXXXXXXX -> 947XXXXXXXX)
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    return `94${cleaned.slice(1)}`;
  }

  // Sri Lankan 9-digit format without leading zero (7XXXXXXXX -> 947XXXXXXXX)
  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return `94${cleaned}`;
  }

  // Sri Lankan international format (947XXXXXXXX -> 947XXXXXXXX)
  if (cleaned.startsWith("94") && cleaned.length === 11) {
    return cleaned;
  }

  // General international numbers (9 to 15 digits)
  if (cleaned.length >= 9 && cleaned.length <= 15) {
    return cleaned;
  }

  return null;
}

/**
 * Builds a direct wa.me link with optional non-sensitive pre-filled greeting.
 * Returns null if phone number cannot be safely normalized.
 */
export function getWhatsAppUrl(
  phone: string | null | undefined,
  prefillText?: string,
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;

  if (prefillText && prefillText.trim()) {
    return `https://wa.me/${normalized}?text=${encodeURIComponent(prefillText.trim())}`;
  }

  return `https://wa.me/${normalized}`;
}

/**
 * Builds a standard mailto: link with optional subject and body.
 */
export function getEmailMailtoUrl(email: string, subject?: string, body?: string): string {
  if (!email || typeof email !== "string") return "#";

  const params: string[] = [];
  if (subject && subject.trim()) {
    params.push(`subject=${encodeURIComponent(subject.trim())}`);
  }
  if (body && body.trim()) {
    params.push(`body=${encodeURIComponent(body.trim())}`);
  }

  const queryString = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${email.trim()}${queryString}`;
}
