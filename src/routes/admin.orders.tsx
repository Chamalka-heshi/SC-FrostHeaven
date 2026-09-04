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
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { KitchenProductionView } from "@/components/kitchen-production-view";
import { KitchenProductionTicket } from "@/components/kitchen-production-ticket";

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

  // View Mode: Table vs Kitchen Production
  const [activeViewMode, setActiveViewMode] = useState<"table" | "kitchen">("table");

  // Search & Filter state (for Table mode)
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

  // Kitchen Quick Actions & Ticket Printing state
  const [ticketOrder, setTicketOrder] = useState<CustomOrder | null>(null);
  const [ticketImages, setTicketImages] = useState<OrderImage[]>([]);
  const [updatingKitchenOrderId, setUpdatingKitchenOrderId] = useState<string | null>(null);

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

  // 3. Derived Metrics for Admin Overview
  const metrics = useMemo(() => {
    const total = orders.length;
    const submitted = orders.filter((o) => o.status === "submitted").length;
    const underReview = orders.filter((o) => o.status === "under_review").length;
    const quoted = orders.filter((o) => o.status === "quoted").length;
    const accepted = orders.filter((o) => o.status === "accepted").length;
    const inBaking = orders.filter((o) => o.status === "in_baking").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const declined = orders.filter((o) => o.status === "declined").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    return {
      total,
      submitted,
      underReview,
      quoted,
      accepted,
      inBaking,
      ready,
      completed,
      declined,
      cancelled,
    };
  }, [orders]);

  // 4. Distinct Event Types for Filter Dropdown
  const availableEventTypes = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.event_type) set.add(o.event_type);
    });
    return Array.from(set).sort();
  }, [orders]);

  // 5. Filter & Sort Orders for Table View
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const query = searchQuery.toLowerCase().trim();

    return orders
      .filter((order) => {
        // Status filter
        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }

        // Event type filter
        if (eventTypeFilter !== "all" && order.event_type !== eventTypeFilter) {
          return false;
        }

        // Date filter
        if (dateFilter === "upcoming" && order.event_date < todayStr) {
          return false;
        }
        if (dateFilter === "past" && order.event_date >= todayStr) {
          return false;
        }

        // Search query
        if (query) {
          const nameMatch = order.customer_name?.toLowerCase().includes(query);
          const emailMatch = order.customer_email?.toLowerCase().includes(query);
          const phoneMatch = order.customer_phone?.toLowerCase().includes(query);
          const idMatch = order.id.toLowerCase().includes(query);
          const shortIdMatch = `#${order.id.slice(0, 8).toLowerCase()}`.includes(query);
          const eventMatch = order.event_type?.toLowerCase().includes(query);
          const detailsMatch = order.cake_details?.toLowerCase().includes(query);
          const notesMatch = order.admin_notes?.toLowerCase().includes(query);

          if (
            !nameMatch &&
            !emailMatch &&
            !phoneMatch &&
            !idMatch &&
            !shortIdMatch &&
            !eventMatch &&
            !detailsMatch &&
            !notesMatch
          ) {
            return false;
          }
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
              .createSignedUrl(img.storage_path, 3600);

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

      const updatedOrder = { ...selectedOrder, status: newStatus, updated_at: new Date().toISOString() };
      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));

      const label = ORDER_STATUSES.find((s) => s.value === newStatus)?.label || newStatus;
      toast.success(`Order status updated to ${label}`);
    } catch (err: any) {
      console.error("Status update error:", err);
      toast.error(err.message || "Failed to update order status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 8. Quick Kitchen Status Progression Action
  const handleQuickUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingKitchenOrderId(orderId);
    try {
      const { error } = await supabase
        .from("custom_orders")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: nextStatus, updated_at: new Date().toISOString() } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus, updated_at: new Date().toISOString() });
      }

      const label = ORDER_STATUSES.find((s) => s.value === nextStatus)?.label || nextStatus;
      toast.success(`Kitchen stage updated to ${label}`);
    } catch (err: any) {
      console.error("Quick status update error:", err);
      toast.error(err.message || "Failed to update kitchen status.");
    } finally {
      setUpdatingKitchenOrderId(null);
    }
  };

  // 9. Save Administrator Notes
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

  // 10. Open Kitchen Ticket for Printing
  const handleOpenTicket = async (order: CustomOrder) => {
    setTicketOrder(order);
    setTicketImages([]);

    try {
      const { data: imagesData } = await supabase
        .from("custom_order_images")
        .select("id, order_id, storage_path, file_name, file_size_bytes, created_at")
        .eq("order_id", order.id);

      if (imagesData && imagesData.length > 0) {
        const signedImages = await Promise.all(
          imagesData.map(async (img) => {
            const { data: signedData } = await supabase.storage
              .from("cake-references")
              .createSignedUrl(img.storage_path, 3600);
            return { ...img, signedUrl: signedData?.signedUrl ?? null };
          })
        );
        setTicketImages(signedImages);
      }
    } catch (err) {
      console.warn("Could not load ticket images:", err);
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
            <XCircle className="h-3 w-3" />
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
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  if (authLoading || (!profile && user)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Authenticating admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header Toolbar with Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-primary shadow-xs">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">Custom Orders</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage customer cake requests, kitchen production schedule, tickets, and status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle Switcher */}
          <div className="flex items-center rounded-full bg-secondary/80 p-1 border border-border/70 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveViewMode("table")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeViewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Orders Table
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode("kitchen")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeViewMode === "kitchen"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              <span>Kitchen Production</span>
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* MODE 1: KITCHEN PRODUCTION VIEW */}
      {activeViewMode === "kitchen" && (
        <KitchenProductionView
          orders={orders}
          onUpdateStatus={handleQuickUpdateStatus}
          onOpenOrder={handleOpenOrderDetails}
          onPrintTicket={handleOpenTicket}
          updatingOrderId={updatingKitchenOrderId}
        />
      )}

      {/* MODE 2: STANDARD ORDERS TABLE VIEW */}
      {activeViewMode === "table" && (
        <div className="space-y-8">
          {/* 2. Order Metric Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Total Orders</span>
                <p className="text-2xl font-bold text-foreground mt-1">{metrics.total}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                <Cake className="h-5 w-5 text-primary" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Submitted</span>
                <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.submitted}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Accepted</span>
                <p className="text-2xl font-bold text-blue-700 mt-1">{metrics.accepted}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
              <div>
                <span className="text-xs font-medium text-muted-foreground">In Baking</span>
                <p className="text-2xl font-bold text-purple-700 mt-1">{metrics.inBaking}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
                <ChefHat className="h-5 w-5" />
              </div>
            </div>

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
                      dateFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter("upcoming")}
                    className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                      dateFilter === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter("past")}
                    className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                      dateFilter === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
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
                  className="rounded-xl border border-border/60 bg-transparent px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
                >
                  <option value="newest">Order Date: Newest First</option>
                  <option value="oldest">Order Date: Oldest First</option>
                  <option value="date_asc">Event Date: Earliest First</option>
                  <option value="date_desc">Event Date: Latest First</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Orders Data Table */}
          {loadingOrders ? (
            <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-20 shadow-soft">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading custom cake orders from Supabase...</p>
            </div>
          ) : ordersError ? (
            <div className="rounded-3xl bg-destructive/10 p-8 text-center shadow-soft">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">{ordersError}</p>
              <Button variant="outline" onClick={() => fetchOrders(true)} className="mt-4 rounded-full">
                Try Again
              </Button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-3xl bg-card p-12 text-center shadow-soft space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Inbox className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No custom orders found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No orders match your active filter settings. Try clearing search keywords or resetting status filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setEventTypeFilter("all");
                  setDateFilter("all");
                }}
                className="rounded-full text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-card shadow-soft border border-border/70">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-4 px-6">Order ID</th>
                      <th className="py-4 px-6">Customer</th>
                      <th className="py-4 px-6">Event Type</th>
                      <th className="py-4 px-6">Event Date</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Created</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => handleOpenOrderDetails(order)}
                        className="group hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6 font-mono font-medium text-foreground">
                          <span className="rounded-lg bg-secondary px-2 py-1">
                            #{order.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-semibold text-foreground">{order.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">{order.customer_email}</p>
                        </td>
                        <td className="py-4 px-6 font-medium text-foreground">
                          {order.event_type}
                        </td>
                        <td className="py-4 px-6">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {formatDate(order.event_date)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {renderStatusBadge(order.status)}
                        </td>
                        <td className="py-4 px-6 text-muted-foreground">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOrderDetails(order);
                            }}
                            className="rounded-full text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SELECTED ORDER DETAILS MODAL / DRAWER */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-xl">
                  #{selectedOrder.id.slice(0, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUUID(selectedOrder.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Copy full UUID"
                >
                  {copiedId ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                {renderStatusBadge(selectedOrder.status)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenTicket(selectedOrder)}
                  className="rounded-full text-xs h-8 px-3 gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Ticket</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Order Status Workflow Progression Bar */}
              <div className="space-y-3 rounded-2xl bg-secondary/20 p-5 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Workflow Status Progression
                  </span>
                  <span className="text-xs text-muted-foreground">Select stage to transition</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {WORKFLOW_STAGES.map((st) => {
                    const isCurrent = selectedOrder.status === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleStatusChange(st.key)}
                        disabled={isUpdatingStatus}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "bg-card text-foreground hover:bg-secondary/60 border border-border/60"
                        }`}
                      >
                        <span>{st.label}</span>
                        {isCurrent && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>

                {/* Decline / Cancel Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange("declined")}
                    disabled={isUpdatingStatus}
                    className="text-xs text-rose-600 hover:bg-rose-500/10 rounded-full h-8 px-3"
                  >
                    Decline Order
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange("cancelled")}
                    disabled={isUpdatingStatus}
                    className="text-xs text-zinc-600 hover:bg-zinc-500/10 rounded-full h-8 px-3"
                  >
                    Cancel Order
                  </Button>
                </div>
              </div>

              {/* Customer & Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-secondary/20 p-4 sm:grid-cols-3 border border-border/40 text-xs">
                <div>
                  <span className="text-muted-foreground">Customer Name</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {selectedOrder.customer_name}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Email Address</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5 truncate">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    {selectedOrder.customer_email}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Phone Number</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    {selectedOrder.customer_phone || "Not provided"}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Event Type</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Cake className="h-3.5 w-3.5 text-primary" />
                    {selectedOrder.event_type}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Event Date</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {formatDate(selectedOrder.event_date)}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Requested On</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {formatDate(selectedOrder.created_at)}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-3">
                  <span className="text-muted-foreground">Delivery / City Address</span>
                  <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {customerAddress || "Loading address..."}
                  </p>
                </div>
              </div>

              {/* Cake Details Box */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <FileText className="h-4 w-4 text-primary" />
                  Cake Requirements & Description
                </h4>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedOrder.cake_details}
                </div>
              </div>

              {/* Admin / Bakery Notes Editor */}
              <div className="space-y-2 rounded-2xl bg-secondary/20 p-5 border border-border/40">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Bakery Notes & Quote Guidance
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Visible to customer on their account page
                  </span>
                </div>
                <Textarea
                  rows={3}
                  placeholder="Enter quote pricing details, kitchen instructions, or pickup notes for the customer..."
                  value={adminNotesText}
                  onChange={(e) => setAdminNotesText(e.target.value)}
                  className="rounded-2xl bg-card border-border/60 text-xs"
                />
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs"
                  >
                    {isSavingNotes ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving Notes...
                      </>
                    ) : (
                      "Save Bakery Notes"
                    )}
                  </Button>
                </div>
              </div>

              {/* Reference Photos */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Inspiration Photos ({orderImages.length})
                </h4>

                {loadingImages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-xs text-muted-foreground">Loading photos...</span>
                  </div>
                ) : orderImages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                    No inspiration photos were attached to this request.
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
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-5 w-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                            Photo unavailable
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-background/90 backdrop-blur-xs px-2 py-1 text-[10px] text-foreground truncate text-center">
                          {img.file_name}
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
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 p-4"
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

      {/* 7. PRINTABLE KITCHEN BAKING TICKET */}
      {ticketOrder && (
        <KitchenProductionTicket
          order={ticketOrder}
          images={ticketImages}
          onClose={() => setTicketOrder(null)}
        />
      )}
    </div>
  );
}
