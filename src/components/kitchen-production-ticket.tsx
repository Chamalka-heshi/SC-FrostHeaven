import React from "react";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Calendar,
  Clock,
  Phone,
  Mail,
  User,
  FileText,
  ImageIcon,
  ShieldCheck,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  X,
  ChefHat,
  Sparkles,
  Flame,
  Timer,
} from "lucide-react";
import { formatLKR, getProductionReadiness, getPaymentBadgeInfo } from "@/lib/order-readiness";
import { formatProductionDuration } from "@/lib/kitchen-operations-utils";

export interface TicketOrder {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_type: string;
  event_date: string;
  cake_details: string;
  status: string;
  customer_message?: string | null | undefined;
  internal_notes?: string | null | undefined;
  admin_notes?: string | null | undefined;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | undefined;
  payment_status?: string | null | undefined;
  payment_method?: string | null | undefined;
  quote_issued_at?: string | null | undefined;
  deposit_paid_at?: string | null | undefined;
  fully_paid_at?: string | null | undefined;
  scheduled_bake_date?: string | null | undefined;
  scheduled_decorate_date?: string | null | undefined;
  target_pickup_time?: string | null | undefined;
  production_priority?: string | null | undefined;
  complexity_units?: number | null | undefined;
  assigned_baker_id?: string | null | undefined;
  assigned_decorator_id?: string | null | undefined;
  production_started_at?: string | null | undefined;
  production_completed_at?: string | null | undefined;
  created_at: string;
  updated_at?: string | undefined;
}

export interface TicketImage {
  id: string;
  order_id: string;
  storage_path: string;
  file_name: string;
  signedUrl?: string | null;
}

interface KitchenProductionTicketProps {
  order: TicketOrder;
  images?: TicketImage[] | undefined;
  bakerName?: string | undefined;
  decoratorName?: string | undefined;
  onClose: () => void;
}

export function KitchenProductionTicket({
  order,
  images = [],
  bakerName,
  decoratorName,
  onClose,
}: KitchenProductionTicketProps) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const readiness = getProductionReadiness(order);
  const paymentInfo = getPaymentBadgeInfo(order);
  const durationInfo = formatProductionDuration(
    order.production_started_at,
    order.production_completed_at,
    Date.now()
  );

  const quoted = Number(order.quoted_price_lkr || 0);
  const deposit = Number(order.deposit_amount_lkr || 0);
  const paid = Number(order.amount_paid_lkr || 0);
  const balanceDue = quoted > 0 ? Math.max(0, quoted - paid) : 0;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const parts = dateStr.split("-");
      const year = parseInt(parts[0] || "2026", 10);
      const month = parseInt(parts[1] || "1", 10) - 1;
      const day = parseInt(parts[2] || "1", 10);
      const date = new Date(year, month, day, 12, 0, 0);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-2xl border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
        {/* Ticket Controls Header (Screen only) */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/40 sticky top-0 z-20 backdrop-blur-xs print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
              Production Ticket:
            </span>
            <span className="font-mono text-sm font-bold text-foreground">#{shortId}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="rounded-full gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ticket</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Close ticket"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PRINTABLE TICKET CONTENT */}
        <div
          id="kitchen-ticket-printable"
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-foreground print:p-6 print:overflow-visible print:space-y-4 print:text-black"
        >
          {/* Ticket Header */}
          <div className="flex items-start justify-between border-b-2 border-black/80 pb-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground print:text-black">
                Bakery Production Order Ticket
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground print:text-black mt-0.5">
                SC FrostHeaven Bakery
              </h1>
              <p className="text-xs text-muted-foreground print:text-black/80">
                Artisan Handcrafted Cakes & Custom Pastry
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="inline-block rounded-xl bg-primary/10 print:bg-transparent px-3 py-1 text-sm font-mono font-bold text-primary print:text-black border border-primary/20 print:border-black">
                #{shortId}
              </div>
              <p className="text-[11px] text-muted-foreground print:text-black">
                Printed: {new Date().toLocaleDateString()}{" "}
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Critical Target Date, Priority & Readiness Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl bg-secondary/30 print:bg-neutral-100 p-4 border border-border/80 print:border-black">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground print:text-black">
                Target Event Date
              </span>
              <p className="text-base sm:text-lg font-bold text-primary print:text-black flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                {formatDate(order.event_date)}
              </p>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground print:text-black">
                Celebration
              </span>
              <p className="text-base font-bold text-foreground print:text-black mt-0.5">
                {order.event_type}
              </p>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground print:text-black">
                Priority
              </span>
              <p className="text-base font-bold text-foreground print:text-black mt-0.5 uppercase">
                {order.production_priority || "NORMAL"}
              </p>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground print:text-black">
                Readiness
              </span>
              <p className="text-base font-bold text-foreground print:text-black uppercase mt-0.5">
                {readiness.label}
              </p>
            </div>
          </div>

          {/* Kitchen Schedule & Workload Box */}
          <div className="rounded-2xl border border-black/60 print:border-black p-4 bg-muted/10 print:bg-white space-y-2">
            <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5 border-b border-border/60 print:border-black/30 pb-2">
              <ChefHat className="h-3.5 w-3.5 text-primary print:text-black" />
              Kitchen Schedule & Workstation Metadata
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground print:text-black font-medium">Bake Date:</span>
                <p className="font-bold text-foreground print:text-black">
                  {order.scheduled_bake_date ? formatDate(order.scheduled_bake_date) : "Unscheduled"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black font-medium">Decorate Date:</span>
                <p className="font-bold text-foreground print:text-black">
                  {order.scheduled_decorate_date ? formatDate(order.scheduled_decorate_date) : "Unscheduled"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black font-medium">Target Pickup:</span>
                <p className="font-bold text-foreground print:text-black font-mono">
                  {order.target_pickup_time ? order.target_pickup_time.slice(0, 5) : "Not Specified"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black font-medium">Complexity:</span>
                <p className="font-bold text-foreground print:text-black">
                  ⚡ {Number(order.complexity_units || 1.0).toFixed(1)} units
                </p>
              </div>
            </div>
          </div>

          {/* Financial Clearance Box for Kitchen Team */}
          <div className="rounded-2xl border-2 border-black/60 print:border-black p-4 bg-muted/20 print:bg-white space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 print:border-black/40 pb-2">
              <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-primary print:text-black" />
                Payment Clearance & Financial Status
              </h4>
              <span className="font-mono text-xs font-bold text-foreground print:text-black uppercase">
                {paymentInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground print:text-black">Quoted Total:</span>
                <p className="font-bold text-foreground print:text-black">
                  {formatLKR(order.quoted_price_lkr)}
                </p>
              </div>
              {deposit > 0 && (
                <div>
                  <span className="text-muted-foreground print:text-black">Required Deposit:</span>
                  <p className="font-semibold text-foreground print:text-black">
                    {formatLKR(deposit)}
                  </p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground print:text-black">Paid to Date:</span>
                <p className="font-bold text-foreground print:text-black">{formatLKR(paid)}</p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">
                  Balance Due at Pickup:
                </span>
                <p className="font-bold text-foreground print:text-black">
                  {balanceDue > 0 ? formatLKR(balanceDue) : "Cleared (LKR 0)"}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Contact Details */}
          <div className="rounded-2xl border border-border/60 print:border-black/50 p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-wider font-bold text-muted-foreground print:text-black flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Customer Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground print:text-black">Name:</span>
                <p className="font-semibold text-foreground print:text-black">
                  {order.customer_name}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">Phone:</span>
                <p className="font-semibold text-foreground print:text-black font-mono">
                  {order.customer_phone || "Not provided"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">Email:</span>
                <p className="font-semibold text-foreground print:text-black truncate">
                  {order.customer_email}
                </p>
              </div>
            </div>
          </div>

          {/* Cake Details & Specifications */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary print:text-black" />
              Cake Design Specifications & Ingredients
            </h3>
            <div className="rounded-2xl border-2 border-black/70 bg-card print:bg-white p-5 text-sm text-foreground print:text-black font-medium leading-relaxed whitespace-pre-wrap">
              {order.cake_details}
            </div>
          </div>

          {/* Kitchen Notes */}
          {(order.internal_notes || order.admin_notes) && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 print:bg-neutral-50 print:border-black p-4 space-y-1.5">
              <h4 className="text-xs uppercase tracking-wider font-bold text-amber-900 dark:text-amber-300 print:text-black flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-700 print:text-black" />
                Kitchen Notes & Instructions
              </h4>
              <p className="text-xs text-foreground/90 print:text-black leading-relaxed whitespace-pre-wrap font-medium">
                {order.internal_notes || order.admin_notes}
              </p>
            </div>
          )}

          {/* Attached Inspiration / Reference Photos */}
          {images && images.length > 0 && (
            <div className="space-y-3 pt-2 print:break-inside-avoid">
              <h4 className="text-xs uppercase tracking-wider font-bold text-foreground print:text-black flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-primary print:text-black" />
                Design Reference Photos ({images.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-square rounded-xl border border-border/80 print:border-black bg-muted overflow-hidden"
                  >
                    {img.signedUrl ? (
                      <img
                        src={img.signedUrl}
                        alt={img.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground print:text-black">
                        Photo: {img.file_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Production Timestamps Info (if started) */}
          {durationInfo.hasStarted && (
            <div className="rounded-2xl border border-black/40 p-3 text-xs flex justify-between items-center text-muted-foreground print:text-black">
              <span>Baking Started: {durationInfo.formattedStartTime}</span>
              <span>
                {durationInfo.hasCompleted
                  ? `Completed: ${durationInfo.formattedCompletedTime} (Duration: ${durationInfo.formattedDuration})`
                  : `Elapsed Duration: ${durationInfo.formattedDuration}`}
              </span>
            </div>
          )}

          {/* Kitchen Sign-off Footer */}
          <div className="pt-6 border-t-2 border-dashed border-black/50 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">
                Baker Sign-off:
              </span>
              <p className="text-[11px] font-medium text-foreground print:text-black mt-0.5">
                {bakerName ? `Assigned: ${bakerName}` : "Unassigned"}
              </p>
              <div className="mt-4 border-b border-black w-32" />
            </div>
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">
                Decorator Sign-off:
              </span>
              <p className="text-[11px] font-medium text-foreground print:text-black mt-0.5">
                {decoratorName ? `Assigned: ${decoratorName}` : "Unassigned"}
              </p>
              <div className="mt-4 border-b border-black w-32" />
            </div>
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">
                Ready for Dispatch:
              </span>
              <p className="text-[11px] font-medium text-foreground print:text-black mt-0.5">
                Final Inspection & Packaging
              </p>
              <div className="mt-4 border-b border-black w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
