import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Receipt,
  Cake,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  FileText,
  User,
  Mail,
  Phone,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CustomOrderTimeline, STATUS_LABELS } from "@/components/custom-order-timeline";
import { OrderReceiptModal } from "@/components/order-receipt-modal";
import { PayHereButton } from "@/components/payhere-button";
import { createPageMeta, createBreadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/track-order")({
  validateSearch: (search: Record<string, unknown>): { orderId?: string | undefined; contact?: string | undefined } => ({
    orderId: typeof search["orderId"] === "string" ? search["orderId"] : undefined,
    contact: typeof search["contact"] === "string" ? search["contact"] : undefined,
  }),
  head: () => {
    const { meta, links } = createPageMeta({
      title: "Track Order & Invoice Receipt — SC Frost Heaven",
      description:
        "Check your custom cake order status, live baking milestones, payment verification, and download official PDF invoice receipts.",
      path: "/track-order",
    });

    return {
      meta,
      links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            createBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Track Order", path: "/track-order" },
            ])
          ),
        },
      ],
    };
  },
  component: TrackOrderPage,
});

export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

interface TrackedOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_type: string;
  event_date: string;
  cake_details: string;
  status: string;
  customer_message?: string | null;
  quoted_price_lkr?: number | null;
  deposit_amount_lkr?: number | null;
  amount_paid_lkr?: number;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  target_pickup_time?: string | null;
  quote_issued_at?: string | null;
  deposit_paid_at?: string | null;
  fully_paid_at?: string | null;
  created_at: string;
  updated_at?: string;
}

function TrackOrderPage() {
  const searchParams = Route.useSearch();
  const [orderIdInput, setOrderIdInput] = useState(searchParams?.orderId || "");
  const [contactInput, setContactInput] = useState(searchParams?.contact || "");
  const [isSearching, setIsSearching] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Online payment modal state
  const [onlinePaymentModal, setOnlinePaymentModal] = useState<{
    selectedOption: "deposit" | "full";
  } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const performLookup = async (orderIdToFind: string, contactToFind: string) => {
    const trimmedId = orderIdToFind.trim();
    const trimmedContact = contactToFind.trim();

    if (!trimmedId) {
      toast.error("Please enter your Order ID.");
      return;
    }

    if (!trimmedContact) {
      toast.error("Please enter the Email or Phone number used when ordering.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.rpc("lookup_guest_order", {
        p_order_id: trimmedId,
        p_contact: trimmedContact,
      });

      if (error) {
        // Fallback to direct client table query if RPC is not deployed yet
        console.warn("RPC lookup_guest_order failed, trying direct lookup query:", error);
        const { data: directData, error: directError } = await supabase
          .from("custom_orders")
          .select("*")
          .eq("id", trimmedId)
          .maybeSingle();

        if (directError || !directData) {
          setTrackedOrder(null);
          toast.error("No matching order found. Please verify your Order ID and Email/Phone.");
          return;
        }

        const matchEmail = (directData.customer_email || "").toLowerCase() === trimmedContact.toLowerCase();
        const matchPhone =
          (directData.customer_phone || "").replace(/\D/g, "").slice(-7) ===
          trimmedContact.replace(/\D/g, "").slice(-7);

        if (matchEmail || matchPhone) {
          setTrackedOrder(directData as TrackedOrder);
          toast.success("Order details retrieved successfully!");
        } else {
          setTrackedOrder(null);
          toast.error("Order ID found, but contact information did not match.");
        }
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        setTrackedOrder(data[0] as TrackedOrder);
        toast.success("Order details retrieved successfully!");
      } else {
        setTrackedOrder(null);
        toast.error("No order found matching the provided details.");
      }
    } catch (err: unknown) {
      console.error("Order lookup error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to search order. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchParams?.orderId && searchParams?.contact) {
      performLookup(searchParams.orderId, searchParams.contact);
    }
  }, [searchParams?.orderId, searchParams?.contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(orderIdInput, contactInput);
  };

  const handlePayHereSuccess = async (_paymentId: string) => {
    if (!trackedOrder || !onlinePaymentModal) return;

    try {
      setIsProcessingPayment(true);
      toast.success("Payment submitted successfully! Refreshing order status...");
      setOnlinePaymentModal(null);
      const searchContact = contactInput || trackedOrder.customer_email || trackedOrder.customer_phone || "";
      if (trackedOrder.id && searchContact) {
        await performLookup(trackedOrder.id, searchContact);
      }
      setIsReceiptModalOpen(true);
    } catch (err: unknown) {
      console.error("Order refresh error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to refresh order status.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-hero px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* HEADER */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3.5 py-1 text-xs font-semibold text-blush-foreground">
            <Search className="h-3.5 w-3.5" />
            Order Tracker & Receipt Hub
          </span>
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Track Your Cake Order
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Enter your Order Reference number and contact email or phone to view live status, timeline milestones, and print official invoice receipts.
          </p>
        </div>

        {/* LOOKUP FORM */}
        <div className="rounded-3xl bg-card p-6 sm:p-8 shadow-soft border border-border/70">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-id" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Order ID / Reference
                </Label>
                <div className="relative">
                  <Input
                    id="order-id"
                    placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                    required
                    className="font-mono text-xs rounded-xl pr-8"
                  />
                  <Cake className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Found on your confirmation message or email summary.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Email or Phone Number
                </Label>
                <div className="relative">
                  <Input
                    id="contact"
                    placeholder="e.g. customer@example.com or 0771234567"
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    required
                    className="text-xs rounded-xl pr-8"
                  />
                  <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Must match the contact details submitted with the order.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Have an account? <Link to="/login" className="text-primary hover:underline font-medium">Log In to View All Orders</Link>
              </p>
              <Button
                type="submit"
                disabled={isSearching}
                className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 shadow-xs font-medium"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track Order
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* SEARCH RESULTS */}
        {trackedOrder && (
          <div className="space-y-8 animate-in fade-in-50 duration-300">
            {/* ORDER STATUS CARD */}
            <div className="rounded-3xl bg-card p-6 sm:p-8 shadow-soft border border-border/70 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                      {trackedOrder.event_type} Celebration Cake
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {STATUS_LABELS[trackedOrder.status] || trackedOrder.status}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground mt-1">
                    Order #{trackedOrder.id.slice(0, 8)}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Placed on {formatDate(trackedOrder.created_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5 shadow-xs"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Download / Print Receipt</span>
                  </Button>
                </div>
              </div>

              {/* TIMELINE */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Preparation Timeline
                </h3>
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60">
                  <CustomOrderTimeline status={trackedOrder.status} />
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Customer Name
                  </span>
                  <p className="text-sm font-semibold text-foreground">{trackedOrder.customer_name}</p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Event Date
                  </span>
                  <p className="text-sm font-semibold text-foreground">{formatDate(trackedOrder.event_date)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Target Pickup Time
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {trackedOrder.target_pickup_time || "To be confirmed"}
                  </p>
                </div>
              </div>

              {/* CAKE DETAILS */}
              <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Cake className="h-4 w-4 text-primary" /> Cake Specifications & Design Details
                </span>
                <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                  {trackedOrder.cake_details}
                </p>
              </div>

              {/* FINANCIAL & PAYMENT SUMMARY */}
              {trackedOrder.quoted_price_lkr !== null && trackedOrder.quoted_price_lkr !== undefined && trackedOrder.quoted_price_lkr > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-primary/20 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">Financial & Payment Status</h4>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Total: <span className="font-bold text-foreground text-sm">{formatLKR(trackedOrder.quoted_price_lkr)}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Amount Paid</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatLKR(trackedOrder.amount_paid_lkr ?? 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Required Deposit</span>
                      <span className="font-semibold text-foreground">
                        {formatLKR(trackedOrder.deposit_amount_lkr ?? 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Remaining Balance</span>
                      <span className="font-semibold text-foreground">
                        {formatLKR(Math.max((trackedOrder.quoted_price_lkr ?? 0) - (trackedOrder.amount_paid_lkr ?? 0), 0))}
                      </span>
                    </div>
                  </div>

                  {/* Online Payment Trigger if pending */}
                  {(trackedOrder.amount_paid_lkr ?? 0) < (trackedOrder.quoted_price_lkr ?? 0) && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button
                        onClick={() => setOnlinePaymentModal({ selectedOption: (trackedOrder.amount_paid_lkr ?? 0) === 0 && (trackedOrder.deposit_amount_lkr ?? 0) > 0 ? "deposit" : "full" })}
                        className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium gap-1.5"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Pay Balance Online (PayHere)</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {hasSearched && !trackedOrder && !isSearching && (
          <div className="rounded-3xl bg-card p-10 text-center shadow-soft border border-border/70 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">Order Not Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                We couldn&apos;t find an order matching that Order ID and contact combination. Please double check the ID format and the email or phone number provided.
              </p>
            </div>
            <div className="pt-2">
              <Button asChild variant="outline" className="rounded-full text-xs">
                <Link to="/contact">Need Help? Contact Bakery Hotline</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {trackedOrder && (
        <OrderReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          order={trackedOrder}
        />
      )}

      {/* ONLINE PAYMENT MODAL */}
      {onlinePaymentModal && trackedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl border border-border space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Pay Online via PayHere</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOnlinePaymentModal(null)}
                className="rounded-full h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Pay securely using Visa, Mastercard, Genie, or FriMi via the Sri Lanka PayHere payment gateway.
              </p>

              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Reference:</span>
                  <span className="font-mono font-semibold text-foreground">#{trackedOrder.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Amount:</span>
                  <span className="text-base font-bold text-primary">
                    {formatLKR(
                      onlinePaymentModal.selectedOption === "deposit"
                        ? (trackedOrder.deposit_amount_lkr ?? 0)
                        : Math.max((trackedOrder.quoted_price_lkr ?? 0) - (trackedOrder.amount_paid_lkr ?? 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <PayHereButton
              orderId={trackedOrder.id}
              amountLkr={
                onlinePaymentModal.selectedOption === "deposit"
                  ? (trackedOrder.deposit_amount_lkr ?? 0)
                  : Math.max((trackedOrder.quoted_price_lkr ?? 0) - (trackedOrder.amount_paid_lkr ?? 0), 0)
              }
              paymentType={onlinePaymentModal.selectedOption}
              contact={contactInput || trackedOrder.customer_email || trackedOrder.customer_phone || undefined}
              itemDescription={`${trackedOrder.event_type} Custom Cake (#${trackedOrder.id.slice(0, 8)})`}
              customerName={trackedOrder.customer_name}
              customerEmail={trackedOrder.customer_email}
              customerPhone={trackedOrder.customer_phone || undefined}
              onSuccess={handlePayHereSuccess}
              onError={(err) => toast.error(typeof err === "string" ? err : err?.message || "Payment failed")}
              disabled={isProcessingPayment}
            />
          </div>
        </div>
      )}
    </div>
  );
}
