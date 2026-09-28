import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { AdminProfile, AuthAccess } from "../types";

type AuthContextValue = {
  access: AuthAccess;
  authError: string | null;
  initialized: boolean;
  profile: AdminProfile | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Swiper uses only super_admin/provider/customer as real roles today — admin,
// manager, and customer_care were never assigned to any live account and
// have been removed from every authorization check (see
// SWIPER_CRITICAL_SECURITY_REMEDIATION.md in the repo root).
const ALLOWED_ADMIN_ROLES = new Set(["super_admin"]);

const PROFILE_CACHE_KEY = "della-admin-profile";

type CachedAdminProfile = Pick<AdminProfile, "id" | "email" | "full_name" | "role" | "status">;

function isAllowedRole(role: string | null | undefined) {
  return role ? ALLOWED_ADMIN_ROLES.has(role) : false;
}

function readCachedProfile(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedAdminProfile | null;
    if (!parsed || parsed.id !== userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: CachedAdminProfile | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!profile) {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
    return;
  }

  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [access, setAccess] = useState<AuthAccess>("guest");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth.");
      setInitialized(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setInitialized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitialized(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setAccess("guest");
      writeCachedProfile(null);
      return;
    }

    const fallbackProfile: AdminProfile = {
      id: session.user.id,
      full_name:
        typeof session.user.user_metadata?.full_name === "string"
          ? session.user.user_metadata.full_name
          : null,
      email: session.user.email ?? null,
      role: null,
      status: null,
    };

    const cachedProfile = readCachedProfile(session.user.id);
    if (cachedProfile) {
      setProfile(cachedProfile);
      setAccess(isAllowedRole(cachedProfile.role) ? "allowed" : "denied");
    } else {
      setProfile(fallbackProfile);
      setAccess("guest");
    }

    if (!supabase) {
      setProfile(fallbackProfile);
      setAccess("denied");
      return;
    }

    let cancelled = false;
    const activeSession = session;
    const activeSupabase = supabase;

    async function loadProfile() {
      const { data, error } = await activeSupabase
        .from("profiles")
        .select("id, full_name, email, role, status")
        .eq("id", activeSession.user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error || !data) {
        setProfile(fallbackProfile);
        setAccess("denied");
        writeCachedProfile(null);
        return;
      }

      const liveProfile: AdminProfile = {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        status: data.status,
      };

      setProfile(liveProfile);
      setAccess(isAllowedRole(liveProfile.role) ? "allowed" : "denied");
      writeCachedProfile(liveProfile);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      access,
      authError,
      initialized,
      profile,
      session,
      async signIn(email, password) {
        if (!supabase) {
          return "Supabase environment variables are missing.";
        }

        setAuthError(null);

        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            return "Wrong credentials";
          }

          setSession(data.session ?? null);
          return null;
        } catch (error) {
          return error instanceof Error ? "Wrong credentials" : "Unable to sign in right now.";
        }
      },
      async signOut() {
        if (!supabase) {
          return;
        }

        setSession(null);
        setProfile(null);
        setAccess("guest");
        writeCachedProfile(null);
        await supabase.auth.signOut();
      },
    }),
    [access, authError, initialized, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
