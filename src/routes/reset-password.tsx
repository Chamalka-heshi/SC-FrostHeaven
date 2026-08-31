import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — SC Frost Heaven" },
      {
        name: "description",
        content: "Set a new password for your SC Frost Heaven account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if recovery token or active session exists
    if (!loading) {
      if (session) {
        setHasValidSession(true);
      } else {
        // Also check hash fragment directly if loaded via email link
        const hash = window.location.hash;
        if (hash && (hash.includes("type=recovery") || hash.includes("access_token"))) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
        }
      }
    }
  }, [session, loading]);

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!password) {
      toast.error("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        toast.error(error.message || "Failed to update password. Your reset link may have expired.");
        return;
      }

      toast.success("Password updated successfully! You can now log in with your new password.");
      navigate({ to: "/login" });
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-card p-8 shadow-soft sm:p-10">
        {hasValidSession === false ? (
          <div className="text-center space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground">Link Expired or Invalid</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This password reset link is invalid, expired, or has already been used. Please request a new link.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/forgot-password"
                className="inline-flex w-full justify-center rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blush text-primary">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-medium text-foreground">Set New Password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Please enter and confirm your new password below
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="mt-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="rounded-xl pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isSubmitting}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <Input
                    id="confirmNewPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="rounded-xl"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
