import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { createNoIndexMeta } from "@/lib/seo";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/register")({
  head: () => createNoIndexMeta("Register"),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);

  // If already logged in, redirect home
  if (user) {
    navigate({ to: "/" });
  }

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isFacebookLoading || isSubmitting) return;
    setIsGoogleLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to initiate Google sign-in. Please try again.");
        setIsGoogleLoading(false);
      }
    } catch (err) {
      console.error("Unexpected Google OAuth error:", err);
      toast.error("An unexpected error occurred connecting to Google.");
      setIsGoogleLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    if (isFacebookLoading || isGoogleLoading || isSubmitting) return;
    setIsFacebookLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "email,public_profile",
        },
      });

      if (error) {
        toast.error(error.message || "Failed to initiate Facebook sign-in. Please try again.");
        setIsFacebookLoading(false);
      }
    } catch (err) {
      console.error("Unexpected Facebook OAuth error:", err);
      toast.error("An unexpected error occurred connecting to Facebook.");
      setIsFacebookLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || isGoogleLoading || isFacebookLoading) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!trimmedEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!password) {
      toast.error("Please create a password.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes("user already registered") ||
          signUpError.message.toLowerCase().includes("already registered")
        ) {
          toast.error("An account with this email already exists. Please log in instead.");
        } else if (signUpError.message.toLowerCase().includes("password")) {
          toast.error(signUpError.message);
        } else {
          toast.error(signUpError.message || "Failed to create account. Please try again.");
        }
        return;
      }

      // 2. Profile record creation
      if (data.user) {
        // If an active session was returned (email confirmation disabled or auto-confirmed)
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email ?? trimmedEmail,
          full_name: trimmedName,
          role: "customer",
        });

        if (profileError) {
          console.warn("Notice updating profile after registration:", profileError.message);
        }

        if (data.session) {
          toast.success("Account created successfully! Welcome to SC Frost Heaven.");
          navigate({ to: "/" });
        } else {
          // Email confirmation is required by Supabase project settings
          toast.success(
            "Account created! Please check your email inbox to confirm your email before logging in.",
            { duration: 6000 }
          );
          navigate({ to: "/login" });
        }
      }
    } catch (err) {
      console.error("Unexpected registration error:", err);
      toast.error("An unexpected error occurred during registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-card p-8 shadow-soft sm:p-10 border border-border/60">
        <div className="text-center">
          <span className="inline-block rounded-full bg-blush px-3.5 py-1 text-xs font-medium text-blush-foreground">
            Join Frost Heaven
          </span>
          <h1 className="mt-4 text-3xl font-medium text-foreground">Create an Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up to track your custom orders and manage your sweet celebrations
          </p>
        </div>

        {/* SOCIAL OAUTH ACTIONS */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isFacebookLoading || isSubmitting}
            className="w-full rounded-full border-border/80 bg-background text-foreground hover:bg-secondary/70 shadow-xs font-medium gap-3 h-12 transition-colors cursor-pointer"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4" />
                <span>Continue with Google</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleFacebookSignIn}
            disabled={isGoogleLoading || isFacebookLoading || isSubmitting}
            className="w-full rounded-full border-border/80 bg-background text-foreground hover:bg-secondary/70 shadow-xs font-medium gap-3 h-12 transition-colors cursor-pointer"
          >
            {isFacebookLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#1877F2]" />
                <span>Connecting to Facebook...</span>
              </>
            ) : (
              <>
                <FacebookIcon className="h-4 w-4" />
                <span>Continue with Facebook</span>
              </>
            )}
          </Button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/70" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground font-medium">
                Or continue with email
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
                className="rounded-xl"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
                className="rounded-xl"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
                  className="rounded-xl pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
                className="rounded-xl"
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSubmitting || isGoogleLoading || isFacebookLoading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Log in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
