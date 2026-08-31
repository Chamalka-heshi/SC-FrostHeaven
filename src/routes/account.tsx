import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/account")({
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

function AccountPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<"orders" | "profile">("orders");
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Selected order details state
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [orderImages, setOrderImages] = useState<OrderImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

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
          "id, customer_id, customer_name, customer_email, customer_phone, event_type, event_date, cake_details, status, admin_notes, created_at, updated_at"
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error("Error loading customer orders:", err);
      setOrdersError(err.message || "Failed to load your orders");
    } finally {
      setLoadingOrders(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  // 3. Order Details & Reference Images Handler with Strict Ownership Verification
  const handleOpenOrder = async (order: CustomOrder) => {
    // Security check: Confirm the order belongs to the current authenticated user
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
        // Generate secure signed URLs from private 'cake-references' bucket
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
          })
        );
        setOrderImages(imagesWithSignedUrls);
      }
    } catch (err: any) {
      console.error("Error loading order images:", err);
      toast.error("Could not load reference photos for this order.");
    } finally {
      setLoadingImages(false);
    }
  };

  // 4. Profile Update Handler
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
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error(err.message || "Failed to update profile. Please try again.");
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
      case "reviewed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-500/20">
            Reviewed
          </span>
        );
      case "quote_sent":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-500/20">
            Quote Sent
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-500/20">
            <Clock className="h-3 w-3" />
            In Progress
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-500/20">
            Ready
          </span>
        );
      case "delivered":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-500/20">
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
    return null; // Will redirect via useEffect
  }

  const customerDisplayName = profile?.full_name || user.email?.split("@")[0] || "Valued Customer";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-hero px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Account Header Banner */}
        <div className="flex flex-col gap-6 rounded-3xl bg-card p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
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
              className="rounded-full border-border text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
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
              <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
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
            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-16 shadow-soft">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading your custom cake orders...</p>
              </div>
            ) : ordersError ? (
              <div className="rounded-3xl bg-destructive/10 p-8 text-center shadow-soft">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
                <p className="text-sm font-medium text-destructive">{ordersError}</p>
                <Button
                  variant="outline"
                  onClick={fetchOrders}
                  className="mt-4 rounded-full border-destructive/30 text-destructive"
                >
                  Try Again
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-3xl bg-card p-12 text-center shadow-soft space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush text-primary">
                  <Cake className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-medium text-foreground">No Custom Orders Yet</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  You haven&apos;t placed any custom cake orders yet. Have an upcoming celebration or dream cake in mind?
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
            ) : (
              <div className="grid gap-4 sm:gap-6">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="group flex flex-col justify-between gap-4 rounded-3xl bg-card p-6 shadow-soft transition-all hover:shadow-md sm:flex-row sm:items-center sm:p-7"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-mono font-medium text-muted-foreground">
                          #{order.id.slice(0, 8)}
                        </span>
                        {renderStatusBadge(order.status)}
                        <span className="text-xs text-muted-foreground">
                          Requested on {formatDate(order.created_at)}
                        </span>
                      </div>

                      <h3 className="text-lg font-medium text-foreground">
                        {order.event_type} Celebration
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          Event Date: {formatDate(order.event_date)}
                        </span>
                      </div>

                      <p className="line-clamp-2 text-xs text-muted-foreground/90 max-w-2xl mt-1">
                        {order.cake_details}
                      </p>
                    </div>

                    <div className="pt-2 sm:pt-0">
                      <Button
                        variant="secondary"
                        onClick={() => handleOpenOrder(order)}
                        className="w-full rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors sm:w-auto"
                      >
                        <span>View Details</span>
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROFILE SETTINGS */}
        {activeTab === "profile" && (
          <div className="rounded-3xl bg-card p-6 shadow-soft sm:p-8">
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
                  className="rounded-full gap-1.5"
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
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
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
                    className="rounded-full"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
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
                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Full Name</span>
                    <p className="text-sm font-medium text-foreground">
                      {profile?.full_name || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Email Address</span>
                    <p className="text-sm font-medium text-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Phone Number</span>
                    <p className="text-sm font-medium text-foreground">
                      {profile?.phone || "No phone number added"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-secondary/20 p-4">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">City & Address</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    #{selectedOrder.id.slice(0, 8)}
                  </span>
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
              {/* Order Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-secondary/20 p-4 sm:grid-cols-3">
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

              {/* Admin / Bakery Notes (if any) */}
              {selectedOrder.admin_notes && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Note from the Bakery Team
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {selectedOrder.admin_notes}
                  </p>
                </div>
              )}

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
            <div className="flex items-center justify-end border-t border-border/60 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE IMAGE PREVIEW LIGHTBOX */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
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
    </div>
  );
}
