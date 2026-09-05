import { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  RefreshCw,
  Clock,
  User,
  Mail,
  Phone,
  X,
  Loader2,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Send,
  Archive,
  Eye,
  Calendar,
  ExternalLink,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exportToCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/admin/inquiries")({
  head: () => ({
    meta: [
      { title: "Inquiry Management — SC Frost Heaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminInquiriesPage,
});

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "unread" | "read" | "responded" | "archived";
  created_at: string;
}

const INQUIRY_STATUSES = [
  {
    key: "unread",
    label: "Unread",
    color: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    key: "read",
    label: "Read",
    color: "bg-indigo-500",
    text: "text-indigo-700",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
  },
  {
    key: "responded",
    label: "Responded",
    color: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    key: "archived",
    label: "Archived",
    color: "bg-zinc-500",
    text: "text-zinc-700",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
  },
] as const;

function AdminInquiriesPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unread" | "read" | "responded" | "archived"
  >("all");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "unread_first" | "name_asc" | "name_desc"
  >("newest");

  // Selected Inquiry Modal State
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
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

  // 2. Fetch Inquiries from Supabase
  const fetchInquiries = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoadingData(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("contact_inquiries")
        .select("id, name, email, phone, message, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setInquiries((data as ContactInquiry[]) || []);
      setLastUpdated(new Date());

      if (isManual) {
        toast.success("Inquiries refreshed.");
      }
    } catch (err: unknown) {
      console.error("Inquiries fetch error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Unable to load customer inquiries.");
      toast.error("Could not load inquiries from Supabase.");
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchInquiries();
    }
  }, [profile, fetchInquiries]);

  // 3. Update Inquiry Status in Supabase
  const handleUpdateStatus = async (inquiryId: string, newStatus: ContactInquiry["status"]) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("contact_inquiries")
        .update({ status: newStatus })
        .eq("id", inquiryId);

      if (error) throw error;

      // Update state locally
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === inquiryId ? { ...inq, status: newStatus } : inq)),
      );

      if (selectedInquiry && selectedInquiry.id === inquiryId) {
        setSelectedInquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      toast.success(`Inquiry status updated to ${newStatus}.`);
    } catch (err: unknown) {
      console.error("Status update error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update inquiry status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 4. Derived Summary Metrics
  const metrics = useMemo(() => {
    const total = inquiries.length;
    const unread = inquiries.filter((i) => i.status === "unread").length;
    const read = inquiries.filter((i) => i.status === "read").length;
    const respondedOrArchived = inquiries.filter(
      (i) => i.status === "responded" || i.status === "archived",
    ).length;

    return { total, unread, read, respondedOrArchived };
  }, [inquiries]);

  // 5. Search, Filter & Sorting Logic
  const filteredInquiries = useMemo(() => {
    return inquiries
      .filter((item) => {
        // Search Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const nameMatch = item.name.toLowerCase().includes(query);
          const emailMatch = item.email.toLowerCase().includes(query);
          const phoneMatch = (item.phone || "").toLowerCase().includes(query);
          const messageMatch = item.message.toLowerCase().includes(query);
          const idMatch = item.id.toLowerCase().includes(query);

          if (!nameMatch && !emailMatch && !phoneMatch && !messageMatch && !idMatch) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter !== "all" && item.status !== statusFilter) {
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
        if (sortOption === "unread_first") {
          if (a.status === "unread" && b.status !== "unread") return -1;
          if (b.status === "unread" && a.status !== "unread") return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortOption === "name_asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortOption === "name_desc") {
          return b.name.localeCompare(a.name);
        }
        return 0;
      });
  }, [inquiries, searchQuery, statusFilter, sortOption]);

  const handleExportInquiriesCsv = () => {
    const headers = [
      "Inquiry ID",
      "Customer Name",
      "Email",
      "Phone",
      "Message",
      "Status",
      "Received Date",
    ];
    const rows = inquiries.map((i) => [
      i.id,
      i.name,
      i.email,
      i.phone || "",
      i.message,
      i.status,
      i.created_at,
    ]);
    const dateStamp = new Date().toISOString().split("T")[0];
    exportToCsv(`inquiries-${dateStamp}.csv`, headers, rows);
    toast.success("Inquiries exported to CSV.");
  };

  // Helper: Status badge renderer
  const renderStatusBadge = (status: ContactInquiry["status"]) => {
    switch (status) {
      case "unread":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unread
          </span>
        );
      case "read":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-500/20">
            <Eye className="h-3 w-3" />
            Read
          </span>
        );
      case "responded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Responded
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-zinc-700 border border-zinc-500/20">
            <Archive className="h-3 w-3" />
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border">
            {status}
          </span>
        );
    }
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

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "Not specified";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  // Helper: Initials Generator
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
    return "IN";
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
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground sm:text-3xl">
                Inquiry Management
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review, triage, and manage customer messages, questions, and custom requests.
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
            onClick={handleExportInquiriesCsv}
            disabled={loadingData || inquiries.length === 0}
            className="rounded-full gap-2 border-border/80 shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchInquiries(true)}
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
            <h3 className="text-sm font-medium text-destructive">Unable to load inquiries</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInquiries()}
            className="rounded-full border-destructive/30 text-destructive cursor-pointer"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* 2. Key Inquiry Metrics (4 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Inquiries */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total Inquiries</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.total
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">All customer messages</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Unread */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Unread</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.unread
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Requires initial review</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <Inbox className="h-5 w-5" />
          </div>
        </div>

        {/* Read */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Read</span>
            <p className="text-2xl font-bold text-indigo-700 mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.read
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">In triage / evaluation</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
            <Eye className="h-5 w-5" />
          </div>
        </div>

        {/* Responded / Archived */}
        <div className="flex items-center justify-between rounded-3xl bg-card p-5 shadow-soft border border-border/60">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Responded / Archived</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {loadingData ? (
                <span className="text-muted-foreground animate-pulse">...</span>
              ) : (
                metrics.respondedOrArchived
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Resolved contact items</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Search, Filter & Sorting Bar */}
      <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/60 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, message content, ID..."
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
              onChange={(e) => setStatusFilter(e.target.value as "all" | ContactInquiry["status"])}
              className="w-full rounded-2xl border border-border/70 bg-secondary/20 px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Statuses ({inquiries.length})</option>
              <option value="unread">Unread ({metrics.unread})</option>
              <option value="read">Read ({metrics.read})</option>
              <option value="responded">
                Responded ({inquiries.filter((i) => i.status === "responded").length})
              </option>
              <option value="archived">
                Archived ({inquiries.filter((i) => i.status === "archived").length})
              </option>
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
              All ({inquiries.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("unread")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "unread"
                  ? "bg-amber-500 text-white font-semibold"
                  : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
              }`}
            >
              Unread ({metrics.unread})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("read")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "read"
                  ? "bg-indigo-500 text-white font-semibold"
                  : "bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20"
              }`}
            >
              Read ({metrics.read})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("responded")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "responded"
                  ? "bg-emerald-500 text-white font-semibold"
                  : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
              }`}
            >
              Responded ({inquiries.filter((i) => i.status === "responded").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("archived")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === "archived"
                  ? "bg-zinc-700 text-white font-semibold"
                  : "bg-zinc-500/10 text-zinc-700 hover:bg-zinc-500/20"
              }`}
            >
              Archived ({inquiries.filter((i) => i.status === "archived").length})
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
                  e.target.value as "newest" | "oldest" | "unread_first" | "name_asc" | "name_desc",
                )
              }
              className="rounded-xl border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="unread_first">Unread First</option>
              <option value="name_asc">Sender Name (A to Z)</option>
              <option value="name_desc">Sender Name (Z to A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Inquiry List (Desktop Table & Mobile Cards) */}
      <div className="space-y-4">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-card py-20 shadow-soft border border-border/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Loading inquiries from Supabase...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Inbox className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No inquiries match your current filters"
                  : "No customer inquiries yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Try clearing your search terms or selecting another status filter."
                  : "Customer contact messages submitted on the Contact page will appear here."}
              </p>
            </div>
            {(searchQuery || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
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
                    <th className="py-4 pl-6 pr-3">Sender</th>
                    <th className="py-4 px-3">Email</th>
                    <th className="py-4 px-3">Phone</th>
                    <th className="py-4 px-3">Message Preview</th>
                    <th className="py-4 px-3">Submitted</th>
                    <th className="py-4 px-3">Status</th>
                    <th className="py-4 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {filteredInquiries.map((inquiry) => {
                    const initials = getInitials(inquiry.name);
                    return (
                      <tr
                        key={inquiry.id}
                        className={`group transition-colors hover:bg-secondary/20 ${
                          inquiry.status === "unread" ? "bg-amber-500/[0.02]" : ""
                        }`}
                      >
                        {/* Sender Column */}
                        <td className="py-4 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                              {initials}
                            </div>
                            <div>
                              <span className="font-medium text-foreground block">
                                {inquiry.name}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{inquiry.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email Column */}
                        <td className="py-4 px-3 text-xs">
                          <a
                            href={`mailto:${inquiry.email}`}
                            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{inquiry.email}</span>
                          </a>
                        </td>

                        {/* Phone Column */}
                        <td className="py-4 px-3 text-xs text-muted-foreground">
                          {inquiry.phone ? (
                            <a
                              href={`tel:${inquiry.phone}`}
                              className="hover:text-primary transition-colors flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{inquiry.phone}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Message Preview Column */}
                        <td className="py-4 px-3 text-xs text-foreground max-w-xs">
                          <p className="truncate line-clamp-1">{inquiry.message}</p>
                        </td>

                        {/* Submitted Column */}
                        <td className="py-4 px-3 text-xs text-muted-foreground">
                          {formatDate(inquiry.created_at)}
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-3">{renderStatusBadge(inquiry.status)}</td>

                        {/* Actions Column */}
                        <td className="py-4 pl-3 pr-6 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedInquiry(inquiry);
                              if (inquiry.status === "unread") {
                                handleUpdateStatus(inquiry.id, "read");
                              }
                            }}
                            className="rounded-full text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          >
                            <span>View / Manage</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE RESPONSIVE CARDS */}
            <div className="grid gap-4 lg:hidden">
              {filteredInquiries.map((inquiry) => {
                const initials = getInitials(inquiry.name);
                return (
                  <div
                    key={inquiry.id}
                    className={`rounded-3xl bg-card p-5 shadow-soft border border-border/70 space-y-3.5 ${
                      inquiry.status === "unread" ? "border-amber-500/40 bg-amber-500/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground text-sm">{inquiry.name}</h3>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            #{inquiry.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      {renderStatusBadge(inquiry.status)}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">{inquiry.email}</span>
                      </div>
                      {inquiry.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <span>{inquiry.phone}</span>
                        </div>
                      )}
                      <div className="rounded-2xl bg-secondary/30 p-3 text-xs text-foreground line-clamp-2">
                        {inquiry.message}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(inquiry.created_at)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedInquiry(inquiry);
                          if (inquiry.status === "unread") {
                            handleUpdateStatus(inquiry.id, "read");
                          }
                        }}
                        className="rounded-full text-xs cursor-pointer"
                      >
                        View / Manage
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. Inquiry Details Modal / Drawer */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                  {getInitials(selectedInquiry.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-foreground">{selectedInquiry.name}</h2>
                    {renderStatusBadge(selectedInquiry.status)}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Inquiry ID: #{selectedInquiry.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SENDER CONTACT METADATA */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-secondary/20 p-4 border border-border/50 text-xs">
                <div>
                  <span className="text-muted-foreground">Sender Name:</span>
                  <p className="font-semibold text-foreground text-sm mt-0.5">
                    {selectedInquiry.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email Address:</span>
                  <p className="font-semibold text-foreground text-sm mt-0.5">
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedInquiry.email}
                    </a>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone Number:</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {selectedInquiry.phone ? (
                      <a href={`tel:${selectedInquiry.phone}`} className="hover:text-primary">
                        {selectedInquiry.phone}
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted Timestamp:</span>
                  <p className="font-medium text-muted-foreground mt-0.5">
                    {formatDateTime(selectedInquiry.created_at)}
                  </p>
                </div>
              </div>

              {/* MESSAGE CONTENT */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Inquiry Message:
                </span>
                <div className="rounded-2xl bg-muted/30 p-5 border border-border/60 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>

              {/* STATUS MANAGEMENT */}
              <div className="space-y-3 rounded-2xl bg-secondary/20 p-4 border border-border/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Update Workflow Status:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {INQUIRY_STATUSES.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      disabled={isUpdatingStatus || selectedInquiry.status === st.key}
                      onClick={() => handleUpdateStatus(selectedInquiry.id, st.key)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        selectedInquiry.status === st.key
                          ? `${st.color} text-white font-semibold shadow-xs`
                          : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* REPLY ACTION */}
              <div className="rounded-2xl bg-blush/30 p-4 border border-blush/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blush-foreground flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-primary" />
                    Customer Direct Response
                  </span>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                      "Re: SC FrostHeaven Inquiry",
                    )}&body=${encodeURIComponent(
                      `Hi ${selectedInquiry.name},\n\nThank you for reaching out to SC FrostHeaven!\n\nIn reference to your inquiry:\n"${selectedInquiry.message}"\n\n\nBest regards,\nSC FrostHeaven Team\nhello@scfrostheaven.com\n+94 76 123 4567`,
                    )}`}
                    onClick={() => {
                      if (selectedInquiry.status !== "responded") {
                        handleUpdateStatus(selectedInquiry.id, "responded");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Reply via Email</span>
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Clicking &quot;Reply via Email&quot; opens your default mail application prefilled
                  with the customer&apos;s email address and inquiry context.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 bg-card">
              <span className="text-xs text-muted-foreground">
                Current Status:{" "}
                <span className="font-semibold text-foreground uppercase">
                  {selectedInquiry.status}
                </span>
              </span>
              <Button
                variant="outline"
                onClick={() => setSelectedInquiry(null)}
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
