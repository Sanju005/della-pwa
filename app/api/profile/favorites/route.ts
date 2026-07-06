import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { FavoriteProvider } from "@/lib/profile-types";
import {
  buildProviderDetailHref,
  buildProviderPortraitSrc,
  serviceOrder,
  type ProviderCategoryKey,
} from "@/lib/provider-catalog-shared";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  role: string | null;
};

type FavoriteRow = {
  provider_id: string;
  service_key: string | null;
  created_at: string;
};

type ProviderServiceRow = {
  service_type: string | null;
  hourly_rate: number | null;
};

type ProviderRow = {
  id: string;
  marketing_name: string | null;
  average_rating: number | null;
  provider_services: ProviderServiceRow[] | null;
};

type ProviderProfileMediaRow = {
  id: string;
  avatar_url: string | null;
};

const accentOptions = [
  "from-[#8E5EB5] to-[#7B4EA1]",
  "from-[#2F7D4E] to-[#7BBF8E]",
  "from-[#C8703A] to-[#E0A064]",
  "from-[#3562C8] to-[#6D93EB]",
];

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

function isProviderCategoryKey(value: string | null | undefined): value is ProviderCategoryKey {
  return !!value && serviceOrder.includes(value as ProviderCategoryKey);
}

function getAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function mapFavoriteSchemaError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("customer_favorite_providers") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  ) {
    return "Favorites database schema is not ready yet. Favourite providers will stay saved on this device for now.";
  }

  return message || null;
}

async function verifyCustomerRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: "Customer profile was not found." }, { status: 404 }),
    };
  }

  if (isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is a provider account." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function humanizeService(serviceKey: ProviderCategoryKey) {
  return serviceKey.charAt(0).toUpperCase() + serviceKey.slice(1);
}

async function loadProviderMediaMap(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerIds: string[],
) {
  if (providerIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await adminClient
    .from("profiles")
    .select("id, avatar_url")
    .in("id", providerIds);

  return new Map(
    ((data ?? []) as ProviderProfileMediaRow[])
      .map((row) => [row.id, row.avatar_url?.trim() || ""] as const)
      .filter(([, avatarUrl]) => Boolean(avatarUrl)),
  );
}

async function loadFavoriteProviders(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  customerId: string,
) {
  const { data: favoriteData, error: favoriteError } = await adminClient
    .from("customer_favorite_providers")
    .select("provider_id, service_key, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (favoriteError) {
    throw new Error(mapFavoriteSchemaError(favoriteError.message) || "Unable to load favorites.");
  }

  const favorites = (favoriteData ?? []) as FavoriteRow[];
  const providerIds = [...new Set(favorites.map((row) => row.provider_id))];

  if (providerIds.length === 0) {
    return [] satisfies FavoriteProvider[];
  }

  const [{ data: providerData, error: providerError }, mediaMap] = await Promise.all([
    adminClient
      .from("provider_profiles")
      .select("id, marketing_name, average_rating, provider_services(service_type, hourly_rate)")
      .in("id", providerIds),
    loadProviderMediaMap(adminClient, providerIds),
  ]);

  if (providerError) {
    throw new Error(providerError.message || "Unable to load favorite providers.");
  }

  const providerMap = new Map(
    ((providerData ?? []) as ProviderRow[]).map((row) => [row.id, row]),
  );

  return favorites.flatMap((favorite, index) => {
    const provider = providerMap.get(favorite.provider_id);
    if (!provider) {
      return [];
    }

    const matchedService = isProviderCategoryKey(favorite.service_key)
      ? favorite.service_key
      : provider.provider_services?.find((service) => isProviderCategoryKey(service.service_type))
          ?.service_type ?? null;

    if (!isProviderCategoryKey(matchedService)) {
      return [];
    }

    const providerName = provider.marketing_name?.trim() || "DELLA Provider";
    const matchingServiceRow =
      provider.provider_services?.find((service) => service.service_type === matchedService) ?? null;
    const hourlyRate =
      typeof matchingServiceRow?.hourly_rate === "number"
        ? Number(matchingServiceRow.hourly_rate)
        : null;

    return [
      {
        id: provider.id,
        name: providerName,
        role: `${humanizeService(matchedService)} Provider`,
        initials: buildInitials(providerName) || "DP",
        accent: accentOptions[index % accentOptions.length] ?? accentOptions[0],
        serviceKey: matchedService,
        rating:
          typeof provider.average_rating === "number"
            ? Number(provider.average_rating)
            : undefined,
        priceLabel: hourlyRate !== null ? `RM${hourlyRate}/hr` : undefined,
        portraitSrc:
          mediaMap.get(provider.id) ||
          buildProviderPortraitSrc({
            serviceKey: matchedService,
            name: providerName,
          }),
        bookHref: buildProviderDetailHref({
          id: provider.id,
          serviceKey: matchedService,
        }),
      } satisfies FavoriteProvider,
    ];
  });
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  try {
    const favoriteProviders = await loadFavoriteProviders(
      verified.adminClient,
      verified.profile.id,
    );

    return NextResponse.json({ favoriteProviders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load favorites." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as {
    providerId?: string;
    serviceKey?: string;
  };

  if (!payload.providerId) {
    return NextResponse.json({ error: "Provider ID is required." }, { status: 400 });
  }

  const { error } = await verified.adminClient
    .from("customer_favorite_providers")
    .upsert(
      {
        customer_id: verified.profile.id,
        provider_id: payload.providerId,
        service_key: isProviderCategoryKey(payload.serviceKey) ? payload.serviceKey : null,
      },
      { onConflict: "customer_id,provider_id" },
    );

  if (error) {
    return NextResponse.json(
      { error: mapFavoriteSchemaError(error.message) || "Unable to save favorite provider." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json().catch(() => ({}))) as {
    providerId?: string;
  };

  if (!payload.providerId) {
    return NextResponse.json({ error: "Provider ID is required." }, { status: 400 });
  }

  const { error } = await verified.adminClient
    .from("customer_favorite_providers")
    .delete()
    .eq("customer_id", verified.profile.id)
    .eq("provider_id", payload.providerId);

  if (error) {
    return NextResponse.json(
      { error: mapFavoriteSchemaError(error.message) || "Unable to remove favorite provider." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
