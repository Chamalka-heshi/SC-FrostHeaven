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
  Download,
  Receipt,
  Banknote,
  CreditCard,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { KitchenProductionView } from "@/components/kitchen-production-view";
import { KitchenProductionTicket } from "@/components/kitchen-production-ticket";
import { exportToCsv, getLocalDateString } from "@/lib/csv-export";
import {
  getProductionReadiness,
  getPaymentBadgeInfo,
  normalizePhoneForWhatsApp,
  getWhatsAppUrl,
  getEmailMailtoUrl,
  type ReadinessInfo,
} from "@/lib/order-readiness";
import {
  getStaffDisplayName,
  previewStaffAssignmentImpact,
  type StaffProfileInput,
} from "@/lib/staff-workload-utils";
import type { KitchenCapacitySetting, BakeryBlackoutDate } from "@/lib/capacity-utils";

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
  customer_message?: string | null | undefined;
  internal_notes?: string | null | undefined;
  admin_notes?: string | null | undefined;
  quoted_price_lkr?: number | null | undefined;
  deposit_amount_lkr?: number | null | undefined;
  amount_paid_lkr?: number | undefined;
  payment_status?: string | null | undefined;
  payment_method?: string | null | undefined;
  payment_reference?: string | null | undefined;
  payment_notes?: string | null | undefined;
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cash_on_pickup: "Cash at Bakery / Pickup",
  card_pos: "Card / POS Terminal",
  online_payment: "Online Payment",
};

export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

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
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "date_asc" | "date_desc">(
    "newest",
  );

  // Selected Order Modal state
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [customerMessageText, setCustomerMessageText] = useState("");
  const [internalNotesText, setInternalNotesText] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Structured Financial Quotation & Payment state
  const [quotedPriceInput, setQuotedPriceInput] = useState<string>("");
  const [depositAmountInput, setDepositAmountInput] = useState<string>("");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>("bank_transfer");
  const [paymentReferenceInput, setPaymentReferenceInput] = useState<string>("");
  const [paymentNotesInput, setPaymentNotesInput] = useState<string>("");
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [financialSectionTab, setFinancialSectionTab] = useState<"overview" | "quote" | "payment">(
    "overview",
  );

  // Staff Assignment State (Phase 7E)
  const [staffList, setStaffList] = useState<StaffProfileInput[]>([]);
  const [orderBakerId, setOrderBakerId] = useState<string>("");
  const [orderDecoratorId, setOrderDecoratorId] = useState<string>("");
  const [orderBakeDate, setOrderBakeDate] = useState<string>("");
  const [orderDecorateDate, setOrderDecorateDate] = useState<string>("");
  const [orderPickupTime, setOrderPickupTime] = useState<string>("");
  const [orderPriority, setOrderPriority] = useState<string>("normal");
  const [orderComplexity, setOrderComplexity] = useState<number>(1.0);
  const [isSavingKitchenAssignment, setIsSavingKitchenAssignment] = useState(false);

  // Kitchen Capacity & Blackout State (Phase 7F)
  const [capacitySettings, setCapacitySettings] = useState<KitchenCapacitySetting[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BakeryBlackoutDate[]>([]);

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

  // 2. Fetch All Custom Orders from Supabase (Including Phase 6B Structured Financial Data & Phase 7 Scheduling/Staff Data)
  const fetchOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoadingOrders(true);
    setOrdersError(null);

    try {
      // 1. Fetch custom orders
      const { data: initialData, error } = await supabase
        .from("custom_orders")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, customer_message, internal_notes, admin_notes, quoted_price_lkr, deposit_amount_lkr, amount_paid_lkr, payment_status, payment_method, payment_reference, payment_notes, quote_issued_at, deposit_paid_at, fully_paid_at, scheduled_bake_date, scheduled_decorate_date, target_pickup_time, production_priority, complexity_units, assigned_baker_id, assigned_decorator_id, production_started_at, production_completed_at, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      let data = initialData;

      if (
        error &&
        (error.code === "42703" ||
          error.message?.includes("quoted_price_lkr") ||
          error.message?.includes("does not exist"))
      ) {
        console.warn(
          "Structured payment/scheduling columns not detected on custom_orders. Falling back to base columns.",
        );
        const fallbackRes = await supabase
          .from("custom_orders")
          .select(
            "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, customer_message, internal_notes, admin_notes, created_at, updated_at",
          )
          .order("created_at", { ascending: false });
        if (fallbackRes.error) throw fallbackRes.error;
        data = (fallbackRes.data || []) as unknown as typeof data;
      } else if (error) {
        throw error;
      }

      setOrders(data || []);

      // 2. Fetch admin profiles for staff assignment candidates
      const { data: profsData, error: profsError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "admin");

      if (!profsError && profsData) {
        setStaffList(profsData as StaffProfileInput[]);
      }

      // 3. Fetch kitchen capacity settings
      const { data: capData, error: capError } = await supabase
        .from("kitchen_capacity_settings")
        .select("id, day_of_week, max_capacity_units, updated_at")
        .order("day_of_week", { ascending: true });

      if (!capError && capData) {
        setCapacitySettings(capData as KitchenCapacitySetting[]);
      }

      // 4. Fetch bakery blackout dates
      const { data: blackoutData, error: blackoutError } = await supabase
        .from("bakery_blackout_dates")
        .select("id, blackout_date, reason, created_at")
        .order("blackout_date", { ascending: true });

      if (!blackoutError && blackoutData) {
        setBlackoutDates(blackoutData as BakeryBlackoutDate[]);
      }

      if (isManualRefresh) {
        toast.success("Custom orders refreshed.");
      }
    } catch (err: unknown) {
      console.error("Error fetching admin custom orders:", err);
      setOrdersError(err instanceof Error ? err.message : "Failed to load custom orders.");
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
    const todayStr = getLocalDateString();
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
          const msgMatch = order.customer_message?.toLowerCase().includes(query);
          const internalMatch = order.internal_notes?.toLowerCase().includes(query);
          const legacyMatch = order.admin_notes?.toLowerCase().includes(query);
          const refMatch = order.payment_reference?.toLowerCase().includes(query);

          if (
            !nameMatch &&
            !emailMatch &&
            !phoneMatch &&
            !idMatch &&
            !shortIdMatch &&
            !eventMatch &&
            !detailsMatch &&
            !msgMatch &&
            !internalMatch &&
            !legacyMatch &&
            !refMatch
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
    setCustomerMessageText(order.customer_message || order.admin_notes || "");
    setInternalNotesText(order.internal_notes || "");
    setOrderImages([]);
    setCustomerAddress(null);
    setLoadingImages(true);

    // Initialize Financial Quotation & Payment state
    setQuotedPriceInput(
      order.quoted_price_lkr !== null && order.quoted_price_lkr !== undefined
        ? String(order.quoted_price_lkr)
        : "",
    );
    setDepositAmountInput(
      order.deposit_amount_lkr !== null && order.deposit_amount_lkr !== undefined
        ? String(order.deposit_amount_lkr)
        : "",
    );
    setAmountPaidInput(String(order.amount_paid_lkr ?? 0));
    setPaymentMethodInput(order.payment_method || "bank_transfer");
    setPaymentReferenceInput(order.payment_reference || "");
    setPaymentNotesInput(order.payment_notes || "");
    setFinancialSectionTab("overview");

    // Initialize Kitchen & Staff Assignment state
    setOrderBakerId(order.assigned_baker_id || "");
    setOrderDecoratorId(order.assigned_decorator_id || "");
    setOrderBakeDate(order.scheduled_bake_date || "");
    setOrderDecorateDate(order.scheduled_decorate_date || "");
    setOrderPickupTime(order.target_pickup_time ? order.target_pickup_time.slice(0, 5) : "");
    setOrderPriority(order.production_priority || "normal");
    setOrderComplexity(
      order.complexity_units !== undefined && order.complexity_units !== null
        ? Number(order.complexity_units)
        : 1.0,
    );

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
          }),
        );
        setOrderImages(signedImages);
      }
    } catch (err: unknown) {
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

      const updatedOrder = {
        ...selectedOrder,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));

      const label = ORDER_STATUSES.find((s) => s.value === newStatus)?.label || newStatus;
      toast.success(`Order status updated to ${label}`);
    } catch (err: unknown) {
      console.error("Status update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update order status.");
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
          o.id === orderId ? { ...o, status: nextStatus, updated_at: new Date().toISOString() } : o,
        ),
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        });
      }

      const label = ORDER_STATUSES.find((s) => s.value === nextStatus)?.label || nextStatus;
      toast.success(`Kitchen stage updated to ${label}`);
    } catch (err: unknown) {
      console.error("Quick status update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update kitchen status.");
    } finally {
      setUpdatingKitchenOrderId(null);
    }
  };

  // 9. Save Administrator Notes
  const handleSaveNotes = async () => {
    if (!selectedOrder || isSavingNotes) return;
    setIsSavingNotes(true);

    try {
      const trimmedMessage = customerMessageText.trim() || null;
      const trimmedInternal = internalNotesText.trim() || null;

      const { error } = await supabase
        .from("custom_orders")
        .update({
          customer_message: trimmedMessage,
          internal_notes: trimmedInternal,
          admin_notes: trimmedMessage, // Mirror to admin_notes for legacy backwards compatibility
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updatedOrder = {
        ...selectedOrder,
        customer_message: trimmedMessage,
        internal_notes: trimmedInternal,
        admin_notes: trimmedMessage,
        updated_at: new Date().toISOString(),
      };
      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));

      toast.success("Customer message and internal bakery notes saved successfully.");
    } catch (err: unknown) {
      console.error("Notes save error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // 10. Save / Issue Quotation (Admin-Only Structured Whole LKR Integer)
  const handleSaveQuote = async () => {
    if (!selectedOrder || isSavingQuote) return;

    const trimmedPrice = quotedPriceInput.trim();
    if (!trimmedPrice) {
      toast.error("Please enter a total quoted price in LKR.");
      return;
    }

    const priceNum = parseInt(trimmedPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Quoted price must be a valid whole rupee amount greater than 0.");
      return;
    }

    let depositNum = 0;
    const trimmedDeposit = depositAmountInput.trim();
    if (trimmedDeposit) {
      depositNum = parseInt(trimmedDeposit, 10);
      if (isNaN(depositNum) || depositNum < 0) {
        toast.error("Deposit amount cannot be negative.");
        return;
      }
      if (depositNum > priceNum) {
        toast.error("Deposit amount cannot exceed the total quoted price.");
        return;
      }
    }

    setIsSavingQuote(true);

    try {
      const nowIso = new Date().toISOString();
      const nextStatus =
        selectedOrder.status === "submitted" || selectedOrder.status === "under_review"
          ? "quoted"
          : selectedOrder.status;

      const currentPaid = selectedOrder.amount_paid_lkr ?? 0;
      let nextPaymentStatus: string;
      if (currentPaid === 0) {
        nextPaymentStatus = "unpaid";
      } else if (currentPaid >= priceNum && priceNum > 0) {
        nextPaymentStatus = "fully_paid";
      } else if (depositNum > 0 && currentPaid >= depositNum) {
        nextPaymentStatus = "deposit_paid";
      } else {
        nextPaymentStatus = "unpaid";
      }

      let quoteIssuedAt = selectedOrder.quote_issued_at;
      if (!selectedOrder.quote_issued_at || selectedOrder.status !== nextStatus) {
        quoteIssuedAt = nowIso;
      }

      const updatePayload: Record<string, unknown> = {
        quoted_price_lkr: priceNum,
        deposit_amount_lkr: depositNum,
        payment_status: nextPaymentStatus,
        customer_message: customerMessageText.trim() || null,
        internal_notes: internalNotesText.trim() || null,
        admin_notes: customerMessageText.trim() || null,
        status: nextStatus,
        quote_issued_at: quoteIssuedAt,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from("custom_orders")
        .update(updatePayload)
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updatedOrder: CustomOrder = {
        ...selectedOrder,
        quoted_price_lkr: priceNum,
        deposit_amount_lkr: depositNum,
        payment_status: nextPaymentStatus,
        customer_message: customerMessageText.trim() || null,
        internal_notes: internalNotesText.trim() || null,
        admin_notes: customerMessageText.trim() || null,
        status: nextStatus,
        quote_issued_at: quoteIssuedAt || nowIso,
        updated_at: nowIso,
      };

      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));
      toast.success(
        nextStatus === "quoted"
          ? `Quotation of ${formatLKR(priceNum)} issued and order moved to Quoted.`
          : `Quotation updated to ${formatLKR(priceNum)}.`,
      );
      setFinancialSectionTab("overview");
    } catch (err: unknown) {
      console.error("Error saving quotation:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save quotation.");
    } finally {
      setIsSavingQuote(false);
    }
  };

  // 11. Save / Record Verified Payment (Admin Audit Logging)
  const handleSavePayment = async () => {
    if (!selectedOrder || isSavingPayment) return;

    if (!selectedOrder.quoted_price_lkr || selectedOrder.quoted_price_lkr <= 0) {
      toast.error(
        "A structured quotation must be created and saved before payments can be recorded.",
      );
      return;
    }

    const trimmedPaid = amountPaidInput.trim();
    const paidNum = trimmedPaid === "" ? 0 : parseInt(trimmedPaid, 10);

    if (isNaN(paidNum) || paidNum < 0) {
      toast.error("Amount paid must be a non-negative whole rupee number.");
      return;
    }

    if (paidNum > selectedOrder.quoted_price_lkr) {
      toast.error(
        `Amount paid (${formatLKR(paidNum)}) cannot exceed total quote (${formatLKR(selectedOrder.quoted_price_lkr)}).`,
      );
      return;
    }

    setIsSavingPayment(true);

    try {
      const nowIso = new Date().toISOString();
      const depositTarget = selectedOrder.deposit_amount_lkr ?? 0;
      const quotedTotal = selectedOrder.quoted_price_lkr;

      // Determine database-valid payment status adhering strictly to Phase 6B check constraint
      let newPaymentStatus: string;
      if (paidNum === 0) {
        newPaymentStatus = "unpaid";
      } else if (paidNum >= quotedTotal && quotedTotal > 0) {
        newPaymentStatus = "fully_paid";
      } else if (depositTarget > 0 && paidNum >= depositTarget) {
        newPaymentStatus = "deposit_paid";
      } else {
        newPaymentStatus = "unpaid";
      }

      let depositPaidAt: string | null = selectedOrder.deposit_paid_at ?? null;
      let fullyPaidAt: string | null = selectedOrder.fully_paid_at ?? null;

      const validPaymentMethods = ["bank_transfer", "cash_on_pickup", "card_pos", "online_payment"];
      let safePaymentMethod: string | null =
        paymentMethodInput && validPaymentMethods.includes(paymentMethodInput)
          ? paymentMethodInput
          : "bank_transfer";

      if (paidNum === 0) {
        newPaymentStatus = "unpaid";
        depositPaidAt = null;
        fullyPaidAt = null;
        safePaymentMethod = null;
      } else if (paidNum >= quotedTotal && quotedTotal > 0) {
        newPaymentStatus = "fully_paid";
        if (!depositPaidAt) depositPaidAt = nowIso;
        if (!fullyPaidAt) fullyPaidAt = nowIso;
      } else if (depositTarget > 0 && paidNum >= depositTarget) {
        newPaymentStatus = "deposit_paid";
        if (!depositPaidAt) depositPaidAt = nowIso;
        fullyPaidAt = null;
      } else {
        newPaymentStatus = "unpaid";
        depositPaidAt = null;
        fullyPaidAt = null;
      }

      const updatePayload: Record<string, unknown> = {
        amount_paid_lkr: paidNum,
        payment_status: newPaymentStatus,
        payment_method: safePaymentMethod,
        payment_reference: paidNum === 0 ? null : paymentReferenceInput.trim() || null,
        payment_notes: paymentNotesInput.trim() || null,
        deposit_paid_at: depositPaidAt,
        fully_paid_at: fullyPaidAt,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from("custom_orders")
        .update(updatePayload)
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updatedOrder: CustomOrder = {
        ...selectedOrder,
        amount_paid_lkr: paidNum,
        payment_status: newPaymentStatus,
        payment_method: safePaymentMethod,
        payment_reference: paymentReferenceInput.trim() || null,
        payment_notes: paymentNotesInput.trim() || null,
        deposit_paid_at: depositPaidAt,
        fully_paid_at: fullyPaidAt,
        updated_at: nowIso,
      };

      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));
      toast.success(
        `Payment record updated: ${formatLKR(paidNum)} verified (${newPaymentStatus.replace(/_/g, " ")}).`,
      );
      setFinancialSectionTab("overview");
    } catch (err: unknown) {
      console.error("Error saving payment record:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  // 11b. Save Kitchen Scheduling & Staff Assignment (Phase 7E)
  const handleSaveKitchenAssignment = async () => {
    if (!selectedOrder || isSavingKitchenAssignment) return;

    if (orderBakeDate && orderDecorateDate && orderDecorateDate < orderBakeDate) {
      toast.error("Invalid Schedule: Decorate date cannot be earlier than the bake date.");
      return;
    }

    const complexityNum = Number(orderComplexity);
    if (isNaN(complexityNum) || complexityNum < 0.5 || complexityNum > 10.0) {
      toast.error("Invalid Complexity: Workload units must be between 0.5 and 10.0.");
      return;
    }

    try {
      setIsSavingKitchenAssignment(true);
      const nowIso = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        scheduled_bake_date: orderBakeDate.trim() ? orderBakeDate.trim() : null,
        scheduled_decorate_date: orderDecorateDate.trim() ? orderDecorateDate.trim() : null,
        target_pickup_time: orderPickupTime.trim() ? `${orderPickupTime.trim()}:00` : null,
        production_priority: orderPriority.toLowerCase(),
        complexity_units: complexityNum,
        assigned_baker_id: orderBakerId.trim() ? orderBakerId.trim() : null,
        assigned_decorator_id: orderDecoratorId.trim() ? orderDecoratorId.trim() : null,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from("custom_orders")
        .update(updatePayload)
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updatedOrder: CustomOrder = {
        ...selectedOrder,
        ...updatePayload,
      };

      setSelectedOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));
      toast.success("Kitchen scheduling & staff assignments saved.");
    } catch (err: unknown) {
      console.error("Failed to save kitchen assignment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save kitchen assignment.");
    } finally {
      setIsSavingKitchenAssignment(false);
    }
  };

  // 12. Open Kitchen Ticket for Printing
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
          }),
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

  // 13. Export Custom Orders to CSV (Structured Financial Columns Included)
  const handleExportOrdersCsv = () => {
    const todayStr = getLocalDateString();
    const headers = [
      "Order ID",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Event Type",
      "Event Date",
      "Workflow Status",
      "Production Readiness",
      "Quoted Price (LKR)",
      "Deposit Amount (LKR)",
      "Amount Paid (LKR)",
      "Outstanding Balance (LKR)",
      "Payment Status",
      "Payment Method",
      "Quote Issued At",
      "Deposit Paid At",
      "Fully Paid At",
      "Submission Date",
      "Updated Date",
      "Cake Details",
      "Customer Message",
    ];

    const rows = filteredOrders.map((o) => {
      const isQuoted = o.quoted_price_lkr !== null && o.quoted_price_lkr !== undefined;
      const quoted = isQuoted ? o.quoted_price_lkr : "";
      const deposit = isQuoted ? (o.deposit_amount_lkr ?? "") : "";
      const paid = isQuoted ? (o.amount_paid_lkr ?? 0) : "";
      const balance = isQuoted
        ? Math.max((o.quoted_price_lkr ?? 0) - (o.amount_paid_lkr ?? 0), 0)
        : "";
      const readiness = getProductionReadiness(o);
      const paymentInfo = getPaymentBadgeInfo(o);

      return [
        o.id,
        o.customer_name,
        o.customer_email,
        o.customer_phone || "",
        o.event_type,
        o.event_date,
        o.status,
        readiness.label,
        quoted,
        deposit,
        paid,
        balance,
        paymentInfo.label,
        o.payment_method ? PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method : "",
        o.quote_issued_at || "",
        o.deposit_paid_at || "",
        o.fully_paid_at || "",
        o.created_at,
        o.updated_at || o.created_at,
        o.cake_details,
        o.customer_message || o.admin_notes || "",
      ];
    });

    exportToCsv(`custom-orders-${todayStr}.csv`, headers, rows);
    toast.success(`Exported ${filteredOrders.length} custom orders to CSV`);
  };

  // Helper: Production readiness badge renderer
  const renderReadinessBadge = (order: CustomOrder) => {
    const readiness = getProductionReadiness(order);
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${readiness.badgeClass}`}
        title={readiness.description}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${readiness.dotClass}`} />
        {readiness.label}
      </span>
    );
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

  // Helper: Payment status badge renderer with Section 4/5 Logic
  const renderPaymentStatusBadge = (order: CustomOrder) => {
    if (order.quoted_price_lkr === null || order.quoted_price_lkr === undefined) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/50">
          Not Quoted
        </span>
      );
    }

    const price = order.quoted_price_lkr;
    const deposit = order.deposit_amount_lkr ?? 0;
    const paid = order.amount_paid_lkr ?? 0;

    if (paid >= price && price > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Fully Paid
        </span>
      );
    }

    if (deposit > 0 && paid >= deposit) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 border border-teal-500/20">
          <Sparkles className="h-3 w-3 text-teal-600" />
          Deposit Paid
        </span>
      );
    }

    if (deposit > 0 && paid > 0 && paid < deposit) {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-500/20">
            <Clock className="h-3 w-3 text-amber-600" />
            Unpaid
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-500/30">
            Partial Payment Received
          </span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-500/20">
        <Clock className="h-3 w-3 text-amber-600" />
        Unpaid
      </span>
    );
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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportOrdersCsv}
              className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer hover:bg-secondary"
              title="Export filtered custom orders to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
              />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </Button>
          </div>
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
          staffList={staffList}
          currentUserId={user?.id}
          capacitySettings={capacitySettings}
          blackoutDates={blackoutDates}
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
                      dateFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter("upcoming")}
                    className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                      dateFilter === "upcoming"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter("past")}
                    className={`rounded-full px-3 py-1 font-medium transition-colors cursor-pointer ${
                      dateFilter === "past"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
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
                  onChange={(e) =>
                    setSortOption(e.target.value as "newest" | "oldest" | "date_asc" | "date_desc")
                  }
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
              <p className="text-sm text-muted-foreground">
                Loading custom cake orders from Supabase...
              </p>
            </div>
          ) : ordersError ? (
            <div className="rounded-3xl bg-destructive/10 p-8 text-center shadow-soft">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">{ordersError}</p>
              <Button
                variant="outline"
                onClick={() => fetchOrders(true)}
                className="mt-4 rounded-full"
              >
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
                No orders match your active filter settings. Try clearing search keywords or
                resetting status filters.
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
                      <th className="py-4 px-6">Event & Date</th>
                      <th className="py-4 px-6">Status & Readiness</th>
                      <th className="py-4 px-6">Financials</th>
                      <th className="py-4 px-6">Created</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredOrders.map((order) => {
                      const isQuoted =
                        order.quoted_price_lkr !== null && order.quoted_price_lkr !== undefined;
                      const balance = isQuoted
                        ? Math.max((order.quoted_price_lkr ?? 0) - (order.amount_paid_lkr ?? 0), 0)
                        : null;

                      return (
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
                            <p className="text-[11px] text-muted-foreground">
                              {order.customer_email}
                            </p>
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-medium text-foreground">{order.event_type}</p>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3 text-primary" />
                              {formatDate(order.event_date)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1.5 items-start">
                              {renderStatusBadge(order.status)}
                              {renderReadinessBadge(order)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">
                                  {isQuoted ? formatLKR(order.quoted_price_lkr) : "Not Quoted"}
                                </span>
                                {renderPaymentStatusBadge(order)}
                              </div>
                              {isQuoted &&
                                (order.deposit_amount_lkr ?? 0) > 0 &&
                                (order.amount_paid_lkr ?? 0) > 0 &&
                                (order.amount_paid_lkr ?? 0) < (order.deposit_amount_lkr ?? 0) && (
                                  <p className="text-[11px] text-amber-800 font-medium">
                                    {formatLKR(order.amount_paid_lkr)} received (
                                    {formatLKR(
                                      (order.deposit_amount_lkr ?? 0) -
                                        (order.amount_paid_lkr ?? 0),
                                    )}{" "}
                                    to reach deposit)
                                  </p>
                                )}
                              {isQuoted && balance !== null && balance > 0 && (
                                <p className="text-[11px] text-muted-foreground font-medium">
                                  Due:{" "}
                                  <span className="font-semibold text-foreground">
                                    {formatLKR(balance)}
                                  </span>
                                </p>
                              )}
                              {isQuoted && balance === 0 && (
                                <p className="text-[11px] text-emerald-600 font-medium">
                                  Paid in Full
                                </p>
                              )}
                            </div>
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
                              className="rounded-full text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors cursor-pointer"
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
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
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-xl">
                  #{selectedOrder.id.slice(0, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUUID(selectedOrder.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Copy full UUID"
                >
                  {copiedId ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                {renderStatusBadge(selectedOrder.status)}
                {renderReadinessBadge(selectedOrder)}
                {renderPaymentStatusBadge(selectedOrder)}
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

              {/* Customer Direct Communication Shortcuts */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card p-4 border border-border/80 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Customer Communication
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Direct contact options for {selectedOrder.customer_name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Email Client Shortcut */}
                  <a
                    href={getEmailMailtoUrl(
                      selectedOrder.customer_email,
                      `SC FrostHeaven — Custom Cake Order #${selectedOrder.id.slice(0, 8).toUpperCase()}`,
                      `Hello ${selectedOrder.customer_name},\n\nThank you for choosing SC FrostHeaven for your custom cake order (#${selectedOrder.id.slice(0, 8).toUpperCase()}).\n\n\nWarm regards,\nSC FrostHeaven Team\nhello@scfrostheaven.com\n+94 76 123 4567`,
                    )}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 hover:bg-secondary text-foreground px-3.5 py-1.5 text-xs font-semibold border border-border/70 transition-colors shadow-xs"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>Open Email</span>
                  </a>

                  {/* WhatsApp Shortcut */}
                  {(() => {
                    const waUrl = getWhatsAppUrl(
                      selectedOrder.customer_phone,
                      `Hello ${selectedOrder.customer_name}, this is SC FrostHeaven regarding your custom cake order #${selectedOrder.id.slice(0, 8).toUpperCase()}.`,
                    );
                    if (waUrl) {
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-xs"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      );
                    }
                    return (
                      <span
                        title="Valid phone number not provided"
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3.5 py-1.5 text-xs font-medium border border-border cursor-not-allowed opacity-60"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>WhatsApp (No Phone)</span>
                      </span>
                    );
                  })()}
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

              {/* 4b. Structured Quotation & Payment Management Section */}
              <div className="space-y-4 rounded-3xl bg-secondary/15 p-5 border border-border/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Quotation & Payment Management
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Authoritative whole LKR pricing, deposit tracking & payment audit
                      </p>
                    </div>
                  </div>

                  {/* Section Switcher Tabs */}
                  <div className="flex rounded-full bg-secondary/80 p-1 border border-border/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setFinancialSectionTab("overview")}
                      className={`rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                        financialSectionTab === "overview"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialSectionTab("quote")}
                      className={`rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                        financialSectionTab === "quote"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Quotation
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialSectionTab("payment")}
                      className={`rounded-full px-3 py-1 font-semibold transition-all cursor-pointer ${
                        financialSectionTab === "payment"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Record Payment
                    </button>
                  </div>
                </div>

                {/* TAB 1: FINANCIAL OVERVIEW */}
                {financialSectionTab === "overview" && (
                  <div className="space-y-4">
                    {/* Production Readiness Operational State Card */}
                    {(() => {
                      const readiness = getProductionReadiness(selectedOrder);
                      const paymentInfo = getPaymentBadgeInfo(selectedOrder);
                      return (
                        <div
                          className={`rounded-2xl border p-4 text-xs space-y-1.5 ${readiness.bgClass} ${readiness.borderClass}`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-bold flex items-center gap-1.5 text-foreground">
                              <span className={`h-2 w-2 rounded-full ${readiness.dotClass}`} />
                              Production Readiness: {readiness.label}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border ${paymentInfo.badgeClass}`}
                            >
                              {paymentInfo.label}
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            {readiness.description}
                          </p>
                        </div>
                      );
                    })()}
                    {/* Partial Payment Banner (Section 4) */}
                    {selectedOrder.deposit_amount_lkr !== null &&
                      selectedOrder.deposit_amount_lkr !== undefined &&
                      selectedOrder.deposit_amount_lkr > 0 &&
                      (selectedOrder.amount_paid_lkr ?? 0) > 0 &&
                      (selectedOrder.amount_paid_lkr ?? 0) < selectedOrder.deposit_amount_lkr && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span>Partial Payment Received</span>
                          </div>
                          <p className="text-amber-800/90 leading-relaxed">
                            <span className="font-semibold">
                              {formatLKR(selectedOrder.amount_paid_lkr)}
                            </span>{" "}
                            received &bull;{" "}
                            <span className="font-semibold">
                              {formatLKR(
                                (selectedOrder.deposit_amount_lkr ?? 0) -
                                  (selectedOrder.amount_paid_lkr ?? 0),
                              )}
                            </span>{" "}
                            remaining to reach deposit &bull;{" "}
                            <span className="font-semibold">
                              {formatLKR(
                                Math.max(
                                  (selectedOrder.quoted_price_lkr ?? 0) -
                                    (selectedOrder.amount_paid_lkr ?? 0),
                                  0,
                                ),
                              )}
                            </span>{" "}
                            outstanding.
                          </p>
                        </div>
                      )}

                    {/* 4 Summary Stat Tiles */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {/* Total Quote */}
                      <div className="rounded-2xl bg-card p-3.5 border border-border/50 shadow-xs">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Total Quoted
                        </span>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {formatLKR(selectedOrder.quoted_price_lkr)}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedOrder.quote_issued_at
                            ? `Issued ${formatDate(selectedOrder.quote_issued_at)}`
                            : "Not yet quoted"}
                        </span>
                      </div>

                      {/* Required Deposit */}
                      <div className="rounded-2xl bg-card p-3.5 border border-border/50 shadow-xs">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Required Deposit
                        </span>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {formatLKR(selectedOrder.deposit_amount_lkr)}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedOrder.quoted_price_lkr && selectedOrder.deposit_amount_lkr
                            ? `${Math.round((selectedOrder.deposit_amount_lkr / selectedOrder.quoted_price_lkr) * 100)}% of quote`
                            : "—"}
                        </span>
                      </div>

                      {/* Amount Paid */}
                      <div className="rounded-2xl bg-card p-3.5 border border-border/50 shadow-xs">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Amount Paid
                        </span>
                        <p className="text-base font-bold text-emerald-600 mt-0.5">
                          {formatLKR(selectedOrder.amount_paid_lkr ?? 0)}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedOrder.deposit_paid_at
                            ? `Deposit verified ${formatDate(selectedOrder.deposit_paid_at)}`
                            : (selectedOrder.amount_paid_lkr ?? 0) > 0
                              ? "Partial funds recorded"
                              : "No verified funds"}
                        </span>
                      </div>

                      {/* Balance Due */}
                      <div className="rounded-2xl bg-card p-3.5 border border-border/50 shadow-xs">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Outstanding Balance
                        </span>
                        <p className="text-base font-bold text-foreground mt-0.5">
                          {selectedOrder.quoted_price_lkr !== null &&
                          selectedOrder.quoted_price_lkr !== undefined
                            ? formatLKR(
                                Math.max(
                                  (selectedOrder.quoted_price_lkr ?? 0) -
                                    (selectedOrder.amount_paid_lkr ?? 0),
                                  0,
                                ),
                              )
                            : "Not Quoted"}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {(selectedOrder.quoted_price_lkr ?? 0) > 0 &&
                          (selectedOrder.quoted_price_lkr ?? 0) <=
                            (selectedOrder.amount_paid_lkr ?? 0)
                            ? "Fully settled"
                            : selectedOrder.quoted_price_lkr !== null &&
                                selectedOrder.quoted_price_lkr !== undefined
                              ? `${formatLKR(
                                  Math.max(
                                    (selectedOrder.quoted_price_lkr ?? 0) -
                                      (selectedOrder.amount_paid_lkr ?? 0),
                                    0,
                                  ),
                                )} outstanding`
                              : "Awaiting quotation"}
                        </span>
                      </div>
                    </div>

                    {/* Payment Status & Method Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-3.5 border border-border/50 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-muted-foreground font-medium">Payment State:</span>
                        {renderPaymentStatusBadge(selectedOrder)}
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium">Method:</span>
                        <span className="font-semibold text-foreground">
                          {selectedOrder.payment_method
                            ? PAYMENT_METHOD_LABELS[selectedOrder.payment_method] ||
                              selectedOrder.payment_method
                            : "Not recorded"}
                        </span>
                      </div>

                      {selectedOrder.fully_paid_at && (
                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Fully paid on {formatDate(selectedOrder.fully_paid_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Admin-Only Payment Audit Trail */}
                    {(selectedOrder.payment_reference || selectedOrder.payment_notes) && (
                      <div className="space-y-2 rounded-2xl bg-amber-500/5 p-3.5 border border-amber-500/20 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Admin-Only Payment Audit Information</span>
                        </div>
                        {selectedOrder.payment_reference && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Payment Reference:</span>{" "}
                            <span className="font-mono bg-card px-2 py-0.5 rounded border border-border/60 text-foreground">
                              {selectedOrder.payment_reference}
                            </span>
                          </p>
                        )}
                        {selectedOrder.payment_notes && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Audit Notes:</span>{" "}
                            <span className="text-foreground">{selectedOrder.payment_notes}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Quick Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFinancialSectionTab("quote")}
                        className="rounded-full text-xs h-8 px-3 gap-1.5 cursor-pointer shadow-xs"
                      >
                        <BadgePercent className="h-3.5 w-3.5 text-primary" />
                        <span>Edit Quotation</span>
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => setFinancialSectionTab("payment")}
                        disabled={!selectedOrder.quoted_price_lkr}
                        className="rounded-full text-xs h-8 px-3 gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-xs"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Record / Update Payment</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 2: QUOTATION BUILDER */}
                {financialSectionTab === "quote" && (
                  <div className="space-y-4 pt-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>Total Quoted Price (LKR) *</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Whole LKR Integer
                          </span>
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 18500"
                          value={quotedPriceInput}
                          onChange={(e) => setQuotedPriceInput(e.target.value)}
                          className="rounded-xl bg-card border-border/70 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>Required Deposit (LKR)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            &le; Quoted Price
                          </span>
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={quotedPriceInput ? parseInt(quotedPriceInput, 10) || 0 : undefined}
                          step="1"
                          placeholder="e.g. 9250"
                          value={depositAmountInput}
                          onChange={(e) => setDepositAmountInput(e.target.value)}
                          className="rounded-xl bg-card border-border/70 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Quick Deposit Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="text-muted-foreground font-medium">Deposit Presets:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!quotedPriceInput || parseInt(quotedPriceInput, 10) <= 0}
                        onClick={() => {
                          const p = parseInt(quotedPriceInput, 10) || 0;
                          setDepositAmountInput(String(Math.round(p * 0.5)));
                        }}
                        className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                      >
                        50% Deposit (
                        {formatLKR(Math.round((parseInt(quotedPriceInput, 10) || 0) * 0.5))})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!quotedPriceInput || parseInt(quotedPriceInput, 10) <= 0}
                        onClick={() => {
                          setDepositAmountInput(quotedPriceInput);
                        }}
                        className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                      >
                        100% Full Prepayment
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDepositAmountInput("0")}
                        className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                      >
                        No Deposit (0 LKR)
                      </Button>
                    </div>

                    {/* Quote Calculation Preview */}
                    {quotedPriceInput && parseInt(quotedPriceInput, 10) > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl bg-card p-3 border border-border/60 text-xs">
                        <div>
                          <span className="text-muted-foreground">Quoted Total:</span>
                          <p className="font-bold text-foreground">
                            {formatLKR(parseInt(quotedPriceInput, 10))}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Deposit Requirement:</span>
                          <p className="font-bold text-amber-700">
                            {formatLKR(parseInt(depositAmountInput, 10) || 0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Balance on Completion:</span>
                          <p className="font-bold text-foreground">
                            {formatLKR(
                              Math.max(
                                (parseInt(quotedPriceInput, 10) || 0) -
                                  (parseInt(depositAmountInput, 10) || 0),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFinancialSectionTab("overview")}
                        className="rounded-full text-xs cursor-pointer"
                      >
                        Back to Overview
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveQuote}
                        disabled={isSavingQuote}
                        className="rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs"
                      >
                        {isSavingQuote ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Saving Quotation...
                          </>
                        ) : (
                          "Save & Issue Quotation"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: RECORD PAYMENT */}
                {financialSectionTab === "payment" && (
                  <div className="space-y-4 pt-1">
                    {!selectedOrder.quoted_price_lkr ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-900">
                        <AlertCircle className="h-4 w-4 mb-1 text-amber-700" />A structured
                        quotation must be created and saved before payments can be recorded.
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                              <span>Verified Amount Paid (LKR) *</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                Max: {formatLKR(selectedOrder.quoted_price_lkr)}
                              </span>
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max={selectedOrder.quoted_price_lkr}
                              step="1"
                              placeholder="e.g. 9250"
                              value={amountPaidInput}
                              onChange={(e) => setAmountPaidInput(e.target.value)}
                              className="rounded-xl bg-card border-border/70 text-xs font-medium"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                              Payment Collection Method
                            </label>
                            <select
                              value={paymentMethodInput}
                              onChange={(e) => setPaymentMethodInput(e.target.value)}
                              className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                            >
                              <option value="bank_transfer">Bank Transfer</option>
                              <option value="cash_on_pickup">Cash at Bakery / Pickup</option>
                              <option value="card_pos">Card / POS Terminal</option>
                              <option value="online_payment">Online Payment</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                              <span>Payment / Bank Reference</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                Staff only
                              </span>
                            </label>
                            <Input
                              placeholder="e.g. BOC-SLIP-981240, TXN-COMM-291823"
                              value={paymentReferenceInput}
                              onChange={(e) => setPaymentReferenceInput(e.target.value)}
                              className="rounded-xl bg-card border-border/70 text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                              <span>Payment Audit Notes</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                Staff only
                              </span>
                            </label>
                            <Input
                              placeholder="e.g. Verified on Commercial Bank portal by Chamalka"
                              value={paymentNotesInput}
                              onChange={(e) => setPaymentNotesInput(e.target.value)}
                              className="rounded-xl bg-card border-border/70 text-xs"
                            />
                          </div>
                        </div>

                        {/* Quick Payment Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="text-muted-foreground font-medium">
                            Quick Amount Presets:
                          </span>
                          {selectedOrder.deposit_amount_lkr !== null &&
                            selectedOrder.deposit_amount_lkr !== undefined &&
                            selectedOrder.deposit_amount_lkr > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setAmountPaidInput(String(selectedOrder.deposit_amount_lkr))
                                }
                                className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                              >
                                Mark Deposit Paid ({formatLKR(selectedOrder.deposit_amount_lkr)})
                              </Button>
                            )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setAmountPaidInput(String(selectedOrder.quoted_price_lkr))
                            }
                            className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                          >
                            Mark Fully Paid ({formatLKR(selectedOrder.quoted_price_lkr)})
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAmountPaidInput("0")}
                            className="rounded-full text-[11px] h-7 px-2.5 cursor-pointer"
                          >
                            Reset to 0
                          </Button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/40">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFinancialSectionTab("overview")}
                            className="rounded-full text-xs cursor-pointer"
                          >
                            Back to Overview
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSavePayment}
                            disabled={isSavingPayment}
                            className="rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs"
                          >
                            {isSavingPayment ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Saving Payment...
                              </>
                            ) : (
                              "Save Payment Record"
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 4c. KITCHEN SCHEDULING & STAFF ASSIGNMENT (Phase 7E) */}
              <div className="space-y-4 rounded-3xl bg-secondary/15 p-5 border border-border/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-700">
                      <ChefHat className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Kitchen Scheduling & Staff Assignment
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Assign Baker & Decorator, schedule bake/decorate dates, and set workload
                        units
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveKitchenAssignment}
                      disabled={isSavingKitchenAssignment}
                      className="rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs font-semibold"
                    >
                      {isSavingKitchenAssignment ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Kitchen Details"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Assigned Baker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-purple-600" />
                      Assigned Baker
                    </label>
                    <select
                      value={orderBakerId}
                      onChange={(e) => setOrderBakerId(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getStaffDisplayName(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned Decorator */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-pink-600" />
                      Assigned Decorator
                    </label>
                    <select
                      value={orderDecoratorId}
                      onChange={(e) => setOrderDecoratorId(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getStaffDisplayName(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scheduled Bake Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Scheduled Bake Date</span>
                      {orderBakeDate && (
                        <button
                          type="button"
                          onClick={() => setOrderBakeDate("")}
                          className="text-[10px] text-muted-foreground hover:text-rose-500 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={orderBakeDate}
                      onChange={(e) => setOrderBakeDate(e.target.value)}
                      className="rounded-xl bg-card border-border/70 text-xs"
                    />
                  </div>

                  {/* Scheduled Decorate Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Scheduled Decorate Date</span>
                      {orderDecorateDate && (
                        <button
                          type="button"
                          onClick={() => setOrderDecorateDate("")}
                          className="text-[10px] text-muted-foreground hover:text-rose-500 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={orderDecorateDate}
                      onChange={(e) => setOrderDecorateDate(e.target.value)}
                      className="rounded-xl bg-card border-border/70 text-xs"
                    />
                  </div>

                  {/* Target Pickup Time */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Target Pickup Time</span>
                      {orderPickupTime && (
                        <button
                          type="button"
                          onClick={() => setOrderPickupTime("")}
                          className="text-[10px] text-muted-foreground hover:text-rose-500 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <Input
                      type="time"
                      value={orderPickupTime}
                      onChange={(e) => setOrderPickupTime(e.target.value)}
                      className="rounded-xl bg-card border-border/70 text-xs"
                    />
                  </div>

                  {/* Production Priority */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Production Priority
                    </label>
                    <select
                      value={orderPriority}
                      onChange={(e) => setOrderPriority(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Complexity Units Slider */}
                <div className="space-y-2 rounded-2xl bg-card p-3.5 border border-border/70">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Complexity / Workload Units:</span>
                    <span className="text-primary font-bold">
                      {Number(orderComplexity).toFixed(1)} Units
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={orderComplexity}
                    onChange={(e) => setOrderComplexity(parseFloat(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setOrderComplexity(1.0)}
                      className="hover:text-primary cursor-pointer"
                    >
                      1.0u (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderComplexity(2.0)}
                      className="hover:text-primary cursor-pointer"
                    >
                      2.0u (2-Tier)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderComplexity(4.0)}
                      className="hover:text-primary cursor-pointer"
                    >
                      4.0u (3+ Tiers)
                    </button>
                  </div>
                </div>

                {/* Live Preview Notices */}
                {(() => {
                  if (!selectedOrder) return null;
                  const bakerStaff = staffList.find((s) => s.id === orderBakerId);
                  const decoratorStaff = staffList.find((s) => s.id === orderDecoratorId);

                  const bakerPreview =
                    orderBakerId && orderBakeDate && bakerStaff
                      ? previewStaffAssignmentImpact(
                          orderBakeDate,
                          orderBakerId,
                          getStaffDisplayName(bakerStaff),
                          selectedOrder.id,
                          orderComplexity,
                          "baker",
                          orders as any,
                        )
                      : null;

                  const decoratorPreview =
                    orderDecoratorId && orderDecorateDate && decoratorStaff
                      ? previewStaffAssignmentImpact(
                          orderDecorateDate,
                          orderDecoratorId,
                          getStaffDisplayName(decoratorStaff),
                          selectedOrder.id,
                          orderComplexity,
                          "decorator",
                          orders as any,
                        )
                      : null;

                  if (!bakerPreview?.warningMessage && !decoratorPreview?.warningMessage)
                    return null;

                  return (
                    <div className="space-y-2 pt-1">
                      {bakerPreview?.warningMessage && (
                        <div
                          className={`flex items-start gap-1.5 rounded-xl p-2.5 text-[11px] ${bakerPreview.isOverloaded ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20" : "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                          <span>
                            <strong>Baker:</strong> {bakerPreview.warningMessage}
                          </span>
                        </div>
                      )}
                      {decoratorPreview?.warningMessage && (
                        <div
                          className={`flex items-start gap-1.5 rounded-xl p-2.5 text-[11px] ${decoratorPreview.isOverloaded ? "bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/20" : "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                          <span>
                            <strong>Decorator:</strong> {decoratorPreview.warningMessage}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Customer Message & Internal Bakery Notes Dual Editor */}
              <div className="space-y-4">
                {/* Customer Facing Message */}
                <div className="space-y-2 rounded-2xl bg-primary/5 p-4 sm:p-5 border border-primary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <FileText className="h-4 w-4" />
                        Message to Customer (Quotation & Updates)
                      </h4>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                        Customer Visible
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Visible to customer on their account order tracking page
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Enter quote pricing details, flavor options, pickup instructions, or celebration notes for the customer..."
                    value={customerMessageText}
                    onChange={(e) => setCustomerMessageText(e.target.value)}
                    className="rounded-2xl bg-card border-border/60 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tip: Use this field to give the customer instructions, pickup timeframes, or
                    flavor confirmation notes. Empty messages are automatically hidden from the
                    customer view.
                  </p>
                </div>

                {/* Internal Bakery / Kitchen Notes */}
                <div className="space-y-2 rounded-2xl bg-secondary/30 p-4 sm:p-5 border border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Internal Bakery Notes
                      </h4>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
                        Staff Only — Private
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Bakery staff & kitchen run sheet only — Never shared with customer
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Enter private kitchen notes, tier assembly details, color mixing ratios, or staff reminders..."
                    value={internalNotesText}
                    onChange={(e) => setInternalNotesText(e.target.value)}
                    className="rounded-2xl bg-card border-border/60 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-full bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs font-semibold"
                  >
                    {isSavingNotes ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving Notes...
                      </>
                    ) : (
                      "Save Notes & Message"
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
                Order ID:{" "}
                <span className="font-mono text-foreground">#{selectedOrder.id.slice(0, 8)}</span>
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
          bakerName={
            staffList.find((s) => s.id === ticketOrder.assigned_baker_id)
              ? getStaffDisplayName(staffList.find((s) => s.id === ticketOrder.assigned_baker_id))
              : undefined
          }
          decoratorName={
            staffList.find((s) => s.id === ticketOrder.assigned_decorator_id)
              ? getStaffDisplayName(
                  staffList.find((s) => s.id === ticketOrder.assigned_decorator_id),
                )
              : undefined
          }
          onClose={() => setTicketOrder(null)}
        />
      )}
    </div>
  );
}
