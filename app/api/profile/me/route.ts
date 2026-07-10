import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import {
  resolveStoredMediaUrl,
  uploadStoredMedia,
} from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  phone: string | null;
  avatar_url?: string | null;
};

type CustomerProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  phone_number: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  country: string | null;
  emergency_contact_number?: string | null;
  identity_document_type?: string | null;
  identity_front_image_url?: string | null;
  identity_back_image_url?: string | null;
  verified: boolean | null;
  completion: number | null;
};

const customerProfileSelectWithOptionalColumns =
  "id, first_name, last_name, date_of_birth, sex, phone_number, country_code, city, region, state, country, emergency_contact_number, identity_document_type, identity_front_image_url, identity_back_image_url, verified, completion";

const customerProfileSelectBase =
  "id, first_name, last_name, date_of_birth, sex, city, state, country";

type BookingAggregateRow = {
  booking_status: string | null;
};

type PaymentAggregateRow = {
  amount: number | null;
  status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  service_title?: string | null;
};

type VerifiedCustomerRequest = {
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>;
  authUser: {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  profile: ProfileRow;
};

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

function splitFullName(fullName: string | null | undefined) {
  const trimmed = fullName?.trim() ?? "";

  if (!trimmed) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const parts = trimmed.split(/\s+/);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function isMissingCustomerProfileColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("column") &&
    (normalized.includes("phone_number") ||
      normalized.includes("country_code") ||
      normalized.includes("region") ||
      normalized.includes("emergency_contact_number") ||
      normalized.includes("identity_document_type") ||
      normalized.includes("identity_front_image_url") ||
      normalized.includes("identity_back_image_url") ||
      normalized.includes("verified") ||
      normalized.includes("completion") ||
      normalized.includes("updated_at"))
  );
}

function stripUnsupportedCustomerProfileFields(payload: Record<string, unknown>) {
  const nextPayload = { ...payload };
  delete nextPayload.phone_number;
  delete nextPayload.country_code;
  delete nextPayload.emergency_contact_number;
  delete nextPayload.identity_document_type;
  delete nextPayload.identity_front_image_url;
  delete nextPayload.identity_back_image_url;
  delete nextPayload.region;
  delete nextPayload.verified;
  delete nextPayload.completion;
  delete nextPayload.updated_at;
  return nextPayload;
}

function getSafeAvatarUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("data:") && trimmed.length > 2_000_000) {
    return "";
  }

  return trimmed;
}

async function retrySupabaseRequest<T>(operation: () => PromiseLike<T>, attempts = 3) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function fetchCustomerProfileRow(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  customerId: string,
) {
  const primary = await retrySupabaseRequest(() =>
    adminClient
      .from("customer_profiles")
      .select(customerProfileSelectWithOptionalColumns)
      .eq("id", customerId)
      .maybeSingle()
  );

  if (!primary.error) {
    return primary.data as CustomerProfileRow | null;
  }

  if (!isMissingCustomerProfileColumnError(primary.error.message)) {
    throw primary.error;
  }

  const fallback = await retrySupabaseRequest(() =>
    adminClient
      .from("customer_profiles")
      .select(customerProfileSelectBase)
      .eq("id", customerId)
      .maybeSingle()
  );

  if (fallback.error) {
    throw fallback.error;
  }

  return fallback.data as CustomerProfileRow | null;
}

function pickNameFallback(options: Array<string | null | undefined>) {
  for (const option of options) {
    const trimmed = option?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function normalizePhoneParts(phone: string | null | undefined, phoneNumber: string | null | undefined, countryCode: string | null | undefined) {
  if (phoneNumber?.trim()) {
    return {
      countryCode: countryCode?.trim() || "+60",
      phoneNumber: phoneNumber.trim(),
    };
  }

  const trimmed = phone?.trim() ?? "";
  if (!trimmed) {
    return {
      countryCode: countryCode?.trim() || "+60",
      phoneNumber: "",
    };
  }

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    return {
      countryCode: countryCode?.trim() || "+60",
      phoneNumber: digits,
    };
  }

  if (digits.startsWith("+60")) {
    return {
      countryCode: "+60",
      phoneNumber: digits.slice(3),
    };
  }

  const match = digits.match(/^(\+\d{1,3})(.*)$/);
  return {
    countryCode: match?.[1] || countryCode?.trim() || "+60",
    phoneNumber: match?.[2] || "",
  };
}

async function verifyCustomerRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return { error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }) };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }) };
  }

  let userId = "";
  let authEmail = "";
  let authPhone = "";

  try {
    const claimsResult = await retrySupabaseRequest(() => adminClient.auth.getClaims(token));

    if (claimsResult.error || !claimsResult.data?.claims?.sub) {
      return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };
    }

    userId = String(claimsResult.data.claims.sub);
    authEmail =
      typeof claimsResult.data.claims.email === "string"
        ? claimsResult.data.claims.email
        : "";
    authPhone =
      typeof claimsResult.data.claims.phone === "string"
        ? claimsResult.data.claims.phone
        : "";
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to verify session." },
        { status: 503 },
      ),
    };
  }

  let profileResult: { data: unknown; error: { message?: string } | null };

  try {
    profileResult = await retrySupabaseRequest(() =>
      adminClient
        .from("profiles")
        .select("id, full_name, email, role, status, phone, avatar_url")
        .eq("id", userId)
        .maybeSingle()
    );
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to load customer profile." },
        { status: 503 },
      ),
    };
  }

  const { data: profile, error: profileError } = profileResult;

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Customer profile was not found." }, { status: 404 }) };
  }

  const profileRow = profile as ProfileRow;

  if (isProviderRole(profileRow.role)) {
    return { error: NextResponse.json({ error: "This account is a provider account." }, { status: 403 }) };
  }

  return {
    adminClient,
    authUser: {
      id: userId,
      email: authEmail,
      phone: authPhone,
      user_metadata: {},
    },
    profile: profileRow,
  } satisfies VerifiedCustomerRequest;
}

function buildCustomerProfile(
  profile: ProfileRow,
  customerProfile: CustomerProfileRow | null,
  metadata?: Record<string, unknown>,
  fallbackFirstName?: string,
  fallbackLastName?: string,
  fallbackSex?: string,
) {
  const fallbackName = splitFullName(profile.full_name);
  const phoneParts = normalizePhoneParts(
    profile.phone,
    customerProfile?.phone_number,
    customerProfile?.country_code,
  );

  return {
    firstName: pickNameFallback([
      customerProfile?.first_name,
      fallbackFirstName,
      fallbackName.firstName,
    ]),
    lastName: pickNameFallback([
      customerProfile?.last_name,
      fallbackLastName,
      fallbackName.lastName,
    ]),
    sex:
      customerProfile?.sex === "Male" || customerProfile?.sex === "Female"
        ? customerProfile.sex
        : fallbackSex === "Male" || fallbackSex === "Female"
          ? fallbackSex
          : "Male",
    dateOfBirth: customerProfile?.date_of_birth?.trim() || "",
    avatarUrl: getSafeAvatarUrl(profile.avatar_url),
    email: profile.email?.trim() || (typeof metadata?.email === "string" ? metadata.email.trim() : ""),
    phoneNumber: phoneParts.phoneNumber,
    countryCode: phoneParts.countryCode,
    emergencyContactNumber:
      customerProfile?.emergency_contact_number?.trim() ||
      (typeof metadata?.emergency_contact_number === "string"
        ? metadata.emergency_contact_number.trim()
        : ""),
    city: customerProfile?.city?.trim() || "",
    region:
      customerProfile?.region?.trim() ||
      customerProfile?.state?.trim() ||
      customerProfile?.country?.trim() ||
      "Malaysia",
    country:
      customerProfile?.country?.trim() ||
      (typeof metadata?.country === "string" ? metadata.country.trim() : "") ||
      "Malaysia",
    emailVerified: Boolean(metadata?.email_verified),
    phoneVerified: Boolean(metadata?.phone_verified),
    identityVerificationStatus:
      metadata?.identity_verification_status === "processing" ||
      metadata?.identity_verification_status === "verified" ||
      metadata?.identity_verification_status === "rejected"
        ? metadata.identity_verification_status
        : "pending",
    identityDocumentType:
      customerProfile?.identity_document_type === "passport" || customerProfile?.identity_document_type === "ic"
        ? customerProfile.identity_document_type
        : metadata?.identity_document_type === "passport" || metadata?.identity_document_type === "ic"
          ? metadata.identity_document_type
          : undefined,
    identityFrontImageUrl: customerProfile?.identity_front_image_url?.trim() || "",
    identityBackImageUrl: customerProfile?.identity_back_image_url?.trim() || "",
    verified:
      Boolean(customerProfile?.verified) ||
      metadata?.identity_verification_status === "verified",
    completion: customerProfile?.completion ?? 80,
  };
}

function mapBookingSummary(rows: BookingAggregateRow[]) {
  let pending = 0;
  let ongoing = 0;
  let completed = 0;
  let cancelled = 0;

  for (const row of rows) {
    const status = row.booking_status?.trim().toLowerCase() ?? "";

    if (status === "declined" || status === "cancelled" || status === "canceled") {
      cancelled += 1;
      continue;
    }

    if (
      status === "completed" ||
      status === "paid" ||
      status === "review_requested" ||
      status === "reviewed"
    ) {
      completed += 1;
      continue;
    }

    if (status === "accepted" || status === "confirmed" || status === "on_the_way" || status === "arrived") {
      ongoing += 1;
      continue;
    }

    pending += 1;
  }

  return {
    pending,
    ongoing,
    completed,
    cancelled,
  };
}

function buildPaymentSummary(rows: PaymentAggregateRow[]) {
  const totalPaid = rows.reduce(
    (sum, row) => sum + (row.status === "paid" && typeof row.amount === "number" ? row.amount : 0),
    0,
  );

  const latestPayment = rows[0];
  const latestDate = latestPayment?.paid_at || latestPayment?.created_at;
  const latestLabel =
    latestDate && !Number.isNaN(new Date(latestDate).getTime())
      ? `Latest payment on ${new Intl.DateTimeFormat("en-MY", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(latestDate))}`
      : "No payment yet";

  return {
    walletBalance: 0,
    companyPayable: 0,
    totalPaid,
    lastPaymentLabel: latestLabel,
  };
}

export async function GET(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  try {
    const [customerProfile, bookingsResult, paymentsResult] = await Promise.all([
      fetchCustomerProfileRow(verified.adminClient, verified.profile.id),
      retrySupabaseRequest(() =>
        verified.adminClient
          .from("bookings")
          .select("booking_status")
          .eq("customer_id", verified.profile.id)
          .limit(200)
      ),
      retrySupabaseRequest(() =>
        verified.adminClient
          .from("payments")
          .select("amount, status, paid_at, created_at, service_title")
          .eq("customer_id", verified.profile.id)
          .order("paid_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(200)
      ),
    ]);
    const bookingRows = (bookingsResult.data ?? []) as BookingAggregateRow[];
    const paymentRows = (paymentsResult.data ?? []) as PaymentAggregateRow[];

    const profile = buildCustomerProfile(
        verified.profile,
        customerProfile,
        {
          email: verified.authUser.email ?? "",
          phone: verified.authUser.phone ?? "",
        },
        "",
        "",
        "",
      );

    profile.identityFrontImageUrl = await resolveStoredMediaUrl(verified.adminClient, {
      bucket: "identity-documents",
      value: profile.identityFrontImageUrl,
      visibility: "private",
    });
    profile.identityBackImageUrl = await resolveStoredMediaUrl(verified.adminClient, {
      bucket: "identity-documents",
      value: profile.identityBackImageUrl,
      visibility: "private",
    });

    return NextResponse.json({
      profile,
      bookingSummary: mapBookingSummary(bookingRows),
      paymentSummary: buildPaymentSummary(paymentRows),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load customer profile." },
      { status: 500 },
    );
  }
}

type UpdatePayload = {
  firstName?: string;
  lastName?: string;
  sex?: "" | "Male" | "Female";
  dateOfBirth?: string;
  avatarUrl?: string;
  email?: string;
  phoneNumber?: string;
  countryCode?: string;
  emergencyContactNumber?: string;
  city?: string;
  region?: string;
  country?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityVerificationStatus?: "pending" | "processing" | "verified" | "rejected";
  identityDocumentType?: "ic" | "passport";
  identityFrontImageUrl?: string;
  identityBackImageUrl?: string;
  verified?: boolean;
  completion?: number;
};

export async function PATCH(request: Request) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json()) as UpdatePayload;
  const firstName = payload.firstName?.trim() ?? "";
  const lastName = payload.lastName?.trim() ?? "";
  const sex = payload.sex === "Male" || payload.sex === "Female" ? payload.sex : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = payload.email?.trim().toLowerCase() ?? "";
  const countryCode = payload.countryCode?.trim() || "+60";
  const phoneNumber = payload.phoneNumber?.trim() ?? "";
  const emergencyContactNumber = payload.emergencyContactNumber?.trim() ?? "";
  const normalizedPhone = phoneNumber
    ? `${countryCode}${phoneNumber}`.replace(/\s+/g, "")
    : null;
  const storedAvatarUrl = payload.avatarUrl?.trim()
    ? await uploadStoredMedia(verified.adminClient, {
        bucket: "profile-images",
        dataUrl: payload.avatarUrl,
        ownerId: verified.profile.id,
        pathParts: ["avatar"],
        fileName: "avatar.jpg",
        upsert: true,
        visibility: "public",
      })
    : "";
  const storedIdentityFrontImageUrl = payload.identityFrontImageUrl?.trim()
    ? await uploadStoredMedia(verified.adminClient, {
        bucket: "identity-documents",
        dataUrl: payload.identityFrontImageUrl,
        ownerId: verified.profile.id,
        pathParts: ["identity", "front"],
        fileName: payload.identityDocumentType === "passport" ? "passport-front.jpg" : "ic-front.jpg",
        upsert: true,
        visibility: "private",
      })
    : "";
  const storedIdentityBackImageUrl = payload.identityBackImageUrl?.trim()
    ? await uploadStoredMedia(verified.adminClient, {
        bucket: "identity-documents",
        dataUrl: payload.identityBackImageUrl,
        ownerId: verified.profile.id,
        pathParts: ["identity", "back"],
        fileName: payload.identityDocumentType === "passport" ? "passport-back.jpg" : "ic-back.jpg",
        upsert: true,
        visibility: "private",
      })
    : "";

  const profilePayload = Object.fromEntries(
    Object.entries({
      full_name: fullName || undefined,
      email: email || undefined,
      phone: normalizedPhone || undefined,
      avatar_url: storedAvatarUrl || undefined,
    }).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(profilePayload).length > 0) {
    const { error } = await verified.adminClient
      .from("profiles")
      .update(profilePayload)
      .eq("id", verified.profile.id);

    if (error) {
      return NextResponse.json({ error: error.message || "Unable to update profile." }, { status: 500 });
    }
  }

  const currentMetadata =
    verified.authUser.user_metadata && typeof verified.authUser.user_metadata === "object"
      ? (verified.authUser.user_metadata as Record<string, unknown>)
      : {};

  const { error: authUpdateError } = await verified.adminClient.auth.admin.updateUserById(
    verified.profile.id,
    {
      user_metadata: {
        ...currentMetadata,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        sex,
        country: payload.country?.trim() || "Malaysia",
        emergency_contact_number: emergencyContactNumber,
        email_verified:
          typeof payload.emailVerified === "boolean"
            ? payload.emailVerified
            : Boolean(currentMetadata.email_verified),
        phone_verified:
          typeof payload.phoneVerified === "boolean"
            ? payload.phoneVerified
            : Boolean(currentMetadata.phone_verified),
        identity_verification_status:
          typeof payload.identityVerificationStatus === "string"
            ? payload.identityVerificationStatus
            : typeof currentMetadata.identity_verification_status === "string"
              ? currentMetadata.identity_verification_status
              : "pending",
        identity_document_type:
          payload.identityDocumentType === "ic" || payload.identityDocumentType === "passport"
            ? payload.identityDocumentType
            : typeof currentMetadata.identity_document_type === "string"
              ? currentMetadata.identity_document_type
              : "",
        identity_front_image_url: null,
        identity_back_image_url: null,
      },
    },
  );

  if (authUpdateError) {
    return NextResponse.json({ error: authUpdateError.message || "Unable to update profile." }, { status: 500 });
  }

  const customerProfilePayload = {
    id: verified.profile.id,
    first_name: firstName || null,
    last_name: lastName || null,
    date_of_birth: payload.dateOfBirth?.trim() || null,
    sex: sex || null,
    phone_number: phoneNumber || null,
    country_code: countryCode,
    emergency_contact_number: emergencyContactNumber || null,
    identity_document_type:
      payload.identityDocumentType === "ic" || payload.identityDocumentType === "passport"
        ? payload.identityDocumentType
        : null,
    identity_front_image_url: storedIdentityFrontImageUrl || null,
    identity_back_image_url: storedIdentityBackImageUrl || null,
    city: payload.city?.trim() || null,
    region: payload.region?.trim() || null,
    country: payload.country?.trim() || "Malaysia",
    verified: payload.verified ?? false,
    completion:
      typeof payload.completion === "number" && Number.isFinite(payload.completion)
        ? payload.completion
        : 80,
    updated_at: new Date().toISOString(),
  };

  let customerProfileWrite = await verified.adminClient
    .from("customer_profiles")
    .upsert(customerProfilePayload, { onConflict: "id" });

  if (customerProfileWrite.error && isMissingCustomerProfileColumnError(customerProfileWrite.error.message)) {
    customerProfileWrite = await verified.adminClient
      .from("customer_profiles")
      .upsert(stripUnsupportedCustomerProfileFields(customerProfilePayload), { onConflict: "id" });
  }

  const customerProfileError = customerProfileWrite.error;

  if (customerProfileError) {
    return NextResponse.json(
      { error: customerProfileError.message || "Unable to update customer profile." },
      { status: 500 },
    );
  }

  if (payload.identityVerificationStatus === "processing") {
    const customerMessage =
      "Your IC / Passport successfully submitted for verification. It will take up to 24 hours to activate.";

    await verified.adminClient.from("notifications").insert({
      user_id: verified.profile.id,
      booking_id: null,
      notification_type: "identity_verification_submitted",
      title: "Identity verification submitted",
      body: customerMessage,
    });

    const { data: adminProfiles } = await verified.adminClient
      .from("profiles")
      .select("id")
      .in("role", ["super_admin", "admin", "manager", "customer_care"]);

    if (adminProfiles?.length) {
      await verified.adminClient.from("notifications").insert(
        adminProfiles.map((admin) => ({
          user_id: admin.id,
          booking_id: null,
          notification_type: "identity_verification_submitted",
          title: "Customer identity verification submitted",
          body: `${fullName || verified.profile.full_name?.trim() || "A customer"} submitted IC / Passport for verification review.`,
        })),
      );
    }
  }

  const refreshedProfileResult = await verified.adminClient
    .from("profiles")
    .select("id, full_name, email, role, status, phone, avatar_url")
    .eq("id", verified.profile.id)
    .maybeSingle();

  let refreshedCustomerProfile: CustomerProfileRow | null = null;

  try {
    refreshedCustomerProfile = await fetchCustomerProfileRow(verified.adminClient, verified.profile.id);
  } catch {
    refreshedCustomerProfile = null;
  }

  if (refreshedProfileResult.error || !refreshedProfileResult.data) {
    return NextResponse.json({ error: "Unable to load updated profile." }, { status: 500 });
  }

  const profile = {
    ...buildCustomerProfile(
        refreshedProfileResult.data as ProfileRow,
        refreshedCustomerProfile,
        verified.authUser.user_metadata && typeof verified.authUser.user_metadata === "object"
          ? ({
              ...verified.authUser.user_metadata,
              country: payload.country?.trim() || "Malaysia",
              emergency_contact_number: emergencyContactNumber,
              email_verified:
                typeof payload.emailVerified === "boolean"
                  ? payload.emailVerified
                  : Boolean(currentMetadata.email_verified),
              phone_verified:
                typeof payload.phoneVerified === "boolean"
                  ? payload.phoneVerified
                  : Boolean(currentMetadata.phone_verified),
              identity_verification_status:
                typeof payload.identityVerificationStatus === "string"
                  ? payload.identityVerificationStatus
                  : typeof currentMetadata.identity_verification_status === "string"
                    ? currentMetadata.identity_verification_status
                    : "pending",
              identity_document_type:
                payload.identityDocumentType === "ic" || payload.identityDocumentType === "passport"
                  ? payload.identityDocumentType
                  : typeof currentMetadata.identity_document_type === "string"
                    ? currentMetadata.identity_document_type
                    : "",
            } as Record<string, unknown>)
          : {
              country: payload.country?.trim() || "Malaysia",
              emergency_contact_number: emergencyContactNumber,
              email_verified:
                typeof payload.emailVerified === "boolean" ? payload.emailVerified : false,
              phone_verified:
                typeof payload.phoneVerified === "boolean" ? payload.phoneVerified : false,
              identity_verification_status:
                typeof payload.identityVerificationStatus === "string"
                  ? payload.identityVerificationStatus
                  : "pending",
              identity_document_type:
                payload.identityDocumentType === "ic" || payload.identityDocumentType === "passport"
                  ? payload.identityDocumentType
                  : "",
            },
        firstName,
        lastName,
        sex,
      ),
  };

  profile.identityFrontImageUrl = await resolveStoredMediaUrl(verified.adminClient, {
    bucket: "identity-documents",
    value: profile.identityFrontImageUrl,
    visibility: "private",
  });
  profile.identityBackImageUrl = await resolveStoredMediaUrl(verified.adminClient, {
    bucket: "identity-documents",
    value: profile.identityBackImageUrl,
    visibility: "private",
  });

  return NextResponse.json({ profile });
}
