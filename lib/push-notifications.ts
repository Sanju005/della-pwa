import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  getAppBaseUrl,
  getFirebaseClientEmail,
  getFirebasePrivateKey,
  getFirebaseProjectId,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

type PushNotificationInput = {
  body: string;
  bookingId?: string;
  path?: string;
  title: string;
  // Structured fields for native (Flutter) clients to route a tap without
  // parsing the web `path`. `type` is the broad category the client
  // switches on ("booking" | "payment" | "message"); `event` is the exact
  // underlying event name — reuses the same status/event identifiers the
  // backend already uses internally, no second naming scheme.
  type?: string;
  event?: string;
  conversationId?: string;
  senderId?: string;
};

type DeviceRow = {
  fcm_token: string | null;
};

type AccessTokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

let accessTokenCache: AccessTokenCache = null;

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getFirebaseCredentials() {
  const projectId = getFirebaseProjectId();
  const clientEmail = getFirebaseClientEmail();
  const privateKey = getFirebasePrivateKey()?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[Push] Firebase server credentials are incomplete.");
    return null;
  }

  return {
    clientEmail,
    privateKey,
    projectId,
  };
}

function getAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    console.warn("[Push] Supabase admin client is not configured.");
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getGoogleAccessToken() {
  const credentials = getFirebaseCredentials();

  if (!credentials) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (accessTokenCache && accessTokenCache.expiresAt > now + 60) {
    return accessTokenCache.accessToken;
  }

  const jwtHeader = {
    alg: "RS256",
    typ: "JWT",
  };

  const jwtPayload = {
    iss: credentials.clientEmail,
    sub: credentials.clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(jwtHeader))}.${base64UrlEncode(JSON.stringify(jwtPayload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(credentials.privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${unsignedToken}.${signature}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  }).catch((error) => {
    console.error("[Push] Failed to request Google access token:", error);
    return null;
  });

  if (!tokenResponse?.ok) {
    const responseText = await tokenResponse?.text().catch(() => "");
    console.error("[Push] Google access token request failed:", responseText);
    return null;
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!tokenData.access_token) {
    console.error("[Push] Google access token response did not include a token.");
    return null;
  }

  accessTokenCache = {
    accessToken: tokenData.access_token,
    expiresAt: now + Math.max((tokenData.expires_in ?? 3600) - 60, 60),
  };

  return tokenData.access_token;
}

async function loadDeviceTokensForUser(userId: string) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return [];
  }

  // No platform filter: a user can have web, Android, and iOS devices at
  // once, and every registered token should receive the push.
  const { data, error } = await adminClient
    .from("user_devices")
    .select("fcm_token")
    .eq("user_id", userId);

  if (error) {
    console.error("[Push] Failed to load user device tokens:", error);
    return [];
  }

  const tokens = ((data ?? []) as DeviceRow[])
    .map((row) => row.fcm_token?.trim() ?? "")
    .filter(Boolean);

  // Dedupe in case stale/duplicate rows exist so we never send the same
  // push twice to the same token.
  return [...new Set(tokens)];
}

async function removeDeviceToken(token: string) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return;
  }

  const { error } = await adminClient
    .from("user_devices")
    .delete()
    .eq("fcm_token", token);

  if (error) {
    console.error("[Push] Failed to remove invalid FCM token:", error);
  }
}

function buildTargetLink(path?: string) {
  if (!path) {
    return undefined;
  }

  const appBaseUrl = getAppBaseUrl();

  if (!appBaseUrl) {
    return path;
  }

  return new URL(path, appBaseUrl).toString();
}

export async function sendPushNotificationToUser(
  userId: string,
  notification: PushNotificationInput
) {
  const credentials = getFirebaseCredentials();

  if (!credentials) {
    console.warn("[Push] Skipping push send because Firebase server env is missing.");
    return { delivered: 0, failed: 0 };
  }

  const tokens = await loadDeviceTokensForUser(userId);

  if (tokens.length === 0) {
    console.log(`[Push] No device tokens found for user ${userId}.`);
    return { delivered: 0, failed: 0 };
  }

  const accessToken = await getGoogleAccessToken();

  if (!accessToken) {
    return { delivered: 0, failed: tokens.length };
  }

  const targetLink = buildTargetLink(pathOrFallback(notification));
  let delivered = 0;
  let failed = 0;

  for (const token of tokens) {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              bookingId: notification.bookingId ?? "",
              path: pathOrFallback(notification),
              ...(notification.type ? { type: notification.type } : {}),
              ...(notification.event ? { event: notification.event } : {}),
              ...(notification.conversationId
                ? { conversationId: notification.conversationId }
                : {}),
              ...(notification.senderId
                ? { senderId: notification.senderId }
                : {}),
            },
            webpush: {
              fcmOptions: targetLink
                ? {
                    link: targetLink,
                  }
                : undefined,
              notification: {
                icon: "/icon.png",
              },
            },
          },
        }),
      }
    ).catch((error) => {
      console.error("[Push] Failed to send FCM message:", error);
      return null;
    });

    if (response?.ok) {
      delivered += 1;
      continue;
    }

    failed += 1;

    const errorText = (await response?.text().catch(() => "")) ?? "";
    console.error(`[Push] FCM send failed for token ${token.slice(0, 12)}...:`, errorText);

    if (
      errorText.includes("UNREGISTERED") ||
      errorText.includes("registration-token-not-registered") ||
      errorText.includes("INVALID_ARGUMENT")
    ) {
      await removeDeviceToken(token);
    }
  }

  console.log(
    `[Push] Push send finished for user ${userId}. Delivered: ${delivered}, Failed: ${failed}.`
  );

  return { delivered, failed };
}

function pathOrFallback(notification: PushNotificationInput) {
  if (notification.path) {
    return notification.path;
  }

  if (notification.bookingId) {
    return `/profile/notifications?booking=${notification.bookingId}`;
  }

  return "/profile/notifications";
}
