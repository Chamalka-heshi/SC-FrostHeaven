import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  role: "customer" | "admin";
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  avatarUrl: string | null;
  authProviders: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, address, city, role, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Could not fetch user profile:", error.message);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.warn("Unexpected error fetching profile:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).then((userProfile) => {
          if (isMounted) {
            setProfile(userProfile);
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // 2. Realtime auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id);
        if (isMounted) {
          setProfile(userProfile);
        }
      } else {
        setProfile(null);
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const avatarUrl =
    (user?.user_metadata?.["avatar_url"] as string | undefined) ||
    (user?.user_metadata?.["picture"] as string | undefined) ||
    profile?.avatar_url ||
    null;

  const authProviders: string[] = (() => {
    if (!user) return [];
    const providers = new Set<string>();
    if (user.app_metadata?.["provider"]) {
      providers.add(String(user.app_metadata["provider"]));
    }
    if (Array.isArray(user.app_metadata?.["providers"])) {
      user.app_metadata["providers"].forEach((p) => providers.add(String(p)));
    }
    if (Array.isArray(user.identities)) {
      user.identities.forEach((i) => {
        if (i.provider) providers.add(i.provider);
      });
    }
    return Array.from(providers);
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        avatarUrl,
        authProviders,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
