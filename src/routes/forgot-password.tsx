import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — SC Frost Heaven" },
      {
        name: "description",
        content: "Reset your SC Frost Heaven account password.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      if (error) {
        toast.error(error.message || "Failed to send reset link. Please try again.");
        return;
      }

      setIsSubmitted(true);
      toast.success("Password reset link sent to your email!");
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-card p-8 shadow-soft sm:p-10">
        {isSubmitted ? (
          <div className="text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush text-primary">
              <MailCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground">Check Your Email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-semibold text-foreground">{email}</span>. Click the link in the email to set a new password.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="inline-block rounded-full bg-blush px-3.5 py-1 text-xs font-medium text-blush-foreground">
                Account Recovery
              </span>
              <h1 className="mt-4 text-3xl font-medium text-foreground">Forgot Password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the email address associated with your account and we&apos;ll send you a link to reset your password
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-xl"
                  autoComplete="email"
                />
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
                    Sending link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
