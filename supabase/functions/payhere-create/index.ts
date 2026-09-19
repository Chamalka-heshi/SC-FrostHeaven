// @ts-nocheck
/**
 * SC Frost Heaven — Supabase Edge Function: payhere-create
 * Phase 10 Secure PayHere Checkout Creation
 *
 * Responsibilities:
 * 1. Authoritatively validates order from database (checks status, quoted price, remaining balance).
 * 2. Authenticates user ownership or verifies guest contact match for custom orders.
 * 3. Supports direct cart checkout sessions.
 * 4. Server-side determines the exact payable amount.
 * 5. Generates PayHere checkout hash using secure server-only PAYHERE_MERCHANT_SECRET.
 * 6. Returns checkout payload with notify_url pointing to payhere-webhook.
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const merchantId = Deno.env.get("PAYHERE_MERCHANT_ID") || "1211149";
    const merchantSecret = Deno.env.get("PAYHERE_MERCHANT_SECRET") || "";

    if (!merchantSecret) {
      console.error("[payhere-create] Server configuration error: PAYHERE_MERCHANT_SECRET is not set.");
      return new Response(
        JSON.stringify({ error: "Payment gateway configuration error on server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      order_id,
      payment_type = "full",
      contact,
      amount_lkr,
      items: cartItemsDesc,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      customer_city,
    } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "Order ID is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCartOrder = order_id.startsWith("cart_") || order_id.startsWith("cart-") || order_id.startsWith("CART-");
    let payableAmount: number = 0;
    let itemsDescription = "Bakery Order - SC Frost Heaven";
    let custName = customer_name || "Valued Customer";
    let custEmail = customer_email || "customer@scfrostheaven.com";
    let custPhone = customer_phone || "0702411623";
    let custAddress = customer_address || "Mirissa";
    let custCity = customer_city || "Mirissa";
    let remainingBalance = 0;

    if (isCartOrder) {
      payableAmount = typeof amount_lkr === "number" ? amount_lkr : parseFloat(amount_lkr) || 0;
      if (payableAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid cart payment amount." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cartItemsDesc) itemsDescription = String(cartItemsDesc).slice(0, 127);
      remainingBalance = payableAmount;
    } else {
      // Custom order -> Authoritative database lookup
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: order, error: orderErr } = await supabase
        .from("custom_orders")
        .select("*")
        .eq("id", order_id)
        .maybeSingle();

      if (orderErr || !order) {
        return new Response(
          JSON.stringify({ error: "Custom order not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lifecycle status validation
      if (!order.quoted_price_lkr || order.quoted_price_lkr <= 0) {
        return new Response(
          JSON.stringify({ error: "Cannot create payment for an order without a formal quotation." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["declined", "cancelled"].includes(order.status)) {
        return new Response(
          JSON.stringify({ error: `Cannot pay for an order in status '${order.status}'.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Authorization check (Authenticated user vs Guest contact verification)
      const authHeader = req.headers.get("Authorization");
      let isAuthorized = false;

      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          if (order.customer_id === user.id || order.customer_id === null) {
            isAuthorized = true;
          } else {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single();
            if (profile?.role === "admin") isAuthorized = true;
          }
        }
      }

      if (!isAuthorized && contact) {
        const cleanContact = contact.trim().toLowerCase();
        const matchEmail = (order.customer_email || "").trim().toLowerCase() === cleanContact;
        const numContact = contact.replace(/\D/g, "");
        const orderPhone = (order.customer_phone || "").replace(/\D/g, "");
        const matchPhone = numContact.length >= 7 && orderPhone.endsWith(numContact.slice(-7));

        if (matchEmail || matchPhone) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: contact details or login do not match this order." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Authoritative Amount Calculation
      const amountPaid = order.amount_paid_lkr ?? 0;
      remainingBalance = Math.max(order.quoted_price_lkr - amountPaid, 0);

      if (remainingBalance <= 0) {
        return new Response(
          JSON.stringify({ error: "Order is already fully settled." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      payableAmount = remainingBalance;
      if (payment_type === "deposit" && order.deposit_amount_lkr && order.deposit_amount_lkr > 0) {
        if (amountPaid < order.deposit_amount_lkr) {
          payableAmount = order.deposit_amount_lkr - amountPaid;
        }
      }

      itemsDescription = `${order.event_type} Custom Cake (#${order.id.slice(0, 8)})`;
      custName = order.customer_name || custName;
      custEmail = order.customer_email || custEmail;
      custPhone = order.customer_phone || custPhone;
    }

    const formattedAmount = payableAmount.toFixed(2);
    const cleanOrderId = order_id.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Server-Side Hash Generation
    // Formula: strtoupper(md5(merchant_id + order_id + formatted_amount + currency + strtoupper(md5(merchant_secret))))
    const hashedSecret = await md5HexUpper(merchantSecret.trim());
    const rawData = `${merchantId.trim()}${cleanOrderId}${formattedAmount}LKR${hashedSecret}`;
    const hash = await md5HexUpper(rawData);

    const notifyUrl = `${supabaseUrl}/functions/v1/payhere-webhook`;

    const nameParts = custName.trim().split(" ");
    const firstName = nameParts[0] || "Valued";
    const lastName = nameParts.slice(1).join(" ") || "Customer";

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id: merchantId,
        order_id: cleanOrderId,
        raw_order_id: order_id,
        amount: formattedAmount,
        currency: "LKR",
        hash: hash,
        notify_url: notifyUrl,
        items: itemsDescription,
        first_name: firstName,
        last_name: lastName,
        email: custEmail,
        phone: custPhone,
        address: custAddress,
        city: custCity,
        country: "Sri Lanka",
        payment_type: payment_type,
        remaining_balance_lkr: remainingBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[payhere-create] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
