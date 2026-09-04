import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  ExternalLink,
  X,
  Loader2,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Shield,
  ShoppingBag,
  UserCheck,
  UserX,
  UserPlus,
  ArrowRight,
  ChefHat,
  BadgePercent,
  XCircle,
  Inbox,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customer Directory — SC Frost Heaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminCustomersPage,
});

interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  role: "customer" | "admin";
  created_at: string;
  updated_at?: string;
}

interface CustomOrder {
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

interface EnrichedCustomer extends CustomerProfile {
  orders: CustomOrder[];
  ordersCount: number;
  latestOrder: CustomOrder | null;
}

const ALL_STATUSES = [
  { key: "submitted", label: "Submitted", color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { key: "under_review", label: "Under Review", color: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { key: "quoted", label: "Quoted", color: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  { key: "accepted", label: "Accepted", color: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { key: "in_baking", label: "In Baking", color: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { key: "ready", label: "Ready", color: "bg-teal-500", text: "text-teal-700", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  { key: "completed", label: "Completed", color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { key: "declined", label: "Declined", color: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { key: "cancelled", label: "Cancelled", color: "bg-zinc-500", text: "text-zinc-700", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
] as const;

function AdminCustomersPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "with_orders" | "without_orders">("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortOption, setSortOption] = useState<
    "joined_desc" | "joined_asc" | "name_asc" | "name_desc" | "orders_desc" | "orders_asc"
  >("joined_desc");

  // Selected Customer Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<EnrichedCustomer | null>(null);

  // 1. Admin Role Security Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (profile && profile.role !== "admin") {
        toast.error("Access restricted: Administrator privileges required.");
        navigate({ to: "/account" });
      }
    }
  }, [authLoading, user, profile, navigate]);

  // 2. Fetch Customers & Custom Orders in parallel
  const fetchCustomerData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoadingData(true);
    setErrorMessage(null);

    try {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, address, city, role, created_at, updated_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("custom_orders")
          .select(
            "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setCustomers((profilesRes.data as CustomerProfile[]) || []);
      setOrders((ordersRes.data as CustomOrder[]) || []);
      setLastUpdated(new Date());

      if (isManual) {
        toast.success("Customer directory refreshed.");
      }
    } catch (err: any) {
      console.error("Customer data fetch error:", err);
      setErrorMessage(err.message || "Unable to load customer directory.");
      toast.error("Could not fetch customer data from Supabase.");
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchCustomerData();
    }
  }, [profile, fetchCustomerData]);

  // 3. Enrich Profiles with their corresponding orders
  const enrichedCustomers: EnrichedCustomer[] = useMemo(() => {
    return customers.map((c) => {
      const customerOrders = orders.filter((o) => o.customer_id === c.id);
      const latestOrder = customerOrders.length > 0 ? customerOrders[0] : null;
      return {
        ...c,
        orders: customerOrders,
        ordersCount: customerOrders.length,
        latestOrder,
      };
    });
  }, [customers, orders]);

  // 4. Extract Unique Cities for Filter Dropdown
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city.trim()) {
        set.add(c.city.trim());
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  // 5. Calculate Real Operational Metrics
  const metrics = useMemo(() => {
    const total = enrichedCustomers.length;
    const withOrders = enrichedCustomers.filter((c) => c.ordersCount > 0).length;
    const withoutOrders = enrichedCustomers.filter((c) => c.ordersCount === 0).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newLast30Days = enrichedCustomers.filter((c) => {
      if (!c.created_at) return false;
      return new Date(c.created_at) >= thirtyDaysAgo;
    }).length;

    return { total, withOrders, withoutOrders, newLast30Days };
  }, [enrichedCustomers]);

  // 6. Real-time Search, Filter & Sorting Logic
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers
      .filter((customer) => {
        // Search Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const nameMatch = (customer.full_name || "").toLowerCase().includes(query);
          const emailMatch = (customer.email || "").toLowerCase().includes(query);
          const phoneMatch = (customer.phone || "").toLowerCase().includes(query);
          const cityMatch = (customer.city || "").toLowerCase().includes(query);

          if (!nameMatch && !emailMatch && !phoneMatch && !cityMatch) {
            return false;
          }
        }

        // Engagement Filter
        if (orderFilter === "with_orders" && customer.ordersCount === 0) return false;
        if (orderFilter === "without_orders" && customer.ordersCount > 0) return false;

        // City Filter
        if (cityFilter !== "all") {
          if (!customer.city || customer.city.toLowerCase() !== cityFilter.toLowerCase()) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "joined_desc") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "joined_asc") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortOption === "name_asc") {
          const nameA = a.full_name || a.email || "";
          const nameB = b.full_name || b.email || "";
          return nameA.localeCompare(nameB);
        }
        if (sortOption === "name_desc") {
          const nameA = a.full_name || a.email || "";
          const nameB = b.full_name || b.email || "";
          return nameB.localeCompare(nameA);
        }
        if (sortOption === "orders_desc") {
          if (b.ordersCount !== a.ordersCount) return b.ordersCount - a.ordersCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "orders_asc") {
          if (a.ordersCount !== b.ordersCount) return a.ordersCount - b.ordersCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [enrichedCustomers, searchQuery, orderFilter, cityFilter, sortOption]);

  // Helper: Status badge renderer
  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Submitted
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-500/20">
            <Clock className="h-3 w-3" />
            Under Review
          </span>
        );
      case "quoted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-500/20">
            <BadgePercent className="h-3 w-3" />
            Quoted
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case "in_baking":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-500/20">
            <ChefHat className="h-3 w-3" />
            In Baking
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-500/20">
            Ready
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Declined
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-zinc-700 border border-zinc-500/20">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border">
            {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        );
    }
  };

  // Helper: Date formatters
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Not specified";
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

  // Helper: Initials Generator
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "CU";
  };

  if (authLoading || !user || !profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-soft border border-border/70 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-primary shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">Customers</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage customer accounts, contact details, and order history.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground">
              Last updated:{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => fetchCustomerData(true)}
            disabled={isRefreshing}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="rounded-3xl bg-destructive/10 p-6 text-center shadow-soft border border-destructive/20 space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-sm font-medium text-destructive">Unable to load customer directory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCustomerData()}
            className="rounded-full border-destructive/30 text-destructive cursor-pointer"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* 2. Key Customer Metrics (4 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total Customers</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.total}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Registered accounts</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
            <Users className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Customers With Orders */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">With Orders</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.withOrders}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Placed ≥ 1 custom order</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Customers Without Orders */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Without Orders</span>
            <p className="text-2xl font-bold text-muted-foreground mt-1">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.withoutOrders}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Zero custom orders</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <UserX className="h-5 w-5" />
          </div>
        </div>

        {/* New Customers (Last 30 Days) */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">New (Last 30 Days)</span>
            <p className="text-2xl font-bold text-primary mt-1">
              {loadingData ? <span className="text-muted-foreground animate-pulse">...</span> : metrics.newLast30Days}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Recent account signups</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Search, Filter & Sorting Bar */}
      <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/60 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, email, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-2xl pl-10 bg-secondary/20 border-border/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Engagement Filter */}
          <div>
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value as any)}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Engagement ({enrichedCustomers.length})</option>
              <option value="with_orders">With Orders ({metrics.withOrders})</option>
              <option value="without_orders">Without Orders ({metrics.withoutOrders})</option>
            </select>
          </div>

          {/* City Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Cities ({availableCities.length > 0 ? "Filtered" : "All"})</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sorting Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Showing {filteredCustomers.length} of {enrichedCustomers.length} customers
          </span>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort By:
            </span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="rounded-xl border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="joined_desc">Joined Date (Newest First)</option>
              <option value="joined_asc">Joined Date (Oldest First)</option>
              <option value="name_asc">Customer Name (A to Z)</option>
              <option value="name_desc">Customer Name (Z to A)</option>
              <option value="orders_desc">Most Orders First</option>
              <option value="orders_asc">Fewest Orders First</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Customer Directory (Desktop Table & Mobile Cards) */}
      <div className="space-y-4">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-20 shadow-soft border border-border/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading customer directory from Supabase...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Inbox className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">
                {searchQuery || orderFilter !== "all" || cityFilter !== "all"
                  ? "No customers match your current filters"
                  : "No registered customers yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || orderFilter !== "all" || cityFilter !== "all"
                  ? "Try adjusting your search terms or filter selection to view more customer profiles."
                  : "Customer accounts will appear here as users register on SC FrostHeaven."}
              </p>
            </div>
            {(searchQuery || orderFilter !== "all" || cityFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setOrderFilter("all");
                  setCityFilter("all");
                }}
                className="rounded-full text-xs cursor-pointer"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* DESKTOP DATA TABLE */}
            <div className="hidden lg:block overflow-hidden rounded-3xl bg-card shadow-soft border border-border/70">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-4 pl-6 pr-3">Customer</th>
                    <th className="py-4 px-3">Email</th>
                    <th className="py-4 px-3">Phone</th>
                    <th className="py-4 px-3">City</th>
                    <th className="py-4 px-3">Orders</th>
                    <th className="py-4 px-3">Latest Order</th>
                    <th className="py-4 px-3">Joined</th>
                    <th className="py-4 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {filteredCustomers.map((customer) => {
                    const initials = getInitials(customer.full_name, customer.email);
                    return (
                      <tr
                        key={customer.id}
                        className="group transition-colors hover:bg-secondary/20"
                      >
                        {/* Customer Column */}
                        <td className="py-4 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {customer.full_name || "Unnamed Customer"}
                                </span>
                                {customer.role === "admin" && (
                                  <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.2 text-[10px] font-semibold text-primary">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="py-4 px-3 text-xs">
                          {customer.email ? (
                            <a
                              href={`mailto:${customer.email}`}
                              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[170px]">{customer.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Phone Column */}
                        <td className="py-4 px-3 text-xs">
                          {customer.phone ? (
                            <a
                              href={`tel:${customer.phone}`}
                              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{customer.phone}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">Not provided</span>
                          )}
                        </td>

                        {/* City Column */}
                        <td className="py-4 px-3 text-xs">
                          {customer.city ? (
                            <span className="flex items-center gap-1 text-foreground">
                              <MapPin className="h-3 w-3 text-primary" />
                              {customer.city}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">Not provided</span>
                          )}
                        </td>

                        {/* Orders Count Column */}
                        <td className="py-4 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              customer.ordersCount > 0
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <ShoppingBag className="h-3 w-3" />
                            {customer.ordersCount} {customer.ordersCount === 1 ? "order" : "orders"}
                          </span>
                        </td>

                        {/* Latest Order Column */}
                        <td className="py-4 px-3 text-xs text-muted-foreground">
                          {customer.latestOrder ? (
                            <div>
                              <p className="font-medium text-foreground">
                                {formatDate(customer.latestOrder.created_at)}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {customer.latestOrder.event_type}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">No orders</span>
                          )}
                        </td>

                        {/* Joined Column */}
                        <td className="py-4 px-3 text-xs text-muted-foreground">
                          {formatDate(customer.created_at)}
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 pl-3 pr-6 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedCustomer(customer)}
                            className="rounded-full text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          >
                            <span>View Details</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE RESPONSIVE CUSTOMER CARDS */}
            <div className="grid gap-4 lg:hidden">
              {filteredCustomers.map((customer) => {
                const initials = getInitials(customer.full_name, customer.email);
                return (
                  <div
                    key={customer.id}
                    className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 space-y-3.5"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-medium text-foreground text-sm">
                              {customer.full_name || "Unnamed Customer"}
                            </h3>
                            {customer.role === "admin" && (
                              <span className="rounded-full bg-primary/15 border border-primary/25 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {customer.email}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          customer.ordersCount > 0
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {customer.ordersCount} {customer.ordersCount === 1 ? "order" : "orders"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs rounded-2xl bg-secondary/30 p-3">
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium text-foreground">{customer.phone || "Not provided"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">City:</span>
                        <p className="font-medium text-foreground">{customer.city || "Not provided"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        Joined: {formatDate(customer.created_at)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setSelectedCustomer(customer)}
                        className="rounded-full text-xs cursor-pointer"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. Comprehensive Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                  {getInitials(selectedCustomer.full_name, selectedCustomer.email)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-foreground">
                      {selectedCustomer.full_name || "Unnamed Customer"}
                    </h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground uppercase">
                      {selectedCustomer.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">
              {/* SECTION 1: CUSTOMER PROFILE DETAILS */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Account & Contact Information
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-secondary/20 p-4 border border-border/50 text-xs">
                  <div>
                    <span className="text-muted-foreground">Full Name:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {selectedCustomer.full_name || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email Address:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {selectedCustomer.email ? (
                        <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">
                          {selectedCustomer.email}
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone Number:</span>
                    <p className="font-medium text-foreground mt-0.5">
                      {selectedCustomer.phone ? (
                        <a href={`tel:${selectedCustomer.phone}`} className="hover:text-primary">
                          {selectedCustomer.phone}
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">City:</span>
                    <p className="font-medium text-foreground mt-0.5">
                      {selectedCustomer.city || "Not provided"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Delivery Address:</span>
                    <p className="font-medium text-foreground mt-0.5">
                      {selectedCustomer.address || "Address not provided"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Joined Date:</span>
                    <p className="font-medium text-muted-foreground mt-0.5">
                      {formatDate(selectedCustomer.created_at)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Profile Update:</span>
                    <p className="font-medium text-muted-foreground mt-0.5">
                      {formatDate(selectedCustomer.updated_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER ORDER STATUS BREAKDOWN */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    Order Status Summary ({selectedCustomer.ordersCount} Total)
                  </h3>
                  <Link
                    to="/admin/orders"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Open Order Manager</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                  {ALL_STATUSES.map((st) => {
                    const count = selectedCustomer.orders.filter((o) => o.status === st.key).length;
                    return (
                      <div
                        key={st.key}
                        className={`rounded-2xl p-2.5 border ${st.bg} ${st.border} text-center flex flex-col justify-between`}
                      >
                        <span className="text-[10px] font-medium text-foreground truncate block">
                          {st.label}
                        </span>
                        <span className={`text-base font-bold mt-1 ${st.text}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: CUSTOMER ORDER HISTORY */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Custom Cake Orders ({selectedCustomer.orders.length})
                </h3>

                {selectedCustomer.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground space-y-1">
                    <ShoppingBag className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                    <p className="font-medium text-foreground">No custom orders yet.</p>
                    <p className="text-[11px]">This customer has not placed any custom cake orders.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCustomer.orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">
                              #{order.id.slice(0, 8)}
                            </span>
                            <span className="font-medium text-xs text-foreground">• {order.event_type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(order.status)}
                            <Link
                              to="/admin/orders"
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <span>Manage</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span>Event Date:</span>
                            <p className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3 text-primary" />
                              {formatDate(order.event_date)}
                            </p>
                          </div>
                          <div>
                            <span>Submitted:</span>
                            <p className="font-medium text-foreground mt-0.5">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                        </div>

                        {order.cake_details && (
                          <div className="rounded-xl bg-background p-3 text-xs text-foreground leading-relaxed border border-border/50">
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                              Cake Vision & Specifications:
                            </span>
                            <p className="line-clamp-3">{order.cake_details}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-card">
              <span className="text-xs text-muted-foreground">
                Customer ID: <span className="font-mono text-foreground">{selectedCustomer.id.slice(0, 8)}...</span>
              </span>
              <Button
                variant="outline"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full text-xs cursor-pointer"
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
