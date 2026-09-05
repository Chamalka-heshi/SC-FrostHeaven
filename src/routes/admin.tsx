import { useState, useEffect } from "react";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LayoutDashboard,
  BarChart3,
  Cake,
  MessageSquare,
  Star,
  Users,
  Shield,
  Store,
  User,
  LogOut,
  Menu,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import logo from "../assets/logo.png";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — SC Frost Heaven" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const adminNavLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/orders", label: "Custom Orders", icon: Cake },
  { to: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/customers", label: "Customers", icon: Users },
];

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // 1. Strict Admin Authorization Guard
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate({ to: "/login" });
      } else if (profile && profile.role !== "admin") {
        toast.error("Access restricted: Administrator privileges required.");
        navigate({ to: "/account" });
      }
    }
  }, [loading, user, profile, navigate]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      toast.success("Signed out of Administrator session.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading || !user || !profile || profile.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-7 w-7" />
            <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Verifying Administrator Access...</p>
            <p className="text-xs text-muted-foreground mt-1">SC Frost Heaven Security Gateway</p>
          </div>
        </div>
      </div>
    );
  }

  const adminName = profile.full_name || user.email?.split("@")[0] || "Administrator";

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* DESKTOP FIXED SIDEBAR */}
      <aside className="hidden w-64 flex-col border-r border-border/80 bg-card lg:flex">
        {/* Sidebar Header */}
        <div className="flex h-20 items-center gap-3 border-b border-border/60 px-6">
          <img src={logo} alt="SC Frost Heaven" className="h-10 w-auto" />
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Admin Portal
            </span>
            <h2 className="text-sm font-medium text-foreground">Frost Heaven</h2>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Operations
          </div>
          {adminNavLinks.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-80" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Links */}
        <div className="border-t border-border/60 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          >
            <Store className="h-4 w-4 text-primary" />
            <span>View Public Storefront</span>
          </Link>
          <Link
            to="/account"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          >
            <User className="h-4 w-4 text-primary" />
            <span>Customer Account</span>
          </Link>
        </div>
      </aside>

      {/* MOBILE SLIDE-OUT DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 max-w-xs flex-col bg-card border-r border-border shadow-soft z-50 p-6">
            <div className="flex items-center justify-between pb-6 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <img src={logo} alt="SC Frost Heaven" className="h-9 w-auto" />
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Admin Portal
                  </span>
                  <h2 className="text-xs font-medium text-foreground">Frost Heaven</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 py-6">
              {adminNavLinks.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border/60 pt-4 space-y-2">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Store className="h-4 w-4 text-primary" />
                <span>Public Storefront</span>
              </Link>
              <Link
                to="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <User className="h-4 w-4 text-primary" />
                <span>Customer Account</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MAIN ADMIN CONTENT WRAPPER */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border/70 bg-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground lg:hidden cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-medium text-foreground">FrostHeaven Bakery</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Shield className="h-3 w-3" />
                  Administrator
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Operations & Store Management</p>
            </div>
          </div>

          {/* Right Top Bar Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 rounded-full bg-secondary/80 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xs">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[140px] truncate">{adminName}</span>
            </div>

            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Return to Storefront"
            >
              <Store className="h-3.5 w-3.5" />
              <span>Storefront</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
              title="Sign Out of Admin Session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* OUTLET FOR ADMIN SUB-PAGES */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
