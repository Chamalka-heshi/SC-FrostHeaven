// @ts-nocheck
/**
 * SC Frost Heaven — Supabase Edge Function: payhere-webhook
 * Phase 10 Server-to-Server PayHere IPN Webhook Verification
 *
 * Responsibilities:
 * 1. Accepts asynchronous POST notification directly from PayHere gateway servers.
 * 2. Cryptographically verifies PayHere MD5 signature using server-only PAYHERE_MERCHANT_SECRET.
 * 3. Enforces currency === 'LKR' and status_code === '2' (SUCCESS).
 * 4. Invokes trusted public.process_verified_payment database function.
 * 5. Guarantees idempotency and protects against replay/overpayment attacks.
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Helper: MD5 in uppercase
async function md5HexUpper(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "PayHere webhook listener active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const expectedMerchantId = Deno.env.get("PAYHERE_MERCHANT_ID") || "1211149";
    const merchantSecret = Deno.env.get("PAYHERE_MERCHANT_SECRET") || "";

    if (!merchantSecret) {
      console.error("[payhere-webhook] Server error: PAYHERE_MERCHANT_SECRET not configured.");
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    // PayHere sends form-urlencoded data by default, but can also send JSON
    const contentType = req.headers.get("content-type") || "";
    let data: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((val, key) => {
        data[key] = String(val);
      });
    } else {
      data = await req.json().catch(() => ({}));
    }

    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      method,
      status_message,
      custom_1,
      custom_2,
    } = data;

    console.log(`[payhere-webhook] Received IPN for Order: ${order_id}, PaymentID: ${payment_id}, Status: ${status_code}, Amount: ${payhere_amount} ${payhere_currency}`);

    // 1. Validate required fields
    if (!merchant_id || !order_id || !payment_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
      console.warn("[payhere-webhook] Missing required parameters in IPN payload:", data);
      return new Response("Missing required parameters", { status: 400, headers: corsHeaders });
    }

    // 2. Cryptographic Signature Validation
    // Formula: strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
    const hashedSecret = await md5HexUpper(merchantSecret.trim());
    const rawSignatureData = `${merchant_id.trim()}${order_id.trim()}${payhere_amount.trim()}${payhere_currency.trim()}${status_code.trim()}${hashedSecret}`;
    const calculatedMd5Sig = await md5HexUpper(rawSignatureData);

    if (md5sig.trim().toUpperCase() !== calculatedMd5Sig) {
      console.error(`[payhere-webhook] Security Alert: Invalid MD5 signature. Expected: ${calculatedMd5Sig}, Received: ${md5sig}`);
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    // 3. Currency Validation
    if (payhere_currency.trim().toUpperCase() !== "LKR") {
      console.error(`[payhere-webhook] Invalid currency: ${payhere_currency}. Expected LKR.`);
      return new Response("Invalid currency", { status: 400, headers: corsHeaders });
    }

    // 4. Status Code Validation (2 = SUCCESS, 0 = Pending, -1 = Canceled, -2 = Failed, -3 = Chargedback)
    if (status_code.trim() !== "2") {
      console.warn(`[payhere-webhook] Non-success status code received: ${status_code} (${status_message || "No message"}). Skipping credit.`);
      return new Response(`Payment status '${status_code}' acknowledged`, { status: 200, headers: corsHeaders });
    }

    // 5. Reconstruct Target Order UUID
    // Order ID might be sanitized with underscores (e.g. 3fa85f64_5717_4562_b3fc_2c963f66afa6)
    let targetOrderUuid = order_id.trim();
    if (targetOrderUuid.includes("_") && targetOrderUuid.length === 36) {
      targetOrderUuid = targetOrderUuid.replace(/_/g, "-");
    }

    const verifiedAmountLkr = parseFloat(payhere_amount);
    if (isNaN(verifiedAmountLkr) || verifiedAmountLkr <= 0) {
      console.error("[payhere-webhook] Invalid numeric amount:", payhere_amount);
      return new Response("Invalid payment amount", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Invoke Trusted Database Payment Processor
    const { data: result, error: rpcErr } = await supabase.rpc("process_verified_payment", {
      p_order_id: targetOrderUuid,
      p_payment_ref: payment_id.trim(),
      p_amount_lkr: verifiedAmountLkr,
      p_gateway: "PayHere",
      p_payment_type: custom_1 || "deposit",
      p_raw_meta: {
        method: method || "online",
        status_message: status_message || "Success",
        payhere_order_id: order_id,
        received_at: new Date().toISOString(),
      },
    });

    if (rpcErr) {
      console.error("[payhere-webhook] Error processing verified payment via RPC:", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[payhere-webhook] Verified payment recorded successfully for Order ${targetOrderUuid}:`, result);

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[payhere-webhook] Unexpected exception in webhook handler:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
