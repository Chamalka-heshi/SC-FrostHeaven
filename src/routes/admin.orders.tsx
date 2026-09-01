import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Cake,
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
  ImageIcon,
  ExternalLink,
  Copy,
  Check,
  X,
  Loader2,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Inbox,
  ChefHat,
  BadgePercent,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Custom Orders Management — FrostHeaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOrdersPage,
});

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

interface OrderImage {
  id: string;
  order_id: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  created_at?: string;
  signedUrl?: string | null;
}

const ORDER_STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "quoted", label: "Quoted" },
  { value: "accepted", label: "Accepted" },
  { value: "in_baking", label: "In Baking" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const WORKFLOW_STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "in_baking", label: "In Baking" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
] as const;

function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "past">("all");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "date_asc" | "date_desc">("newest");

  // Selected Order Modal state
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [adminNotesText, setAdminNotesText] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

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

  // 2. Fetch All Custom Orders from Supabase
  const fetchOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoadingOrders(true);
    setOrdersError(null);

    try {
      const { data, error } = await supabase
        .from("custom_orders")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      if (isManualRefresh) {
        toast.success("Custom orders refreshed.");
      }
    } catch (err: any) {
      console.error("Error fetching admin custom orders:", err);
      setOrdersError(err.message || "Failed to load custom orders.");
      toast.error("Could not fetch orders from Supabase.");
    } finally {
      setLoadingOrders(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchOrders();
    }
  }, [profile, fetchOrders]);

  // 3. Dynamic Event Types Extracted from Real Orders
  const availableEventTypes = useMemo(() => {
    const types = new Set<string>();
    orders.forEach((o) => {
      if (o.event_type) types.add(o.event_type.trim());
    });
    return Array.from(types).sort();
  }, [orders]);

  // 4. Real Metrics Counts (Calculated dynamically from real enum values)
  const metrics = useMemo(() => {
    const total = orders.length;
    const submitted = orders.filter((o) => o.status === "submitted").length;
    const accepted = orders.filter((o) => o.status === "accepted").length;
    const inBaking = orders.filter((o) => o.status === "in_baking").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const underReview = orders.filter((o) => o.status === "under_review").length;
    const quoted = orders.filter((o) => o.status === "quoted").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const declined = orders.filter((o) => o.status === "declined").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    return {
      total,
      submitted,
      accepted,
      inBaking,
      completed,
      underReview,
      quoted,
      ready,
      declined,
      cancelled,
    };
  }, [orders]);

  // 5. Client-Side Real-Time Filter & Search
  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders
      .filter((order) => {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const shortId = order.id.toLowerCase().slice(0, 8);
          const nameMatch = order.customer_name.toLowerCase().includes(query);
          const emailMatch = order.customer_email.toLowerCase().includes(query);
          const eventMatch = order.event_type.toLowerCase().includes(query);
          const idMatch = order.id.toLowerCase().includes(query) || shortId.includes(query.replace(/^#/, ""));

          if (!nameMatch && !emailMatch && !eventMatch && !idMatch) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }

        // Event Type filter
        if (eventTypeFilter !== "all" && order.event_type.toLowerCase() !== eventTypeFilter.toLowerCase()) {
          return false;
        }

        // Date filter
        if (dateFilter !== "all") {
          const eventDate = new Date(order.event_date);
          if (dateFilter === "upcoming" && eventDate < today) return false;
          if (dateFilter === "past" && eventDate >= today) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortOption === "date_asc") {
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        }
        if (sortOption === "date_desc") {
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        }
        return 0;
      });
  }, [orders, searchQuery, statusFilter, eventTypeFilter, dateFilter, sortOption]);

  // 6. Order Details & Reference Image Loader
  const handleOpenOrderDetails = async (order: CustomOrder) => {
    setSelectedOrder(order);
    setAdminNotesText(order.admin_notes || "");
    setOrderImages([]);
    setCustomerAddress(null);
    setLoadingImages(true);

    try {
      // 1. Fetch customer profile address if customer_id exists
      if (order.customer_id) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, address, city")
          .eq("id", order.customer_id)
          .maybeSingle();

        if (profData) {
          const addr = [profData.address, profData.city].filter(Boolean).join(", ");
          setCustomerAddress(addr || "Address not provided");
        } else {
          setCustomerAddress("Address not provided");
        }
      } else {
        setCustomerAddress("Guest Order (No saved profile address)");
      }

      // 2. Fetch reference images & generate signed URLs from private 'cake-references' bucket
      const { data: imagesData, error: imagesError } = await supabase
        .from("custom_order_images")
        .select("id, order_id, storage_path, file_name, file_size_bytes, created_at")
        .eq("order_id", order.id);

      if (imagesError) throw imagesError;

      if (imagesData && imagesData.length > 0) {
        const signedImages = await Promise.all(
          imagesData.map(async (img) => {
            const { data: signedData, error: signedError } = await supabase.storage
              .from("cake-references")
              .createSignedUrl(img.storage_path, 3600); // 1 hour expiration

            if (signedError) {
              console.warn(`Could not generate signed URL for ${img.file_name}:`, signedError);
              return { ...img, signedUrl: null };
            }
            return { ...img, signedUrl: signedData?.signedUrl ?? null };
          })
        );
        setOrderImages(signedImages);
      }
    } catch (err: any) {
      console.error("Error loading order images/profile:", err);
      toast.error("Failed to load reference photos.");
    } finally {
      setLoadingImages(false);
    }
  };

  // 7. Update Order Status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedOrder || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    try {
      const { error } = await supabase
        .from("custom_orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      // Update state locally
      const updatedOrder = { ...selectedOrder, status: newStatus, updated_at: new Date().toISOString() };
      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));

      const label = ORDER_STATUSES.find((s) => s.value === newStatus)?.label || newStatus;
      toast.success(`Order status updated to ${label}`);
    } catch (err: any) {
      console.error("Status update error:", err);
      toast.error(err.message || "Failed to update order status. Check permissions.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 8. Save Administrator Notes
  const handleSaveNotes = async () => {
    if (!selectedOrder || isSavingNotes) return;
    setIsSavingNotes(true);

    try {
      const trimmed = adminNotesText.trim();
      const { error } = await supabase
        .from("custom_orders")
        .update({
          admin_notes: trimmed || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updatedOrder = { ...selectedOrder, admin_notes: trimmed || null, updated_at: new Date().toISOString() };
      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));

      toast.success("Admin notes saved successfully.");
    } catch (err: any) {
      console.error("Admin notes save error:", err);
      toast.error(err.message || "Failed to save admin notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Helper: Copy Order UUID to clipboard
  const handleCopyUUID = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedId(true);
    toast.success("Full Order UUID copied to clipboard!");
    setTimeout(() => setCopiedId(false), 2000);
  };

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

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">Custom Orders</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage customer cake requests, workflow status, references, and notes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Orders"}</span>
          </Button>
        </div>
      </div>

      {/* 2. Order Metric Summary Cards (Live real data) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total Orders</span>
            <p className="text-2xl font-bold text-foreground mt-1">{metrics.total}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
            <Cake className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Submitted */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Submitted</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.submitted}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {/* Accepted */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Accepted</span>
            <p className="text-2xl font-bold text-blue-700 mt-1">{metrics.accepted}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* In Baking */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">In Baking</span>
            <p className="text-2xl font-bold text-purple-700 mt-1">{metrics.inBaking}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
            <ChefHat className="h-5 w-5" />
          </div>
        </div>

        {/* Completed */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.completed}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Search, Filters & Sorting Bar */}
      <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/60 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, email, #order ID, event..."
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

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Statuses ({orders.length})</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Event Types</option>
              {availableEventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter & Sorting Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <Filter className="h-3.5 w-3.5" /> Date:
            </span>
            <div className="flex rounded-full bg-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setDateFilter("all")}
                className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                  dateFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Dates
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("upcoming")}
                className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                  dateFilter === "upcoming" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("past")}
                className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                  dateFilter === "past" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Past
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
            </span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="rounded-xl border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="newest">Newest Orders First</option>
              <option value="oldest">Oldest Orders First</option>
              <option value="date_asc">Event Date (Soonest First)</option>
              <option value="date_desc">Event Date (Furthest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Orders List (Desktop Table & Mobile Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Showing {filteredOrders.length} of {orders.length} custom orders
          </span>
        </div>

        {loadingOrders ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-20 shadow-soft border border-border/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading custom cake orders from Supabase...</p>
          </div>
        ) : ordersError ? (
          <div className="rounded-3xl bg-destructive/10 p-8 text-center shadow-soft border border-destructive/20">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-medium text-destructive">{ordersError}</p>
            <Button
              variant="outline"
              onClick={() => fetchOrders()}
              className="mt-4 rounded-full border-destructive/30 text-destructive cursor-pointer"
            >
              Try Again
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Inbox className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">
                {searchQuery || statusFilter !== "all" || eventTypeFilter !== "all" || dateFilter !== "all"
                  ? "No matching orders found"
                  : "No custom orders yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || eventTypeFilter !== "all" || dateFilter !== "all"
                  ? "Try resetting your search query or filter settings to view more orders."
                  : "Customer custom cake requests will appear here once submitted."}
              </p>
            </div>
            {(searchQuery || statusFilter !== "all" || eventTypeFilter !== "all" || dateFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setEventTypeFilter("all");
                  setDateFilter("all");
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
                    <th className="py-4 pl-6 pr-3">Order</th>
                    <th className="py-4 px-3">Customer</th>
                    <th className="py-4 px-3">Event</th>
                    <th className="py-4 px-3">Event Date</th>
                    <th className="py-4 px-3">Submitted</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 pl-3 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="group transition-colors hover:bg-secondary/20"
                    >
                      <td className="py-4 pl-6 pr-3 font-mono text-xs font-semibold text-foreground">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-medium text-foreground">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {order.customer_email}
                        </div>
                      </td>
                      <td className="py-4 px-3 font-medium text-foreground">
                        {order.event_type}
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {formatDate(order.event_date)}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-4 px-3">
                        {renderStatusBadge(order.status)}
                      </td>
                      <td className="py-4 pl-3 pr-6 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenOrderDetails(order)}
                          className="rounded-full text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          <span>View Details</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE RESPONSIVE ORDER CARDS */}
            <div className="grid gap-4 lg:hidden">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      #{order.id.slice(0, 8)}
                    </span>
                    {renderStatusBadge(order.status)}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-medium text-foreground text-base">
                      {order.customer_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                    {order.customer_phone && (
                      <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs rounded-2xl bg-secondary/30 p-3">
                    <div>
                      <span className="text-muted-foreground">Event:</span>
                      <p className="font-medium text-foreground">{order.event_type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Event Date:</span>
                      <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3 text-primary" />
                        {formatDate(order.event_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Requested: {formatDate(order.created_at)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleOpenOrderDetails(order)}
                      className="rounded-full text-xs cursor-pointer"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 5. Comprehensive Order Details Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-foreground">
                    #{selectedOrder.id.slice(0, 8)}
                  </span>
                  {renderStatusBadge(selectedOrder.status)}
                  <button
                    type="button"
                    onClick={() => handleCopyUUID(selectedOrder.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                    title="Copy Full UUID"
                  >
                    {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId ? "Copied" : "Copy UUID"}</span>
                  </button>
                </div>
                <h2 className="text-lg font-medium text-foreground">
                  {selectedOrder.event_type} Custom Cake Request
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">
              {/* STATUS TRANSITION CONTROLLER */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Manage Workflow Status
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Advance or adjust the progress stage of this cake order
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedOrder.status}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="rounded-xl border border-primary/30 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st.value} value={st.value}>
                          Set Status: {st.label}
                        </option>
                      ))}
                    </select>
                    {isUpdatingStatus && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                </div>

                {/* Visual Workflow Timeline */}
                <div className="pt-3 border-t border-primary/15">
                  <div className="text-[11px] font-medium text-muted-foreground mb-3">
                    Progress Timeline
                  </div>

                  {selectedOrder.status === "cancelled" ? (
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-500/10 p-3 text-xs font-medium text-zinc-700">
                      <AlertCircle className="h-4 w-4" />
                      <span>This custom order has been marked as Cancelled.</span>
                    </div>
                  ) : selectedOrder.status === "declined" ? (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-medium text-rose-700">
                      <XCircle className="h-4 w-4" />
                      <span>This custom order has been marked as Declined.</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between relative">
                      {WORKFLOW_STAGES.map((stage, idx) => {
                        const currentIndex = WORKFLOW_STAGES.findIndex((s) => s.key === selectedOrder.status);
                        const isPastOrCurrent = idx <= (currentIndex !== -1 ? currentIndex : 0);
                        const isCurrent = stage.key === selectedOrder.status;

                        return (
                          <div key={stage.key} className="flex flex-col items-center flex-1 relative">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold z-10 transition-colors ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                  : isPastOrCurrent
                                  ? "bg-primary/80 text-primary-foreground"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <span
                              className={`text-[9px] sm:text-[10px] text-center mt-1.5 font-medium truncate max-w-[60px] sm:max-w-none ${
                                isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                              }`}
                            >
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* CUSTOMER & EVENT METADATA GRID */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Customer Information */}
                <div className="rounded-2xl bg-secondary/20 p-4 space-y-3 border border-border/50">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Customer Details
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-sm font-semibold text-foreground">{selectedOrder.customer_name}</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${selectedOrder.customer_email}`} className="hover:text-primary transition-colors">
                        {selectedOrder.customer_email}
                      </a>
                    </p>
                    {selectedOrder.customer_phone && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <a href={`tel:${selectedOrder.customer_phone}`} className="hover:text-primary transition-colors">
                          {selectedOrder.customer_phone}
                        </a>
                      </p>
                    )}
                    <p className="flex items-start gap-1.5 text-muted-foreground pt-1 border-t border-border/30">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span>{customerAddress || "Address not provided"}</span>
                    </p>
                  </div>
                </div>

                {/* Event Information */}
                <div className="rounded-2xl bg-secondary/20 p-4 space-y-3 border border-border/50">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Event & Scheduling
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Event Type:</span>
                      <p className="font-semibold text-foreground text-sm">{selectedOrder.event_type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scheduled Date:</span>
                      <p className="font-semibold text-primary text-sm flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(selectedOrder.event_date)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/30">
                      <span>Submitted: {formatDate(selectedOrder.created_at)}</span>
                      {selectedOrder.updated_at && (
                        <span>Updated: {formatDate(selectedOrder.updated_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CAKE DETAILS & INSTRUCTIONS */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Cake Instructions & Flavor Vision
                </h4>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedOrder.cake_details}
                </div>
              </div>

              {/* ADMINISTRATOR NOTES EDITOR */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-primary" />
                      Administrator & Bakery Notes
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Record quotes, flavor recipes, custom cake dimensions, or internal bakery notes
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-full text-xs cursor-pointer"
                  >
                    {isSavingNotes ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Notes"
                    )}
                  </Button>
                </div>

                <Textarea
                  value={adminNotesText}
                  onChange={(e) => setAdminNotesText(e.target.value)}
                  placeholder="Type bakery notes, price quotes, special ingredients, or delivery coordination..."
                  rows={4}
                  className="rounded-xl bg-background border-border/70 text-xs"
                  disabled={isSavingNotes}
                />
              </div>

              {/* REFERENCE PHOTOS GALLERY (On-demand Signed URLs) */}
              <div className="space-y-3">
                <h4 className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Customer Reference & Inspiration Photos ({orderImages.length})
                  </span>
                  <span className="text-xs text-muted-foreground">Private Storage (1h Signed URLs)</span>
                </h4>

                {loadingImages ? (
                  <div className="flex items-center justify-center py-10 rounded-2xl border border-border/40 bg-secondary/10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-xs text-muted-foreground">
                      Generating secure image signed URLs...
                    </span>
                  </div>
                ) : orderImages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                    No reference photos were attached to this request.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {orderImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => img.signedUrl && setActivePreviewImage(img.signedUrl)}
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-xs cursor-pointer"
                      >
                        {img.signedUrl ? (
                          <>
                            <img
                              src={img.signedUrl}
                              alt={img.file_name}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-6 w-6 text-white drop-shadow-md" />
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-destructive">
                            Failed to generate image link
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-background/90 backdrop-blur-xs px-2 py-1 text-[10px] text-foreground truncate text-center flex items-center justify-between">
                          <span className="truncate">{img.file_name}</span>
                          <span className="text-muted-foreground ml-1 shrink-0">
                            {formatFileSize(img.file_size_bytes)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-card">
              <span className="text-xs text-muted-foreground">
                Order ID: <span className="font-mono text-foreground">#{selectedOrder.id.slice(0, 8)}</span>
              </span>
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full text-xs cursor-pointer"
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FULL-SIZE LIGHTBOX IMAGE PREVIEW */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActivePreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setActivePreviewImage(null)}
            className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={activePreviewImage}
            alt="Reference Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
