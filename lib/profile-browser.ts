"use client";

import { getSupabaseClient } from "./supabase";
import type { CustomerProfile } from "./profile-types";

const PROFILE_STORAGE_KEY = "della.customer.profile";

function normalizeStoredCustomerProfile(value: unknown): CustomerProfile | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<CustomerProfile>;

  return {
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    sex: raw.sex === "Male" || raw.sex === "Female" ? raw.sex : "Male",
    dateOfBirth: raw.dateOfBirth ?? "",
    avatarUrl: raw.avatarUrl ?? "",
    email: raw.email ?? "",
    phoneNumber: raw.phoneNumber ?? "",
    countryCode: raw.countryCode ?? "+60",
    emergencyContactNumber: raw.emergencyContactNumber ?? "",
    city: raw.city ?? "",
    region: raw.region ?? "Malaysia",
    country: raw.country ?? "Malaysia",
    verified: Boolean(raw.verified),
    completion:
      typeof raw.completion === "number" && Number.isFinite(raw.completion)
        ? raw.completion
        : 80,
  };
}

export function loadStoredCustomerProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeStoredCustomerProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveCustomerProfile(profile: CustomerProfile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }

  const client = getSupabaseClient();
  if (!client) {
    return { mode: "local" as const };
  }

  try {
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      return { mode: "local" as const };
    }

    const response = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      return { mode: "local" as const };
    }

    return { mode: "supabase" as const };
  } catch {
    return { mode: "local" as const };
  }
}
