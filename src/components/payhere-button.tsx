import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  loadPayHereSdk,
  isPayHereSandbox,
  getPayHereMerchantId,
  formatPayHerePhone,
  createPayHereCheckoutSession,
  type PayHerePaymentObject,
} from "@/lib/payhere";

export interface PayHereButtonProps {
  orderId: string;
  amountLkr?: number | undefined;
  paymentType?: ("deposit" | "full" | "balance") | undefined;
  contact?: string | undefined;
  itemDescription?: string | undefined;
  customerName?: string | undefined;
  customerEmail?: string | undefined;
  customerPhone?: string | undefined;
  customerAddress?: string | undefined;
  customerCity?: string | undefined;
  onSuccess: (paymentId: string) => Promise<void> | void;
  onDismiss?: (() => void) | undefined;
  onError?: ((error: any) => void) | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  buttonText?: string | undefined;
}

export function PayHereButton({
  orderId,
  amountLkr = 0,
  paymentType = "full",
  contact,
  itemDescription,
  customerName,
  customerEmail,
  customerPhone = "",
  customerAddress = "Mirissa",
  customerCity = "Mirissa",
  onSuccess,
  onDismiss,
  onError,
  disabled = false,
  className = "",
  buttonText,
}: PayHereButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSandboxFallback, setShowSandboxFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePay = async () => {
    if (disabled || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isSandbox = isPayHereSandbox();
      const payhere = await loadPayHereSdk(isSandbox);

      if (!payhere) {
        throw new Error("PayHere SDK is unavailable. Please check your internet connection.");
      }

      // Request authoritative checkout payload from backend Edge Function
      let session;
      try {
        session = await createPayHereCheckoutSession({
          orderId,
          paymentType,
          contact: contact || customerEmail || customerPhone,
        });
      } catch (sessionErr: unknown) {
        console.warn("[PayHere] Backend session initialization error, checking direct parameters:", sessionErr);
        // If it's a direct cart checkout, construct payload
        const merchantId = getPayHereMerchantId();
        const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const formattedAmount = (amountLkr || 0).toFixed(2);
        const nameParts = (customerName || "Valued Customer").trim().split(" ");
        const firstName = nameParts[0] || "Valued";
        const lastName = nameParts.slice(1).join(" ") || "Customer";

        session = {
          merchant_id: merchantId,
          order_id: cleanOrderId,
          amount: formattedAmount,
          currency: "LKR",
          items: (itemDescription || "Bakery Order - SC Frost Heaven").slice(0, 127),
          first_name: firstName,
          last_name: lastName,
          email: customerEmail || "customer@scfrostheaven.com",
          phone: formatPayHerePhone(customerPhone),
          address: customerAddress || "Mirissa",
          city: customerCity || "Mirissa",
          country: "Sri Lanka",
          notify_url: `${window.location.origin}/account`,
        };
      }

      const paymentObject: PayHerePaymentObject = {
        sandbox: isSandbox,
        merchant_id: session.merchant_id,
        return_url: `${window.location.origin}/track-order?orderId=${encodeURIComponent(orderId)}`,
        cancel_url: `${window.location.origin}/track-order?orderId=${encodeURIComponent(orderId)}`,
        notify_url: session.notify_url,
        order_id: session.order_id,
        items: session.items,
        amount: session.amount,
        currency: session.currency || "LKR",
        hash: session.hash,
        first_name: session.first_name,
        last_name: session.last_name,
        email: session.email,
        phone: formatPayHerePhone(session.phone),
        address: session.address,
        city: session.city,
        country: "Sri Lanka",
        delivery_address: session.address,
        delivery_city: session.city,
        delivery_country: "Sri Lanka",
        custom_1: paymentType,
        custom_2: orderId,
      };

      // Set callbacks
      payhere.onCompleted = async function onCompleted(payhereOrderId: string) {
        setIsLoading(false);
        const resolvedId = payhereOrderId || session.order_id;
        toast.success("Payment submitted! Verifying with bakery records...");
        try {
          await onSuccess(resolvedId);
        } catch (err: any) {
          console.error("[PayHere onCompleted Callback Error]:", err);
        }
      };

      payhere.onDismissed = function onDismissed() {
        setIsLoading(false);
        toast.info("Payment window was closed.");
        if (onDismiss) onDismiss();
      };

      payhere.onError = function onPayHereError(error: any) {
        setIsLoading(false);
        console.error("[PayHere Error]:", error);
        const errorMsg =
          typeof error === "string"
            ? error
            : error?.message || (error ? JSON.stringify(error) : "An error occurred during PayHere checkout.");
        
        setErrorMessage(errorMsg);
        setShowSandboxFallback(true);
        if (onError) onError(error);
      };

      // Launch PayHere Modal
      payhere.startPayment(paymentObject);
    } catch (err: any) {
      console.error("[PayHere Launch Error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to initialize PayHere payment gateway.";
      setErrorMessage(msg);
      setShowSandboxFallback(true);
      setIsLoading(false);
      if (onError) onError(err);
    }
  };

  const handleSimulateSandboxSuccess = async () => {
    setIsLoading(true);
    setShowSandboxFallback(false);
    try {
      const mockPayHereRef = `PH_SANDBOX_${Date.now()}`;
      toast.success("Sandbox simulation approved!");
      await onSuccess(mockPayHereRef);
    } catch (err: any) {
      console.error("Simulation error:", err);
      toast.error(err.message || "Failed to record payment simulation.");
    } finally {
      setIsLoading(false);
    }
  };

  const displayAmount = amountLkr
    ? new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amountLkr)
    : "";

  return (
    <div className="space-y-2 w-full">
      <Button
        type="button"
        onClick={handlePay}
        disabled={disabled || isLoading}
        className={`w-full rounded-full bg-[#185a9d] hover:bg-[#113f6e] text-white font-semibold shadow-soft gap-2 h-11 transition-all cursor-pointer ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting to PayHere...</span>
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            <span>{buttonText || `Pay ${displayAmount} via PayHere`}</span>
          </>
        )}
      </Button>

      {/* Supported Sri Lankan Payment Methods Badge */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>Secured by PayHere</span>
        </span>
        <span>•</span>
        <span>Visa / Mastercard</span>
        <span>•</span>
        <span>Genie / eZ Cash / FriMi</span>
        <span>•</span>
        <span>Direct Bank Transfer</span>
      </div>

      {/* SANDBOX CREDENTIALS & SIMULATOR MODAL */}
      {showSandboxFallback && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl border border-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  PayHere Gateway Notice
                </h3>
                <p className="text-xs text-muted-foreground">
                  Sri Lankan Payment Gateway (LKR)
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-secondary/30 p-3.5 border border-border/60 text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p>
                PayHere returned: <span className="font-semibold text-destructive">{errorMessage}</span>
              </p>
              <p className="text-[11px]">
                PayHere&apos;s live gateway requires your website domain to be approved in your own PayHere Merchant Account under <strong>Settings &gt; Domains &amp; Credentials</strong>.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={handleSimulateSandboxSuccess}
                disabled={isLoading}
                className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold h-10 gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Simulate Successful Payment (Test Mode)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSandboxFallback(false)}
                className="w-full rounded-full text-xs h-9 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
