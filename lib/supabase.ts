import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./supabase-env";

let browserClient: SupabaseClient | null | undefined;
const MAX_SAFE_ACCESS_TOKEN_LENGTH = 12_000;

declare global {
  interface Window {
    __DELLA_PUBLIC_CONFIG?: {
      supabaseUrl?: string | null;
      supabasePublishableKey?: string | null;
      appBaseUrl?: string | null;
      firebaseApiKey?: string | null;
      firebaseAuthDomain?: string | null;
      firebaseProjectId?: string | null;
      firebaseStorageBucket?: string | null;
      firebaseMessagingSenderId?: string | null;
      firebaseAppId?: string | null;
      firebaseVapidKey?: string | null;
    };
  }
}

function getRuntimeSupabaseConfig() {
  if (typeof window !== "undefined" && window.__DELLA_PUBLIC_CONFIG) {
    return {
      url: window.__DELLA_PUBLIC_CONFIG.supabaseUrl ?? null,
      publishableKey:
        window.__DELLA_PUBLIC_CONFIG.supabasePublishableKey ?? null,
    };
  }

  return {
    url: getSupabaseUrl(),
    publishableKey: getSupabasePublishableKey(),
  };
}

export function getSupabaseClient() {
  if (browserClient !== undefined) {
    return browserClient;
  }

  const { url, publishableKey } = getRuntimeSupabaseConfig();

  if (!url || !publishableKey) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

export function clearSupabaseBrowserSession() {
  if (typeof window === "undefined") {
    return;
  }

  const clearStorage = (storage: Storage) => {
    const keysToRemove: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (
        key &&
        (key.startsWith("sb-") ||
          key.includes("supabase") ||
          key.includes("gotrue"))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  };

  try {
    clearStorage(window.localStorage);
  } catch {
    // Some embedded browsers can block storage access.
  }

  try {
    clearStorage(window.sessionStorage);
  } catch {
    // Some embedded browsers can block storage access.
  }

  try {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();

      if (
        name &&
        (name.startsWith("sb-") ||
          name.includes("supabase") ||
          name.includes("gotrue"))
      ) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    });
  } catch {
    // Cookie access can be restricted in some embedded browsers.
  }

  browserClient = undefined;
}

export function isOversizedAccessToken(session: Session | null | undefined) {
  return (session?.access_token?.length ?? 0) > MAX_SAFE_ACCESS_TOKEN_LENGTH;
}

export async function getFreshSupabaseSession(client: SupabaseClient) {
  let session: Session | null = null;

  try {
    const current = await client.auth.getSession();
    session = current.data.session;
  } catch {
    session = null;
  }

  try {
    const refreshed = await client.auth.refreshSession();
    session = refreshed.data.session ?? session;
  } catch {
    if (isOversizedAccessToken(session)) {
      clearSupabaseBrowserSession();
      return null;
    }
  }

  if (isOversizedAccessToken(session)) {
    clearSupabaseBrowserSession();
    return null;
  }

  return session;
}

export async function signOutLocally(client: SupabaseClient | null) {
  try {
    await client?.auth.signOut({ scope: "local" });
  } catch {
    // Network failures should not block local logout.
  } finally {
    clearSupabaseBrowserSession();
  }
}

export const supabase =
  typeof window === "undefined" ? null : getSupabaseClient();
