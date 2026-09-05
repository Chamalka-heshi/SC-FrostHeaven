import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Star,
  Search,
  RefreshCw,
  Clock,
  User,
  X,
  Loader2,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  AlertTriangle,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exportToCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Review Moderation — SC Frost Heaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReviewsPage,
});

export interface ReviewItem {
  id: string;
  customer_id: string | null;
  customer_name: string;
  rating: number;
  comment: string;
  occasion: string | null;
  is_approved: boolean;
  created_at: string;
}

function AdminReviewsPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "highest_rating" | "lowest_rating" | "name_asc" | "pending_first"
  >("newest");

  // Selected Review Details Modal State
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  // Delete Confirmation Modal State
  const [reviewToDelete, setReviewToDelete] = useState<ReviewItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  // 2. Fetch All Reviews from Supabase
  const fetchReviews = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoadingData(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "id, customer_id, customer_name, rating, comment, occasion, is_approved, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews((data as ReviewItem[]) || []);
      setLastUpdated(new Date());

      if (isManual) {
        toast.success("Reviews refreshed.");
      }
    } catch (err: unknown) {
      console.error("Reviews fetch error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Unable to load customer reviews.");
      toast.error("Could not load reviews from Supabase.");
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchReviews();
    }
  }, [profile, fetchReviews]);

  // 3. Moderation: Approve or Unapprove/Hide Review
  const handleToggleApproval = async (reviewId: string, newApprovedState: boolean) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ is_approved: newApprovedState })
        .eq("id", reviewId);

      if (error) throw error;

      // Update state locally
      setReviews((prev) =>
        prev.map((rev) => (rev.id === reviewId ? { ...rev, is_approved: newApprovedState } : rev)),
      );

      if (selectedReview && selectedReview.id === reviewId) {
        setSelectedReview((prev) => (prev ? { ...prev, is_approved: newApprovedState } : null));
      }

      toast.success(
        newApprovedState
          ? "Review approved and published to website."
          : "Review hidden from website.",
      );
    } catch (err: unknown) {
      console.error("Approval update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update review status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 4. Moderation: Delete Review
  const handleConfirmDelete = async () => {
    if (!reviewToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewToDelete.id);

      if (error) throw error;

      // Remove from local state
      setReviews((prev) => prev.filter((rev) => rev.id !== reviewToDelete.id));

      if (selectedReview && selectedReview.id === reviewToDelete.id) {
        setSelectedReview(null);
      }

      toast.success("Review deleted successfully.");
      setReviewToDelete(null);
    } catch (err: unknown) {
      console.error("Delete review error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete review.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 5. Derived Summary Metrics
  const metrics = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter((r) => !r.is_approved).length;
    const approved = reviews.filter((r) => r.is_approved).length;
    const avg =
      total > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / total).toFixed(1) : "0.0";

    return { total, pending, approved, avg };
  }, [reviews]);

  // 6. Search, Filter & Sorting Logic
  const filteredReviews = useMemo(() => {
    return reviews
      .filter((item) => {
        // Search Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const nameMatch = item.customer_name.toLowerCase().includes(query);
          const commentMatch = item.comment.toLowerCase().includes(query);
          const occasionMatch = (item.occasion || "").toLowerCase().includes(query);
          const idMatch = item.id.toLowerCase().includes(query);

          if (!nameMatch && !commentMatch && !occasionMatch && !idMatch) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter === "pending" && item.is_approved) return false;
        if (statusFilter === "approved" && !item.is_approved) return false;

        // Rating Filter
        if (ratingFilter !== "all" && item.rating !== parseInt(ratingFilter, 10)) {
          return false;
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
        if (sortOption === "highest_rating") {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "lowest_rating") {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "name_asc") {
          return a.customer_name.localeCompare(b.customer_name);
        }
        if (sortOption === "pending_first") {
          if (!a.is_approved && b.is_approved) return -1;
          if (a.is_approved && !b.is_approved) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [reviews, searchQuery, statusFilter, ratingFilter, sortOption]);

  const handleExportReviewsCsv = () => {
    const headers = [
      "Review ID",
      "Customer ID",
      "Customer Name",
      "Rating",
      "Occasion",
      "Comment",
      "Approved",
      "Submitted Date",
    ];
    const rows = reviews.map((r) => [
      r.id,
      r.customer_id || "",
      r.customer_name,
      r.rating,
      r.occasion || "",
      r.comment,
      r.is_approved ? "Yes" : "No",
      r.created_at,
    ]);
    const dateStamp = new Date().toISOString().split("T")[0];
    exportToCsv(`reviews-${dateStamp}.csv`, headers, rows);
    toast.success("Reviews exported to CSV.");
  };

  // Helper: Status badge renderer
  const renderStatusBadge = (isApproved: boolean) => {
    if (isApproved) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Approved / Published
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Approval
      </span>
    );
  };

  // Helper: Date formatters
  const formatDate = (dateStr: string) => {
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

  const getInitials = (name: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      const first = parts[0] ?? "";
      const second = parts[1] ?? "";
      if (first && second) {
        return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
      }
      if (first) {
        return first.slice(0, 2).toUpperCase();
      }
    }
    return "RV";
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
              <Star className="h-5 w-5 fill-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">Customer Reviews</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Moderate customer feedback, approve ratings, and manage website testimonials.
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
            onClick={handleExportReviewsCsv}
            disabled={loadingData || reviews.length === 0}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchReviews(true)}
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

      {/* ERROR STATE */}
      {errorMessage && (
        <div className="rounded-3xl bg-destructive/10 p-6 text-center shadow-soft border border-destructive/20 space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-sm font-medium text-destructive">
              Unable to load customer reviews
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReviews()}
            className="rounded-full border-destructive/30 text-destructive cursor-pointer"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* 2. Key Review Metrics (4 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Reviews */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total Reviews</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.total
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">All customer feedback</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
            <Star className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Pending Approval */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Pending Approval</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.pending
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting moderation</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Approved / Published */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Approved & Published</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.approved
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Live on testimonials page</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Average Rating */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Average Rating</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                `${metrics.avg} / 5.0`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across all reviews</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Sparkles className="h-5 w-5" />
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
              placeholder="Search by customer name, comment, occasion, ID..."
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

          {/* Status Dropdown Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "approved")}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Moderation ({reviews.length})</option>
              <option value="pending">Pending Approval ({metrics.pending})</option>
              <option value="approved">Approved / Live ({metrics.approved})</option>
            </select>
          </div>

          {/* Rating Dropdown Filter */}
          <div>
            <select
              value={ratingFilter}
              onChange={(e) =>
                setRatingFilter(e.target.value as "all" | "1" | "2" | "3" | "4" | "5")
              }
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Ratings (1–5 Stars)</option>
              <option value="5">5 Stars (★★★★★)</option>
              <option value="4">4 Stars (★★★★☆)</option>
              <option value="3">3 Stars (★★★☆☆)</option>
              <option value="2">2 Stars (★★☆☆☆)</option>
              <option value="1">1 Star (★☆☆☆☆)</option>
            </select>
          </div>
        </div>

        {/* Sorting Row & Quick Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({reviews.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "pending"
                  ? "bg-amber-500 text-white font-semibold"
                  : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
              }`}
            >
              Pending ({metrics.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("approved")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "approved"
                  ? "bg-emerald-500 text-white font-semibold"
                  : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
              }`}
            >
              Approved ({metrics.approved})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1 font-medium">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
            </span>
            <select
              value={sortOption}
              onChange={(e) =>
                setSortOption(
                  e.target.value as
                    | "newest"
                    | "oldest"
                    | "pending_first"
                    | "highest_rating"
                    | "lowest_rating"
                    | "name_asc",
                )
              }
              className="rounded-xl border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="pending_first">Pending First</option>
              <option value="highest_rating">Highest Rating</option>
              <option value="lowest_rating">Lowest Rating</option>
              <option value="name_asc">Customer Name (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Review List (Desktop Table & Mobile Cards) */}
      <div className="space-y-4">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-20 shadow-soft border border-border/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading reviews from Supabase...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Inbox className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">
                {searchQuery || statusFilter !== "all" || ratingFilter !== "all"
                  ? "No reviews match your current filters"
                  : "No customer reviews yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || ratingFilter !== "all"
                  ? "Try clearing your search terms or selecting other filter options."
                  : "Customer ratings and feedback submitted on the website will appear here for moderation."}
              </p>
            </div>
            {(searchQuery || statusFilter !== "all" || ratingFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setRatingFilter("all");
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
                    <th className="py-4 px-3">Rating</th>
                    <th className="py-4 px-3">Occasion</th>
                    <th className="py-4 px-3">Review Comment</th>
                    <th className="py-4 px-3">Submitted</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 pl-3 pr-6 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {filteredReviews.map((review) => {
                    const initials = getInitials(review.customer_name);
                    return (
                      <tr
                        key={review.id}
                        className={`group transition-colors hover:bg-secondary/20 ${
                          !review.is_approved ? "bg-amber-500/[0.02]" : ""
                        }`}
                      >
                        {/* Customer Column */}
                        <td className="py-4 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                              {initials}
                            </div>
                            <div>
                              <span className="font-medium text-foreground block">
                                {review.customer_name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{review.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Rating Column */}
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-1">
                            <div className="flex text-amber-500">
                              {[...Array(5)].map((_, j) => (
                                <Star
                                  key={j}
                                  className={`h-3.5 w-3.5 ${
                                    j < review.rating
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-foreground ml-1">
                              {review.rating}
                            </span>
                          </div>
                        </td>

                        {/* Occasion Column */}
                        <td className="py-4 px-3 text-xs">
                          {review.occasion ? (
                            <span className="rounded-full bg-blush/60 px-2.5 py-0.5 text-[11px] font-semibold text-blush-foreground">
                              {review.occasion}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Comment Preview Column */}
                        <td className="py-4 px-3 text-xs text-foreground max-w-xs">
                          <p className="truncate line-clamp-1 italic">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        </td>

                        {/* Submitted Column */}
                        <td className="py-4 px-3 text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-3">{renderStatusBadge(review.is_approved)}</td>

                        {/* Moderation Actions Column */}
                        <td className="py-4 pl-3 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {review.is_approved ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdatingStatus}
                                onClick={() => handleToggleApproval(review.id, false)}
                                className="rounded-full text-xs h-7 px-2.5 gap-1 border-border/80 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/30 cursor-pointer"
                                title="Hide from storefront"
                              >
                                <EyeOff className="h-3 w-3" />
                                <span>Hide</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdatingStatus}
                                onClick={() => handleToggleApproval(review.id, true)}
                                className="rounded-full text-xs h-7 px-2.5 gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500 hover:text-white cursor-pointer"
                                title="Approve and publish to website"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Approve</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedReview(review)}
                              className="rounded-full text-xs h-7 px-2.5 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                            >
                              <span>View</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReviewToDelete(review)}
                              className="rounded-full text-xs h-7 px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                              title="Delete review"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE RESPONSIVE CARDS */}
            <div className="grid gap-4 lg:hidden">
              {filteredReviews.map((review) => {
                const initials = getInitials(review.customer_name);
                return (
                  <div
                    key={review.id}
                    className={`rounded-3xl bg-card p-5 shadow-soft border border-border/70 space-y-3.5 ${
                      !review.is_approved ? "border-amber-500/40 bg-amber-500/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground text-sm">
                            {review.customer_name}
                          </h3>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            #{review.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      {renderStatusBadge(review.is_approved)}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-500">
                        {[...Array(5)].map((_, j) => (
                          <Star
                            key={j}
                            className={`h-4 w-4 ${
                              j < review.rating
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                        <span className="text-xs font-bold text-foreground ml-1">
                          {review.rating} / 5
                        </span>
                      </div>

                      {review.occasion && (
                        <span className="rounded-full bg-blush/60 px-2.5 py-0.5 text-[11px] font-semibold text-blush-foreground">
                          {review.occasion}
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl bg-secondary/30 p-3 text-xs text-foreground italic leading-relaxed">
                      &ldquo;{review.comment}&rdquo;
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {review.is_approved ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdatingStatus}
                            onClick={() => handleToggleApproval(review.id, false)}
                            className="rounded-full text-xs h-7 px-2.5 cursor-pointer"
                          >
                            Hide
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isUpdatingStatus}
                            onClick={() => handleToggleApproval(review.id, true)}
                            className="rounded-full text-xs h-7 px-2.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            Approve
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedReview(review)}
                          className="rounded-full text-xs h-7 px-2.5 cursor-pointer"
                        >
                          View
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReviewToDelete(review)}
                          className="rounded-full text-xs h-7 px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. Review Details Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                  {getInitials(selectedReview.customer_name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-foreground">
                      {selectedReview.customer_name}
                    </h2>
                    {renderStatusBadge(selectedReview.is_approved)}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Review ID: #{selectedReview.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* RATING & OCCASION BANNER */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-secondary/20 p-4 border border-border/50 text-xs">
                <div>
                  <span className="text-muted-foreground">Rating Score:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, j) => (
                        <Star
                          key={j}
                          className={`h-4 w-4 ${
                            j < selectedReview.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-foreground text-sm">
                      {selectedReview.rating} of 5 Stars
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">Celebration Occasion:</span>
                  <p className="font-semibold text-foreground text-sm mt-1">
                    {selectedReview.occasion || "General Bakery Experience"}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Submission Date:</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {formatDate(selectedReview.created_at)}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground">Customer Profile ID:</span>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {selectedReview.customer_id
                      ? `#${selectedReview.customer_id.slice(0, 12)}...`
                      : "Guest Review"}
                  </p>
                </div>
              </div>

              {/* REVIEW COMMENT */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer Testimonial:
                </span>
                <div className="rounded-2xl bg-muted/30 p-5 border border-border/60 text-sm text-foreground leading-relaxed italic whitespace-pre-wrap">
                  &ldquo;{selectedReview.comment}&rdquo;
                </div>
              </div>

              {/* MODERATION ACTIONS IN MODAL */}
              <div className="rounded-2xl bg-secondary/20 p-4 border border-border/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Publication Status:
                  </span>
                  <p className="text-xs text-foreground mt-0.5">
                    {selectedReview.is_approved
                      ? "This review is currently APPROVED and visible on the website."
                      : "This review is currently PENDING and hidden from the website."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedReview.is_approved ? (
                    <Button
                      variant="outline"
                      disabled={isUpdatingStatus}
                      onClick={() => handleToggleApproval(selectedReview.id, false)}
                      className="rounded-full text-xs gap-1.5 cursor-pointer"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide Review</span>
                    </Button>
                  ) : (
                    <Button
                      disabled={isUpdatingStatus}
                      onClick={() => handleToggleApproval(selectedReview.id, true)}
                      className="rounded-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approve & Publish</span>
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReviewToDelete(selectedReview);
                    }}
                    className="rounded-full text-xs text-destructive hover:bg-destructive/10 gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-card">
              <span className="text-xs text-muted-foreground">
                Status:{" "}
                <span className="font-semibold text-foreground uppercase">
                  {selectedReview.is_approved ? "Approved" : "Pending"}
                </span>
              </span>
              <Button
                variant="outline"
                onClick={() => setSelectedReview(null)}
                className="rounded-full text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Dialog */}
      {reviewToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-soft border border-border/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Delete Review Permanently?
                </h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>

            <div className="rounded-2xl bg-secondary/30 p-3 text-xs text-foreground space-y-1">
              <p className="font-medium">Customer: {reviewToDelete.customer_name}</p>
              <p className="italic line-clamp-2">&ldquo;{reviewToDelete.comment}&rdquo;</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => setReviewToDelete(null)}
                className="rounded-full text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="rounded-full text-xs gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Review</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
