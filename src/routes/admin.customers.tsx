import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customer Directory — FrostHeaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminCustomersPlaceholder,
});

function AdminCustomersPlaceholder() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-medium text-foreground">Customer Directory</h1>
          <p className="text-xs text-muted-foreground">
            Browse registered customer accounts, contact details, and account histories
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 shadow-xs">
          <Users className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-0.5 text-xs font-semibold text-teal-700">
            <Clock className="h-3 w-3" />
            Phase 3D Module
          </span>
          <h2 className="text-xl font-medium text-foreground">
            Customer Directory Coming in Phase 3D
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This module will allow staff to view customer contact records, order totals, and customer celebration notes.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/admin">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
