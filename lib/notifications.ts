import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase";
import { getSupabaseClient } from "./supabase";

function getFirebaseVapidKey() {
  if (typeof window !== "undefined" && window.__DELLA_PUBLIC_CONFIG) {
    return window.__DELLA_PUBLIC_CONFIG.firebaseVapidKey ?? "";
  }

  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
}

let lastPushError = "";

export type PushSetupState = {
  hasSavedToken: boolean;
  permission: NotificationPermission | "unsupported";
};

export type PushSupportDiagnostics = {
  hasWindow: boolean;
  hasNotificationApi: boolean;
  hasServiceWorkerApi: boolean;
  hasPushManagerApi: boolean;
  hasIndexedDb: boolean;
  permission: NotificationPermission | "unsupported";
};

async function ensureMessagingServiceWorker() {
  return navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((error) => {
    lastPushError =
      error instanceof Error ? error.message : "Failed to register messaging service worker.";
    console.error("[FCM] Service worker registration failed:", error);
    throw error;
  });
}

async function getCurrentNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported" as const;
  }

  return Notification.permission;
}

export { getCurrentNotificationPermission };

export async function getCurrentFCMToken() {
  try {
    lastPushError = "";
    const permission = await getCurrentNotificationPermission();

    if (permission !== "granted") {
      lastPushError = `Notification permission is ${permission}.`;
      console.warn(`[FCM] Cannot get token because permission is ${permission}.`);
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      lastPushError = "Firebase messaging is unavailable in this browser.";
      console.warn("[FCM] Firebase messaging is unavailable.");
      return null;
    }

    const firebaseVapidKey = getFirebaseVapidKey();

    if (!firebaseVapidKey) {
      lastPushError = "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.";
      console.error("[FCM] Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.");
      return null;
    }

    const serviceWorkerRegistration = await ensureMessagingServiceWorker().catch((error) => {
      lastPushError =
        error instanceof Error ? error.message : "Unable to register the messaging service worker.";
      console.error("[FCM] Unable to register messaging service worker:", error);
      return null;
    });

    if (!serviceWorkerRegistration) {
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration,
    }).catch((error) => {
      lastPushError =
        error instanceof Error ? error.message : "Firebase could not create a push token.";
      console.error("[FCM] Failed to get Firebase token:", error);
      return null;
    });

    if (!token) {
      lastPushError ||= "Firebase returned no token for this device.";
    }

    return token;
  } catch (error) {
    lastPushError =
      error instanceof Error ? error.message : "Unexpected error while loading push token.";
    console.error("[FCM] Unexpected error while loading token:", error);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    console.warn("[FCM] Notifications are not available in this environment.");
    return null;
  }

  const permission = await Notification.requestPermission().catch((error) => {
    console.error("[FCM] Failed to request notification permission:", error);
    return "default" as NotificationPermission;
  });

  if (permission !== "granted") {
    console.warn(`[FCM] Notification permission not granted: ${permission}`);
    return null;
  }

  return getCurrentFCMToken();
}

export async function saveFCMToken(fcmToken: string) {
  try {
    if (!fcmToken) {
      console.warn("[FCM] No token received. Skipping save.");
      return { success: false, error: "Missing FCM token." };
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      console.error("[FCM] Supabase client is not configured.");
      return { success: false, error: "Supabase client is not configured." };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[FCM] Unable to load current Supabase user:", userError);
      return { success: false, error: userError?.message || "User not found." };
    }

    console.log("[FCM] Saving token for user:", user.id);

    const { error } = await supabase.from("user_devices").upsert(
      {
        user_id: user.id,
        fcm_token: fcmToken,
        platform: "web",
      },
      {
        onConflict: "user_id,fcm_token",
      }
    );

    if (error) {
      console.error("[FCM] Failed to save token to user_devices:", error);
      return { success: false, error: error.message };
    }

    console.log("[FCM] Token saved successfully.");
    return { success: true };
  } catch (error) {
    console.error("[FCM] Unexpected error while saving token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function disablePushNotifications() {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      console.error("[FCM] Supabase client is not configured.");
      return { success: false, error: "Supabase client is not configured." };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[FCM] Unable to load current Supabase user:", userError);
      return { success: false, error: userError?.message || "User not found." };
    }

    const token = await getCurrentFCMToken();

    if (token) {
      const { error: deleteDbError } = await supabase
        .from("user_devices")
        .delete()
        .eq("user_id", user.id)
        .eq("fcm_token", token);

      if (deleteDbError) {
        console.error("[FCM] Failed to remove token from user_devices:", deleteDbError);
        return { success: false, error: deleteDbError.message };
      }

      const messaging = await getFirebaseMessaging();

      if (messaging) {
        const deleted = await deleteToken(messaging).catch((error) => {
          console.error("[FCM] Failed to delete Firebase token:", error);
          return false;
        });

        console.log(`[FCM] Firebase token deletion status: ${deleted}`);
      }
    } else {
      const { error: deleteDbError } = await supabase
        .from("user_devices")
        .delete()
        .eq("user_id", user.id)
        .eq("platform", "web");

      if (deleteDbError) {
        console.error("[FCM] Failed to remove web push records:", deleteDbError);
        return { success: false, error: deleteDbError.message };
      }
    }

    console.log("[FCM] Push notifications disabled for this web device.");
    return { success: true };
  } catch (error) {
    console.error("[FCM] Unexpected error while disabling push:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getPushSetupState(): Promise<PushSetupState> {
  try {
    const permission = await getCurrentNotificationPermission();

    if (permission === "unsupported") {
      return {
        permission,
        hasSavedToken: false,
      };
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return {
        permission,
        hasSavedToken: false,
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        permission,
        hasSavedToken: false,
      };
    }

    const token = permission === "granted" ? await getCurrentFCMToken() : null;

    if (!token) {
      return {
        permission,
        hasSavedToken: false,
      };
    }

    const { data, error } = await supabase
      .from("user_devices")
      .select("fcm_token")
      .eq("user_id", user.id)
      .eq("fcm_token", token)
      .eq("platform", "web")
      .maybeSingle();

    if (error) {
      console.error("[FCM] Failed to load push setup state:", error);
    }

    return {
      permission,
      hasSavedToken: Boolean(data?.fcm_token),
    };
  } catch (error) {
    console.error("[FCM] Unexpected error while loading push setup state:", error);
    return {
      permission: "unsupported",
      hasSavedToken: false,
    };
  }
}

export async function getPushSupportDiagnostics(): Promise<PushSupportDiagnostics> {
  const permission = await getCurrentNotificationPermission();

  return {
    hasWindow: typeof window !== "undefined",
    hasNotificationApi: typeof Notification !== "undefined",
    hasServiceWorkerApi:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
    hasPushManagerApi: typeof PushManager !== "undefined",
    hasIndexedDb: typeof indexedDB !== "undefined",
    permission,
  };
}

export function getLastPushError() {
  return lastPushError;
}

export async function subscribeToForegroundPush(
  onNotificationClick?: (path: string) => void,
) {
  const permission = await getCurrentNotificationPermission();

  if (permission !== "granted") {
    return () => undefined;
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return () => undefined;
  }

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "DELLA";
    const body = payload.notification?.body || "You have a new update.";
    const path = payload.data?.path || "/profile/notifications";

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        icon: "/icon.png",
      });

      notification.onclick = () => {
        notification.close();
        if (onNotificationClick) {
          onNotificationClick(path);
          return;
        }

        if (typeof window !== "undefined") {
          window.location.href = path;
        }
      };
    }
  });
}
