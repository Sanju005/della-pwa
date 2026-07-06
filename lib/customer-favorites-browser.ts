"use client";

const FAVORITES_STORAGE_KEY = "della.customer.favorite-provider-ids";

export function loadStoredFavoriteProviderIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);

  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string" && value.trim()) : []);
  } catch {
    return new Set<string>();
  }
}

export function saveStoredFavoriteProviderIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]));
}

export function clearStoredFavoriteProviderIds() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(FAVORITES_STORAGE_KEY);
}

export function isFavoriteSchemaUnavailable(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("favorite") &&
    (normalized.includes("schema") ||
      normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("migration"))
  );
}
