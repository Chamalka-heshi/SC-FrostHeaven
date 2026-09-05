import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User,
  Package,
  Calendar,
  Clock,
  Cake,
  FileText,
  ImageIcon,
  LogOut,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Edit3,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Search,
  Filter,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { ReviewSubmissionModal } from "@/components/review-submission-modal";
import { CustomOrderTimeline, STATUS_LABELS } from "@/components/custom-order-timeline";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): { orderId?: string | undefined } => ({
    orderId: typeof search["orderId"] === "string" ? search["orderId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My Account — SC Frost Heaven" },
      {
        name: "description",
        content: "Manage your SC Frost Heaven customer profile and custom cake orders.",
      },
    ],
  }),
  component: AccountPage,
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

const ACTIVE_STATUSES = ["submitted", "under_review", "quoted", "accepted", "in_baking", "ready"];
const PAST_STATUSES = ["completed", "declined", "cancelled"];

function AccountPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const deepLinkedOrderId = searchParams?.orderId;
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<"orders" | "profile">("orders");
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Orders Filter & Search state
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "past">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Selected order details state
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // Action Confirmation state (Accept Quote / Cancel Order)
  const [actionConfirmation, setActionConfirmation] = useState<{
    type: "accept" | "cancel";
    order: CustomOrder;
  } | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Review submission modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
  });

  // 1. Auth Guard Protection: Redirect unauthenticated visitors once auth check is complete
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  // Sync profile form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
        city: profile.city || "",
      });
    }
  }, [profile]);

  // 2. Fetch authenticated customer's custom orders with strict customer_id scoping
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoadingOrders(true);
    setOrdersError(null);

    try {
      const { data, error } = await supabase
        .from("custom_orders")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: unknown) {
      console.error("Error loading customer orders:", err);
      setOrdersError(err instanceof Error ? err.message : "Failed to load your orders");
    } finally {
      setLoadingOrders(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  // 3. Derived Filtered & Searched Orders
  const { filteredOrders, orderCounts } = useMemo(() => {
    const allCount = orders.length;
    const activeCount = orders.filter((o) =>
      ACTIVE_STATUSES.includes(o.status.toLowerCase()),
    ).length;
    const pastCount = orders.filter((o) => PAST_STATUSES.includes(o.status.toLowerCase())).length;

    const query = orderSearch.toLowerCase().trim();

    const result = orders.filter((order) => {
      const statusLower = order.status.toLowerCase();

      // 1. Filter by Active / Past
      if (orderFilter === "active" && !ACTIVE_STATUSES.includes(statusLower)) {
        return false;
      }
      if (orderFilter === "past" && !PAST_STATUSES.includes(statusLower)) {
        return false;
      }

      // 2. Search query filter
      if (query) {
        const typeMatch = order.event_type.toLowerCase().includes(query);
        const dateMatch = order.event_date.toLowerCase().includes(query);
        const idMatch = order.id.toLowerCase().includes(query);
        const shortIdMatch = `#${order.id.slice(0, 8).toLowerCase()}`.includes(query);
        const detailsMatch = (order.cake_details || "").toLowerCase().includes(query);
        const notesMatch = (order.admin_notes || "").toLowerCase().includes(query);

        if (!typeMatch && !dateMatch && !idMatch && !shortIdMatch && !detailsMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });

    return {
      filteredOrders: result,
      orderCounts: { all: allCount, active: activeCount, past: pastCount },
    };
  }, [orders, orderFilter, orderSearch]);

  // 4. Order Details & Reference Images Handler with Strict Ownership Verification
  const handleOpenOrder = useCallback(
    async (order: CustomOrder) => {
      if (!user || order.customer_id !== user.id) {
        toast.error("Unauthorized access to this order.");
        return;
      }

      setSelectedOrder(order);
      setLoadingImages(true);
      setOrderImages([]);

      try {
        const { data: imagesData, error: imagesError } = await supabase
          .from("custom_order_images")
          .select("id, order_id, storage_path, file_name, file_size_bytes, created_at")
          .eq("order_id", order.id);

        if (imagesError) throw imagesError;

        if (imagesData && imagesData.length > 0) {
          const imagesWithSignedUrls = await Promise.all(
            imagesData.map(async (img) => {
              const { data: signedData, error: signedError } = await supabase.storage
                .from("cake-references")
                .createSignedUrl(img.storage_path, 3600); // 1 hour validity

              if (signedError) {
                console.warn(`Signed URL generation error for ${img.file_name}:`, signedError);
                return { ...img, signedUrl: null };
              }
              return { ...img, signedUrl: signedData?.signedUrl ?? null };
            }),
          );
          setOrderImages(imagesWithSignedUrls);
        }
      } catch (err: unknown) {
        console.error("Error loading order images:", err);
        toast.error("Could not load reference photos for this order.");
      } finally {
        setLoadingImages(false);
      }
    },
    [user],
  );

  // Automatically open order details modal if deepLinkedOrderId is provided in route search params
  useEffect(() => {
    if (deepLinkedOrderId && orders.length > 0 && !selectedOrder) {
      const targetOrder = orders.find(
        (o) =>
          o.id === deepLinkedOrderId ||
          o.id.slice(0, 8).toLowerCase() === deepLinkedOrderId.toLowerCase(),
      );
      if (targetOrder) {
        handleOpenOrder(targetOrder);
      }
    }
  }, [deepLinkedOrderId, orders, selectedOrder, handleOpenOrder]);

  // 5. Customer Action: Confirm Quote (quoted -> accepted)
  const handleConfirmAcceptQuote = async (order: CustomOrder) => {
    if (!user || isPerformingAction) return;
    setIsPerformingAction(true);

    try {
      const { error } = await supabase
        .from("custom_orders")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("customer_id", user.id)
        .eq("status", "quoted"); // Enforces strict condition

      if (error) throw error;

      toast.success(
        "Quote accepted! Your custom cake order has been confirmed with our bakery team.",
      );
      setActionConfirmation(null);
      await fetchOrders();

      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({
          ...selectedOrder,
          status: "accepted",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      console.error("Error accepting quote:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to confirm quote. Please try again.",
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 6. Customer Action: Cancel Request (submitted/under_review/quoted -> cancelled)
  const handleConfirmCancelOrder = async (order: CustomOrder) => {
    if (!user || isPerformingAction) return;
    setIsPerformingAction(true);

    try {
      const { error } = await supabase
        .from("custom_orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("customer_id", user.id)
        .in("status", ["submitted", "under_review", "quoted"]); // Restricts to cancelable unbaked statuses

      if (error) throw error;

      toast.success("Custom order request has been cancelled.");
      setActionConfirmation(null);
      await fetchOrders();

      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({
          ...selectedOrder,
          status: "cancelled",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      console.error("Error cancelling order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 7. Copy Order ID to Clipboard
  const handleCopyOrderId = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    toast.success("Order ID copied to clipboard");
    setTimeout(() => {
      setCopiedOrderId(null);
    }, 2000);
  };

  // 8. Profile Update Handler
  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSavingProfile) return;

    if (!profileForm.full_name.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          address: profileForm.address.trim() || null,
          city: profileForm.city.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditingProfile(false);
      toast.success("Profile details updated successfully!");
    } catch (err: unknown) {
      console.error("Error updating profile:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile. Please try again.",
      );
    } finally {
      setIsSavingProfile(false);
    }
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
            <Sparkles className="h-3 w-3" />
            Quote Ready
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </span>
        );
      case "in_baking":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-500/20">
            <Clock className="h-3 w-3" />
            In Baking
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Ready for Pickup
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
            <AlertCircle className="h-3 w-3" />
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
            {STATUS_LABELS[s] || status}
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

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const customerDisplayName = profile?.full_name || user.email?.split("@")[0] || "Valued Customer";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-hero px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Account Header Banner */}
        <div className="flex flex-col gap-6 rounded-3xl bg-card p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8 border border-border/60">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blush text-2xl font-bold text-primary shadow-xs">
              {customerDisplayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-medium text-foreground sm:text-3xl">
                  {customerDisplayName}
                </h1>
                {profile?.role === "admin" && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Admin
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsReviewModalOpen(true)}
              className="rounded-full border-border text-xs font-medium gap-1.5 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/30 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Leave a Review</span>
            </Button>
            <Link
              to="/custom-orders"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              New Custom Order
            </Link>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="rounded-full border-border text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex border-b border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "orders"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            My Custom Orders
            {orders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground font-semibold">
                {orders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            Profile Settings
          </button>
        </div>

        {/* TAB 1: MY CUSTOM ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Search & Status Filters Bar */}
            {orders.length > 0 && (
              <div className="rounded-3xl bg-card p-4 sm:p-5 shadow-soft border border-border/70 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by event, date, or #Order ID..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="rounded-2xl pl-10 bg-secondary/20 border-border/70 text-xs h-10"
                    />
                    {orderSearch && (
                      <button
                        type="button"
                        onClick={() => setOrderSearch("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrderFilter("all")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        orderFilter === "all"
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      All Orders ({orderCounts.all})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter("active")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        orderFilter === "active"
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      Active Celebrations ({orderCounts.active})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter("past")}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        orderFilter === "past"
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      Completed / Past ({orderCounts.past})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Content Area */}
            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-16 shadow-soft border border-border/60">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading your custom cake orders...</p>
              </div>
            ) : ordersError ? (
              <div className="rounded-3xl bg-destructive/10 p-8 text-center shadow-soft border border-destructive/20">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
                <p className="text-sm font-medium text-destructive">{ordersError}</p>
                <Button
                  variant="outline"
                  onClick={fetchOrders}
                  className="mt-4 rounded-full border-destructive/30 text-destructive cursor-pointer"
                >
                  Try Again
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush text-primary">
                  <Cake className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-medium text-foreground">No Custom Orders Yet</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  You haven&apos;t placed any custom cake orders yet. Have an upcoming celebration
                  or dream cake in mind?
                </p>
                <div className="pt-2">
                  <Link
                    to="/custom-orders"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Request a Custom Cake
                  </Link>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-3xl bg-card p-10 text-center shadow-soft border border-border/60 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Filter className="h-6 w-6" />
                </div>
                <h4 className="text-base font-medium text-foreground">No matching orders found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {orderSearch
                    ? `No custom orders match "${orderSearch}". Try searching for another event or date.`
                    : "No orders found in this category."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrderSearch("");
                    setOrderFilter("all");
                  }}
                  className="rounded-full text-xs cursor-pointer"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredOrders.map((order) => {
                  const statusLower = order.status.toLowerCase();
                  const isQuoted = statusLower === "quoted";
                  const canCancel = ["submitted", "under_review", "quoted"].includes(statusLower);
                  const shortId = order.id.slice(0, 8).toUpperCase();
                  const isCopied = copiedOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="group flex flex-col justify-between gap-6 rounded-3xl bg-card p-6 sm:p-8 shadow-soft border border-border/70 hover:border-primary/40 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Order ID with Copy Button */}
                          <div className="flex items-center gap-1 rounded-xl bg-secondary/50 px-2.5 py-1 text-xs font-mono font-medium text-foreground border border-border/60">
                            <span>#{shortId}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyOrderId(e, order.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                              title="Copy full Order UUID"
                              aria-label={`Copy Order ID #${shortId}`}
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          {renderStatusBadge(order.status)}

                          <span className="text-xs text-muted-foreground">
                            Requested on {formatDate(order.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Event Date: {formatDate(order.event_date)}</span>
                        </div>
                      </div>

                      {/* Event Title */}
                      <div className="space-y-1">
                        <h3 className="text-xl font-medium text-foreground">
                          {order.event_type} Celebration Cake
                        </h3>
                        <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                          {order.cake_details}
                        </p>
                      </div>

                      {/* 5-Stage Custom Order Progress Timeline */}
                      <div className="rounded-2xl bg-secondary/20 p-4 sm:p-5 border border-border/50">
                        <CustomOrderTimeline status={order.status} showExplanation={true} />
                      </div>

                      {/* Prominent Quote / Instructions Banner (When Quoted) with Action Buttons */}
                      {isQuoted && (
                        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 sm:p-6 space-y-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            <Sparkles className="h-4 w-4 text-amber-600" />
                            <span>Quotation & Bakery Instructions Ready</span>
                          </div>
                          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            {order.admin_notes ||
                              "Your custom cake request has been reviewed and quoted by our bakery team. Please review the details and click below to confirm your order."}
                          </p>

                          {/* Customer Confirmation Action Button */}
                          <div className="pt-2 flex flex-wrap items-center gap-3">
                            <Button
                              onClick={() => setActionConfirmation({ type: "accept", order })}
                              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-5 h-9 gap-1.5 cursor-pointer shadow-xs font-semibold"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Accept Quote & Confirm Order</span>
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setActionConfirmation({ type: "cancel", order })}
                              className="rounded-full text-xs h-9 px-4 text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              <span>Cancel Request</span>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Contact:{" "}
                            <span className="font-medium text-foreground">
                              {order.customer_name}
                            </span>
                          </span>
                          {/* Cancel button for unbaked non-quoted requests */}
                          {canCancel && !isQuoted && (
                            <button
                              type="button"
                              onClick={() => setActionConfirmation({ type: "cancel", order })}
                              className="text-xs text-muted-foreground hover:text-destructive underline decoration-dotted transition-colors cursor-pointer"
                            >
                              Cancel Request
                            </button>
                          )}
                        </div>

                        <Button
                          variant="secondary"
                          onClick={() => handleOpenOrder(order)}
                          className="rounded-full text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer gap-1.5"
                        >
                          <span>View Full Order Details</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROFILE SETTINGS */}
        {activeTab === "profile" && (
          <div className="rounded-3xl bg-card p-6 shadow-soft sm:p-8 border border-border/60">
            <div className="flex items-center justify-between pb-6 border-b border-border/60">
              <div>
                <h2 className="text-xl font-medium text-foreground">Personal Information</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update your contact details for future cake inquiries and deliveries
                </p>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                  className="rounded-full gap-1.5 cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              )}
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={profileForm.full_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, full_name: e.target.value })
                      }
                      disabled={isSavingProfile}
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address (Read-only)</Label>
                    <Input
                      id="edit-email"
                      value={user.email || ""}
                      disabled
                      className="rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone Number</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      placeholder="+94 77 123 4567"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      disabled={isSavingProfile}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City / Delivery Area</Label>
                    <Input
                      id="edit-city"
                      placeholder="Colombo, Kandy, Gampaha..."
                      value={profileForm.city}
                      onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      disabled={isSavingProfile}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-address">Delivery Address</Label>
                  <Input
                    id="edit-address"
                    placeholder="Street address, apartment or landmark"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    disabled={isSavingProfile}
                    className="rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingProfile(false);
                      if (profile) {
                        setProfileForm({
                          full_name: profile.full_name || "",
                          phone: profile.phone || "",
                          address: profile.address || "",
                          city: profile.city || "",
                        });
                      }
                    }}
                    disabled={isSavingProfile}
                    className="rounded-full cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4 border border-border/40">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Full Name</span>
                    <p className="text-sm font-medium text-foreground">
                      {profile?.full_name || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4 border border-border/40">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Email Address</span>
                    <p className="text-sm font-medium text-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4 border border-border/40">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Phone Number</span>
                    <p className="text-sm font-medium text-foreground">
                      {profile?.phone || "No phone number added"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4 border border-border/40">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      City & Address
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {profile?.address
                        ? `${profile.address}${profile.city ? `, ${profile.city}` : ""}`
                        : profile?.city || "No address added"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ORDER DETAILS MODAL / DIALOG */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">
                    #{selectedOrder.id.slice(0, 8).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyOrderId(e, selectedOrder.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                    title="Copy full Order UUID"
                    aria-label={`Copy Order ID #${selectedOrder.id.slice(0, 8)}`}
                  >
                    {copiedOrderId === selectedOrder.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {renderStatusBadge(selectedOrder.status)}
                </div>
                <h2 className="text-xl font-medium text-foreground mt-1">
                  {selectedOrder.event_type} Cake Order
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 5-Stage Custom Order Progress Timeline in Modal */}
              <div className="rounded-2xl bg-secondary/20 p-5 border border-border/50">
                <CustomOrderTimeline status={selectedOrder.status} showExplanation={true} />
              </div>

              {/* Prominent Quote / Instructions Banner with Action Buttons in Modal */}
              {(selectedOrder.status.toLowerCase() === "quoted" || selectedOrder.admin_notes) && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Bakery Team Notes & Quotation</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {selectedOrder.admin_notes ||
                      "Your custom cake request has been reviewed by our bakery chef. Please review the instructions or confirm your order."}
                  </p>

                  {/* Accept quote action in modal */}
                  {selectedOrder.status.toLowerCase() === "quoted" && (
                    <div className="pt-2 flex flex-wrap items-center gap-2.5">
                      <Button
                        size="sm"
                        onClick={() =>
                          setActionConfirmation({ type: "accept", order: selectedOrder })
                        }
                        className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-4 h-8 gap-1.5 cursor-pointer font-semibold shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Accept Quote & Confirm Order</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setActionConfirmation({ type: "cancel", order: selectedOrder })
                        }
                        className="rounded-full text-xs h-8 px-3 text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        <span>Cancel Request</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Order Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-secondary/20 p-4 sm:grid-cols-3 border border-border/40">
                <div>
                  <span className="text-xs text-muted-foreground">Event Date</span>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {formatDate(selectedOrder.event_date)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact Name</span>
                  <p className="text-sm font-medium text-foreground truncate mt-0.5">
                    {selectedOrder.customer_name}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Order Date</span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {formatDate(selectedOrder.created_at)}
                  </p>
                </div>
              </div>

              {/* Cake Details */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Cake Details & Instructions
                </h4>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedOrder.cake_details}
                </div>
              </div>

              {/* Uploaded Reference Images */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Inspiration & Reference Photos ({orderImages.length})
                </h4>

                {loadingImages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-xs text-muted-foreground">Loading photos...</span>
                  </div>
                ) : orderImages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
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
              {["submitted", "under_review"].includes(selectedOrder.status.toLowerCase()) ? (
                <button
                  type="button"
                  onClick={() => setActionConfirmation({ type: "cancel", order: selectedOrder })}
                  className="text-xs text-muted-foreground hover:text-destructive underline decoration-dotted transition-colors cursor-pointer"
                >
                  Cancel Order Request
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Status:{" "}
                  <span className="font-semibold text-foreground uppercase">
                    {STATUS_LABELS[selectedOrder.status.toLowerCase()] || selectedOrder.status}
                  </span>
                </span>
              )}
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION CONFIRMATION DIALOG (Accept Quote / Cancel Request) */}
      {actionConfirmation && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl border border-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              {actionConfirmation.type === "accept" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-5 w-5" />
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {actionConfirmation.type === "accept"
                    ? "Confirm & Accept Quote?"
                    : "Cancel Custom Order Request?"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {actionConfirmation.type === "accept"
                    ? "By confirming, you accept the bakery instructions and quote for this custom cake. Our pastry team will schedule baking for your event date."
                    : "Are you sure you want to cancel this custom cake request? This action cannot be undone."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActionConfirmation(null)}
                disabled={isPerformingAction}
                className="rounded-full text-xs cursor-pointer"
              >
                Go Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (actionConfirmation.type === "accept") {
                    handleConfirmAcceptQuote(actionConfirmation.order);
                  } else {
                    handleConfirmCancelOrder(actionConfirmation.order);
                  }
                }}
                disabled={isPerformingAction}
                className={`rounded-full text-xs cursor-pointer ${
                  actionConfirmation.type === "accept"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                }`}
              >
                {isPerformingAction ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : actionConfirmation.type === "accept" ? (
                  "Yes, Confirm Order"
                ) : (
                  "Yes, Cancel Request"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE IMAGE PREVIEW LIGHTBOX */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActivePreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setActivePreviewImage(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
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

      {/* Review Submission Modal */}
      <ReviewSubmissionModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
      />
    </div>
  );
}
