import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Database,
  ShieldCheck,
  Lock,
  Cake,
  MessageSquare,
  Star,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardIndex,
});

function AdminDashboardIndex() {
  const { user, profile } = useAuth();
  const adminName = profile?.full_name || user?.email?.split("@")[0] || "Administrator";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-card p-6 shadow-soft sm:p-8 border border-border/70">
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3.5 py-1 text-xs font-semibold text-blush-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 3A: Core Administration Ready
          </span>
          <h1 className="text-2xl font-medium text-foreground sm:text-4xl">
            Welcome back, {adminName}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage FrostHeaven Bakery operations from your administrator dashboard.
          </p>
        </div>
      </div>

      {/* 4 System Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: System Status */}
        <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">System Status</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-semibold text-foreground">Operational</p>
            </div>
          </div>
        </div>

        {/* Card 2: Supabase Connection */}
        <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Supabase</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-sm font-semibold text-foreground">Connected</p>
            </div>
          </div>
        </div>

        {/* Card 3: Authentication */}
        <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Authentication</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-sm font-semibold text-foreground">Active</p>
            </div>
          </div>
        </div>

        {/* Card 4: RLS Security */}
        <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">RLS Security</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <p className="text-sm font-semibold text-foreground">Enabled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Modules Navigation Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Management Modules</h2>
          <span className="text-xs text-muted-foreground">SC Frost Heaven Admin Suite</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Custom Orders Module */}
          <Link
            to="/admin/orders"
            className="group flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/60 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blush text-primary">
                <Cake className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                  Custom Orders
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Review custom cake submissions, inspect reference photos, and update workflow status.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary pt-2 border-t border-border/40">
              <span>Manage Orders</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Inquiries Module */}
          <Link
            to="/admin/inquiries"
            className="group flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/60 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                  Contact Inquiries
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Triage customer contact requests, consultation inquiries, and special requests.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary pt-2 border-t border-border/40">
              <span>View Inquiries</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Reviews Module */}
          <Link
            to="/admin/reviews"
            className="group flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/60 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                <Star className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                  Customer Reviews
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Moderate customer testimonials, approve feedback, and feature high-rating reviews.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary pt-2 border-t border-border/40">
              <span>Moderate Reviews</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Customers Module */}
          <Link
            to="/admin/customers"
            className="group flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/60 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                  Customer Directory
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Browse registered customers, contact information, and customer order histories.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary pt-2 border-t border-border/40">
              <span>View Customers</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
