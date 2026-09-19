import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createNoIndexMeta } from "@/lib/seo";

export const Route = createFileRoute("/auth/callback")({
  head: () => createNoIndexMeta("Authentication"),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. Check for provider error parameters in search or hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const errorDescription =
          urlParams.get("error_description") ||
          hashParams.get("error_description") ||
          urlParams.get("error") ||
          hashParams.get("error");

        if (errorDescription) {
          console.warn("OAuth provider callback error:", errorDescription);
          toast.error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
          navigate({ to: "/login" });
          return;
        }

        // 2. Check for password recovery flow
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          navigate({ to: "/reset-password" });
          return;
        }

        // 3. Complete code exchange / retrieve active session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          toast.error("Authentication failed. Please try logging in again.");
          navigate({ to: "/login" });
          return;
        }

        if (data.session) {
          toast.success("Welcome to SC Frost Heaven!");
          navigate({ to: "/" });
        } else {
          navigate({ to: "/login" });
        }
      } catch (err) {
        console.error("Unexpected callback exception:", err);
        toast.error("An unexpected error occurred during authentication.");
        navigate({ to: "/login" });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-hero px-4 py-12">
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Authenticating, please wait...</p>
      </div>
    </div>
  );
}
