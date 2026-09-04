import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, Calendar, Clock, Phone, Mail, User, FileText, ImageIcon, ShieldCheck, X } from "lucide-react";

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
  admin_notes: string | null;
  created_at: string;
  updated_at?: string;
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
  images?: TicketImage[];
  onClose: () => void;
}

export function KitchenProductionTicket({
  order,
  images = [],
  onClose,
}: KitchenProductionTicketProps) {
  const shortId = order.id.slice(0, 8).toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
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
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      {/* Container - on screen modal, on print takes full page */}
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-2xl border border-border overflow-hidden print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none print:p-0">
        {/* Screen-only Action Toolbar */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/40 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Kitchen Production Ticket — #{shortId}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 px-4 h-9 text-xs cursor-pointer shadow-xs"
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
                Artisan Handcrafted Cakes & Desserts
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="inline-block rounded-xl bg-primary/10 print:bg-transparent px-3 py-1 text-sm font-mono font-bold text-primary print:text-black border border-primary/20 print:border-black">
                #{shortId}
              </div>
              <p className="text-[11px] text-muted-foreground print:text-black">
                Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Critical Target Date & Event Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-2xl bg-secondary/30 print:bg-neutral-100 p-4 border border-border/80 print:border-black">
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
                Celebration Type
              </span>
              <p className="text-base sm:text-lg font-bold text-foreground print:text-black mt-0.5">
                {order.event_type}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground print:text-black">
                Production Status
              </span>
              <p className="text-base font-bold text-foreground print:text-black uppercase mt-0.5">
                {order.status.replace(/_/g, " ")}
              </p>
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
                <p className="font-semibold text-foreground print:text-black">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">Phone:</span>
                <p className="font-semibold text-foreground print:text-black">{order.customer_phone || "Not provided"}</p>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">Email:</span>
                <p className="font-semibold text-foreground print:text-black truncate">{order.customer_email}</p>
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

          {/* Bakery / Admin Notes */}
          {order.admin_notes && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 print:bg-neutral-50 print:border-black p-4 space-y-1.5">
              <h4 className="text-xs uppercase tracking-wider font-bold text-amber-900 dark:text-amber-300 print:text-black flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-700 print:text-black" />
                Kitchen Notes & Pricing Guidance
              </h4>
              <p className="text-xs text-foreground/90 print:text-black leading-relaxed whitespace-pre-wrap font-medium">
                {order.admin_notes}
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

          {/* Kitchen Sign-off Footer */}
          <div className="pt-6 border-t-2 border-dashed border-black/50 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">Baker Sign-off:</span>
              <div className="mt-4 border-b border-black w-32" />
            </div>
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">Decorator Sign-off:</span>
              <div className="mt-4 border-b border-black w-32" />
            </div>
            <div>
              <span className="text-muted-foreground print:text-black font-semibold">Ready for Dispatch:</span>
              <div className="mt-4 border-b border-black w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
