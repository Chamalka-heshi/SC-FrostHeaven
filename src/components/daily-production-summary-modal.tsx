import React from "react";
import { Button } from "@/components/ui/button";
import {
  Printer,
  X,
  Calendar,
  ChefHat,
  PackageCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import type { KitchenOrder } from "@/components/kitchen-production-view";

interface DailyProductionSummaryModalProps {
  orders: KitchenOrder[];
  selectedDate?: string;
  onClose: () => void;
}

export function DailyProductionSummaryModal({
  orders,
  selectedDate,
  onClose,
}: DailyProductionSummaryModalProps) {
  const displayDate = selectedDate || new Date().toISOString().split("T")[0] || "";

  const formattedDate = (() => {
    try {
      const d = new Date(displayDate);
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch {
      return displayDate;
    }
  })();

  // Filter orders relevant for this date or active in kitchen
  const dayOrders = orders.filter((o) => {
    const s = o.status.toLowerCase();
    if (s === "completed" || s === "declined" || s === "cancelled") return false;
    return (
      o.event_date === displayDate ||
      s === "in_baking" ||
      (s === "accepted" && o.event_date <= displayDate)
    );
  });

  const inBakingCount = dayOrders.filter((o) => o.status.toLowerCase() === "in_baking").length;
  const readyCount = dayOrders.filter((o) => o.status.toLowerCase() === "ready").length;
  const acceptedCount = dayOrders.filter((o) => o.status.toLowerCase() === "accepted").length;
  const totalCount = dayOrders.length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-card shadow-2xl border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
        {/* Header - Screen only controls */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Daily Kitchen Production Summary
              </h3>
              <p className="text-xs text-muted-foreground">
                Printable operational run sheet for kitchen staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="rounded-full gap-1.5 bg-primary text-primary-foreground shadow-xs cursor-pointer hover:bg-primary/90"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Summary</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Production Sheet Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-0 print:overflow-visible text-foreground">
          {/* Bakery Header & Branding */}
          <div className="border-b-2 border-primary/40 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-primary font-mono">
                SC FROST HEAVEN BAKERY
              </span>
              <h1 className="text-2xl font-bold text-foreground">
                Daily Kitchen Production Summary
              </h1>
            </div>
            <div className="text-left sm:text-right text-xs text-muted-foreground font-mono">
              <div className="font-semibold text-foreground flex items-center sm:justify-end gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{formattedDate}</span>
              </div>
              <p className="mt-0.5">
                Generated:{" "}
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border p-3.5 bg-secondary/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Active
              </span>
              <div className="text-2xl font-bold text-foreground mt-0.5">{totalCount}</div>
            </div>

            <div className="rounded-2xl border border-purple-500/30 p-3.5 bg-purple-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                In Baking
              </span>
              <div className="text-2xl font-bold text-purple-700 mt-0.5">{inBakingCount}</div>
            </div>

            <div className="rounded-2xl border border-teal-500/30 p-3.5 bg-teal-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                Ready
              </span>
              <div className="text-2xl font-bold text-teal-700 mt-0.5">{readyCount}</div>
            </div>

            <div className="rounded-2xl border border-blue-500/30 p-3.5 bg-blue-500/5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Accepted (Pending)
              </span>
              <div className="text-2xl font-bold text-blue-700 mt-0.5">{acceptedCount}</div>
            </div>
          </div>

          {/* Operational Orders Table */}
          {dayOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
              No active cake orders scheduled for {formattedDate}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/40 text-foreground font-semibold">
                    <th className="py-3 px-3">#ID</th>
                    <th className="py-3 px-3">Customer & Contact</th>
                    <th className="py-3 px-3">Celebration</th>
                    <th className="py-3 px-3">Event Date</th>
                    <th className="py-3 px-3 w-1/3">Cake Details & Specs</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {dayOrders.map((order) => {
                    const shortId = order.id.slice(0, 8).toUpperCase();
                    const isBaking = order.status.toLowerCase() === "in_baking";
                    const isReady = order.status.toLowerCase() === "ready";

                    return (
                      <tr key={order.id} className="hover:bg-muted/20">
                        <td className="py-3 px-3 font-mono font-bold text-primary align-top">
                          #{shortId}
                        </td>
                        <td className="py-3 px-3 align-top font-medium">
                          <div className="text-foreground font-semibold">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                              {order.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top font-medium text-foreground">
                          {order.event_type}
                        </td>
                        <td className="py-3 px-3 align-top font-mono text-muted-foreground whitespace-nowrap">
                          {order.event_date}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <p className="text-foreground leading-relaxed">{order.cake_details}</p>
                          {order.admin_notes && (
                            <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                              Note: {order.admin_notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isBaking
                                ? "bg-purple-100 text-purple-800"
                                : isReady
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {order.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Note */}
          <div className="border-t border-border pt-4 text-[10px] text-muted-foreground flex justify-between items-center">
            <span>SC Frost Heaven Pastry Operations — Confidential Kitchen Schedule</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
