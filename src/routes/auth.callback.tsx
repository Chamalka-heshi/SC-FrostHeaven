import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Check for code exchange if PKCE is used or session from hash
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Auth callback error:", error);
        navigate({ to: "/login" });
        return;
      }

      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        navigate({ to: "/reset-password" });
      } else if (data.session) {
        navigate({ to: "/" });
      } else {
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
