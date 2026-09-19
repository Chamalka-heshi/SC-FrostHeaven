import { supabase } from "@/lib/supabase";

// Default public sandbox merchant ID provided by PayHere for standard test checkout
export const DEFAULT_PAYHERE_SANDBOX_MERCHANT_ID = "1211149";

/**
 * Returns the configured public PayHere Merchant ID.
 * NOTE: Merchant secret is strictly SERVER-ONLY and never read in client code.
 */
export function getPayHereMerchantId(): string {
  return import.meta.env["VITE_PAYHERE_MERCHANT_ID"] || DEFAULT_PAYHERE_SANDBOX_MERCHANT_ID;
}

/**
 * Determines whether PayHere is running in sandbox mode
 */
export function isPayHereSandbox(): boolean {
  return import.meta.env["VITE_PAYHERE_SANDBOX"] !== "false";
}

/**
 * Normalizes Sri Lankan phone numbers to the format required by PayHere (10 digits, e.g. 0771234567)
 */
export function formatPayHerePhone(rawPhone?: string | null): string {
  if (!rawPhone || !rawPhone.trim()) return "0702411623";
  const cleaned = rawPhone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("94") && cleaned.length >= 11) {
    return "0" + cleaned.slice(2, 11);
  }
  if (cleaned.startsWith("0") && cleaned.length >= 10) {
    return cleaned.slice(0, 10);
  }
  if (cleaned.length === 9) {
    return "0" + cleaned;
  }
  return cleaned.padEnd(10, "0").slice(0, 10);
}

export interface PayHerePaymentObject {
  sandbox: boolean;
  merchant_id: string;
  return_url?: string | undefined;
  cancel_url?: string | undefined;
  notify_url?: string | undefined;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  delivery_address?: string | undefined;
  delivery_city?: string | undefined;
  delivery_country?: string | undefined;
  custom_1?: string | undefined;
  custom_2?: string | undefined;
  hash?: string | undefined;
}

export interface PayHereCheckoutSessionParams {
  orderId: string;
  paymentType?: "deposit" | "full" | "balance";
  contact?: string;
}

export interface PayHereCheckoutSessionResponse {
  success: boolean;
  merchant_id: string;
  order_id: string;
  raw_order_id: string;
  amount: string;
  currency: string;
  hash: string;
  notify_url: string;
  items: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_type: string;
  remaining_balance_lkr: number;
}

/**
 * Requests authoritative checkout creation from backend Edge Function.
 * The Edge Function reads the database order record, validates remaining balance,
 * and signs the checkout payload using the server-only merchant secret.
 */
export async function createPayHereCheckoutSession(
  params: PayHereCheckoutSessionParams
): Promise<PayHereCheckoutSessionResponse> {
  const { data, error } = await supabase.functions.invoke("payhere-create", {
    body: {
      order_id: params.orderId,
      payment_type: params.paymentType || "full",
      contact: params.contact,
    },
  });

  if (error) {
    console.error("[PayHere Create] Edge function error:", error);
    throw new Error(error.message || "Failed to initialize secure PayHere checkout session.");
  }

  if (!data || !data.hash) {
    throw new Error(data?.error || "Invalid response from checkout initialization service.");
  }

  return data as PayHereCheckoutSessionResponse;
}

/**
 * Dynamically loads the official PayHere JS SDK script
 */
export function loadPayHereSdk(isSandbox: boolean = isPayHereSandbox()): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return resolve(null);
    }

    if ((window as any).payhere) {
      return resolve((window as any).payhere);
    }

    const scriptId = "payhere-sdk-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        resolve((window as any).payhere);
      });
      existingScript.addEventListener("error", (err) => {
        reject(err);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = isSandbox
      ? "https://sandbox.payhere.lk/lib/payhere.js"
      : "https://www.payhere.lk/lib/payhere.js";
    script.async = true;

    script.onload = () => {
      resolve((window as any).payhere);
    };

    script.onerror = (err) => {
      console.error("[PayHere SDK] Failed to load PayHere script:", err);
      reject(new Error("Failed to load PayHere payment system."));
    };

    document.head.appendChild(script);
  });
}
