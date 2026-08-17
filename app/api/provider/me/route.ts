import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import {
  resolveStoredMediaUrl,
  resolveStoredMediaUrlList,
  uploadStoredMedia,
} from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
  years_experience: string | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  image_data_urls?: string[] | null;
  image_captions?: string[] | null;
  certificate_data_urls?: string[] | null;
  certificate_captions?: string[] | null;
  provider_service_specialties:
    | Array<{ specialty: string | null }>
    | null;
};

type ProviderProfileRow = {
  id: string;
  marketing_name: string | null;
  service_location: string | null;
  service_radius_km: number | null;
  bio: string | null;
  approval_status: string | null;
  is_visible: boolean | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  provider_services?: ProviderServiceRow[] | null;
  provider_verifications?:
    | {
        phone_verified: boolean | null;
        email_verified: boolean | null;
        identity_verified: boolean | null;
        kyc_verified: boolean | null;
        background_check_verified: boolean | null;
        identity_document_type?: string | null;
        identity_front_image_url?: string | null;
        identity_back_image_url?: string | null;
        updated_at?: string | null;
        created_at?: string | null;
      }
    | Array<{
        phone_verified: boolean | null;
        email_verified: boolean | null;
        identity_verified: boolean | null;
        kyc_verified: boolean | null;
        background_check_verified: boolean | null;
        identity_document_type?: string | null;
        identity_front_image_url?: string | null;
        identity_back_image_url?: string | null;
        updated_at?: string | null;
        created_at?: string | null;
      }>
    | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  phone: string | null;
  avatar_url: string | null;
};

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

function relationItem<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toTitleCase(value: string | null | undefined) {
  if (!value?.trim()) {
    return "Pending";
  }

  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function normalizeIdentityVerificationStatus(
  value: unknown,
  verified: boolean,
): "pending" | "processing" | "verified" | "rejected" {
  if (verified) {
    return "verified";
  }

  if (typeof value !== "string") {
    return "pending";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "processing" || normalized === "rejected" || normalized === "verified") {
    return normalized;
  }

  return "pending";
}

function getEmergencyContactNumber(metadata: Record<string, unknown>) {
  if (typeof metadata.emergency_contact_number === "string" && metadata.emergency_contact_number.trim()) {
    return metadata.emergency_contact_number.trim();
  }

  if (typeof metadata.emergency_contact === "string" && metadata.emergency_contact.trim()) {
    return metadata.emergency_contact.trim();
  }

  return "";
}

function isMissingProviderProfileColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return normalized.includes("column") && normalized.includes("verification_status");
}

function isMissingConflictTargetError(message?: string) {
  return (message ?? "")
    .toLowerCase()
    .includes("no unique or exclusion constraint matching the on conflict specification");
}

function isMissingProviderServiceMediaColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("column") &&
    (normalized.includes("image_data_urls") ||
      normalized.includes("image_captions") ||
      normalized.includes("certificate_data_urls") ||
      normalized.includes("certificate_captions"))
  );
}

function isMissingVerificationDocumentColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("column") &&
    (normalized.includes("identity_document_type") ||
      normalized.includes("identity_front_image_url") ||
      normalized.includes("identity_back_image_url"))
  );
}

function stripVerificationDocumentFields(payload: Record<string, unknown>) {
  const nextPayload = { ...payload };
  delete nextPayload.identity_document_type;
  delete nextPayload.identity_front_image_url;
  delete nextPayload.identity_back_image_url;
  return nextPayload;
}

async function upsertProviderProfile(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  payload: Record<string, unknown>,
) {
  const withVerificationStatus = {
    verification_status: "partially_verified",
    ...payload,
  };

  const write = await adminClient
    .from("provider_profiles")
    .upsert(withVerificationStatus, { onConflict: "id" });

  if (!write.error || !isMissingProviderProfileColumnError(write.error.message)) {
    return write;
  }

  const { verification_status: _verificationStatus, ...fallbackPayload } = withVerificationStatus;

  return adminClient
    .from("provider_profiles")
    .upsert(fallbackPayload, { onConflict: "id" });
}

async function verifyProviderRequest(request: Request) {
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

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, status, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Provider profile was not found." }, { status: 404 }) };
  }

  if (!isProviderRole(profile.role)) {
    return { error: NextResponse.json({ error: "This account is not a provider." }, { status: 403 }) };
  }

  return {
    adminClient,
    authUser: user,
    profile: profile as ProfileRow,
  };
}

async function syncEmailVerification(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
  emailVerified: boolean,
) {
  const payload = {
    email_verified: emailVerified,
  };

  const byProviderId = await adminClient
    .from("provider_verifications")
    .upsert(
      {
        provider_id: providerId,
        ...payload,
      },
      { onConflict: "provider_id" },
    );

  if (!byProviderId.error) {
    return;
  }

  if (isMissingConflictTargetError(byProviderId.error.message)) {
    const existingVerification = await adminClient
      .from("provider_verifications")
      .select("id")
      .eq("provider_id", providerId)
      .maybeSingle();

    if (existingVerification.data?.id) {
      await adminClient
        .from("provider_verifications")
        .update(payload)
        .eq("id", existingVerification.data.id);
      return;
    }

    await adminClient
      .from("provider_verifications")
      .insert({
        provider_id: providerId,
        ...payload,
      });
    return;
  }

  await adminClient
    .from("provider_verifications")
    .upsert(
      {
        id: providerId,
        ...payload,
      },
      { onConflict: "id" },
    );
}

async function fetchProviderSnapshot(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
) {
  const { data: providerProfile, error: providerProfileError } = await adminClient
    .from("provider_profiles")
    .select(`
      id,
      marketing_name,
      service_location,
      service_radius_km,
      bio,
      approval_status,
      is_visible,
      average_rating,
      total_reviews
    `)
    .eq("id", providerId)
    .maybeSingle();

  if (providerProfileError || !providerProfile) {
    return null;
  }

  const servicesWithMediaQuery = adminClient
    .from("provider_services")
    .select(`
      id,
      service_type,
      years_experience,
      hourly_rate,
      daily_rate,
      image_data_urls,
      image_captions,
      certificate_data_urls,
      certificate_captions,
      provider_service_specialties (
        specialty
      )
    `)
    .eq("provider_id", providerId);

  const verificationsQuery = adminClient
    .from("provider_verifications")
    .select(`
      phone_verified,
      email_verified,
      identity_verified,
      kyc_verified,
      background_check_verified,
      identity_document_type,
      identity_front_image_url,
      identity_back_image_url,
      created_at
    `)
    .or(`provider_id.eq.${providerId},id.eq.${providerId}`)
    .limit(1);

  const [serviceWrite, verificationWrite] = await Promise.all([
    servicesWithMediaQuery,
    verificationsQuery,
  ]);

  let services = (serviceWrite.data as ProviderServiceRow[] | null) ?? null;

  if (serviceWrite.error && isMissingProviderServiceMediaColumnError(serviceWrite.error.message)) {
    const fallback = await adminClient
      .from("provider_services")
      .select(`
        id,
        service_type,
        years_experience,
        hourly_rate,
        daily_rate,
        provider_service_specialties (
          specialty
        )
      `)
      .eq("provider_id", providerId);

    services = (fallback.data as ProviderServiceRow[] | null) ?? null;
  }

  let verifications = verificationWrite.data as ProviderProfileRow["provider_verifications"];

  if (verificationWrite.error && isMissingVerificationDocumentColumnError(verificationWrite.error.message)) {
    const fallbackVerification = await adminClient
      .from("provider_verifications")
      .select(`
        phone_verified,
        email_verified,
        identity_verified,
        kyc_verified,
        background_check_verified
      `)
      .or(`provider_id.eq.${providerId},id.eq.${providerId}`)
      .limit(1);

    verifications = fallbackVerification.data as ProviderProfileRow["provider_verifications"];
  }

  return {
    ...(providerProfile as ProviderProfileRow),
    provider_services: (services as ProviderServiceRow[] | null) ?? [],
    provider_verifications: Array.isArray(verifications)
      ? verifications
      : verifications
        ? [verifications]
        : [],
  };
}

async function ensureProviderProfile(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  profile: ProfileRow,
) {
  const existing = await fetchProviderSnapshot(adminClient, profile.id);

  if (existing) {
    return existing;
  }

  const bootstrapPayload = {
    id: profile.id,
    marketing_name: profile.full_name ?? "",
    service_location: "",
    service_radius_km: 15,
    bio: "",
    approval_status: "pending_review",
    is_visible: false,
  };

  const { error } = await upsertProviderProfile(adminClient, bootstrapPayload);

  if (error) {
    return null;
  }

  return fetchProviderSnapshot(adminClient, profile.id);
}

async function buildResponse(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  profile: ProfileRow,
  providerProfile: ProviderProfileRow,
  authUser: { email_confirmed_at?: string | null; user_metadata?: unknown },
) {
  const avatarUrl = await resolveStoredMediaUrl(adminClient, {
    bucket: "profile-images",
    value: profile.avatar_url,
    visibility: "public",
  });
  const metadata =
    "user_metadata" in authUser && authUser.user_metadata && typeof authUser.user_metadata === "object"
      ? (authUser.user_metadata as Record<string, unknown>)
      : {};
  const verification = relationItem(providerProfile.provider_verifications);
  const identityVerified = Boolean(verification?.identity_verified);
  const identityVerificationStatus = normalizeIdentityVerificationStatus(
    metadata.identity_verification_status,
    identityVerified,
  );
  const identityDocumentType =
    verification?.identity_document_type === "passport"
      ? "passport"
      : verification?.identity_document_type === "ic"
        ? "ic"
        : undefined;
  const identityFrontImageUrl = await resolveStoredMediaUrl(adminClient, {
    bucket: "identity-documents",
    value: verification?.identity_front_image_url,
    visibility: "private",
  });
  const identityBackImageUrl = await resolveStoredMediaUrl(adminClient, {
    bucket: "identity-documents",
    value: verification?.identity_back_image_url,
    visibility: "private",
  });

  const response = {
    providerId: profile.id,
    fullName: profile.full_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    emergencyContactNumber: getEmergencyContactNumber(metadata),
    avatarUrl: getSafeAvatarUrl(avatarUrl),
    accountStatus: toTitleCase(profile.status),
    marketingName: providerProfile.marketing_name ?? "",
    serviceLocation: providerProfile.service_location ?? "",
    serviceRadiusKm: providerProfile.service_radius_km ?? 0,
    country:
      typeof metadata.country === "string" && metadata.country.trim()
        ? metadata.country
        : "Malaysia",
    bio: providerProfile.bio ?? "",
    averageRating: Number(providerProfile.average_rating ?? 0),
    totalReviews: Number(providerProfile.total_reviews ?? 0),
    approvalStatus: toTitleCase(providerProfile.approval_status),
    isVisible: Boolean(providerProfile.is_visible),
    emailVerified: Boolean(authUser.email_confirmed_at) || Boolean(verification?.email_verified),
    phoneVerified: Boolean(verification?.phone_verified),
    identityVerified,
    identityVerificationStatus,
    identityDocumentType,
    identityFrontImageUrl,
    identityBackImageUrl,
    kycVerified: Boolean(verification?.kyc_verified),
    backgroundCheckVerified: Boolean(verification?.background_check_verified),
    services:
      providerProfile.provider_services?.map((service) => ({
        id: service.id,
        serviceType: service.service_type ?? "service",
        yearsExperience: service.years_experience ?? "",
        hourlyRate: Number(service.hourly_rate ?? 0),
        dailyRate: Number(service.daily_rate ?? 0),
        specialties:
          service.provider_service_specialties
            ?.map((item) => item.specialty)
            .filter((item): item is string => Boolean(item)) ?? [],
        imageDataUrls:
          service.image_data_urls?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        imageCaptions: service.image_captions ?? [],
        certificateDataUrls:
          service.certificate_data_urls?.filter((item): item is string => Boolean(item?.trim())) ?? [],
        certificateCaptions: service.certificate_captions ?? [],
      })) ?? [],
  };

  for (const service of response.services) {
    service.imageDataUrls = await resolveStoredMediaUrlList(
      adminClient,
      "provider-work-images",
      service.imageDataUrls,
      "public",
    );
    service.certificateDataUrls = await resolveStoredMediaUrlList(
      adminClient,
      "certificates",
      service.certificateDataUrls,
      "private",
    );
  }

  return response;
}

export async function GET(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const emailVerified = Boolean(verified.authUser.email_confirmed_at);
  await syncEmailVerification(verified.adminClient, verified.profile.id, emailVerified);

  const providerProfile = await ensureProviderProfile(verified.adminClient, verified.profile);

  if (!providerProfile) {
    return NextResponse.json({ error: "Provider listing was not found." }, { status: 404 });
  }

  return NextResponse.json(
    await buildResponse(verified.adminClient, verified.profile, providerProfile, verified.authUser),
  );
}

type UpdatePayload = {
  fullName?: string;
  avatarUrl?: string;
  marketingName?: string;
  serviceLocation?: string;
  serviceRadiusKm?: number;
  bio?: string;
  country?: string;
  emergencyContactNumber?: string;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  identityVerificationStatus?: "pending" | "processing" | "verified" | "rejected";
  identityDocumentType?: "ic" | "passport";
  identityFrontImageUrl?: string;
  identityBackImageUrl?: string;
};

export async function PATCH(request: Request) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const payload = (await request.json()) as UpdatePayload;
  const currentMetadata =
    verified.authUser.user_metadata && typeof verified.authUser.user_metadata === "object"
      ? verified.authUser.user_metadata
      : {};
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

  const profilePayload = Object.fromEntries(
    Object.entries({
      full_name:
        typeof payload.fullName === "string" && payload.fullName.trim()
          ? payload.fullName.trim()
          : undefined,
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

  if (
    typeof payload.fullName === "string" ||
    typeof payload.country === "string" ||
    typeof payload.emergencyContactNumber === "string" ||
    typeof payload.identityVerificationStatus === "string" ||
    typeof payload.identityVerified === "boolean"
  ) {
    const fullName =
      typeof payload.fullName === "string" && payload.fullName.trim()
        ? payload.fullName.trim()
        : verified.profile.full_name ?? "";

    const [firstName = "", ...restName] = fullName.split(/\s+/).filter(Boolean);
    const lastName = restName.join(" ");

    const { error: authUpdateError } = await verified.adminClient.auth.admin.updateUserById(
      verified.profile.id,
      {
        user_metadata: {
          ...currentMetadata,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          country:
            typeof payload.country === "string" && payload.country.trim()
              ? payload.country.trim()
              : typeof currentMetadata.country === "string"
                ? currentMetadata.country
                : "Malaysia",
          emergency_contact_number:
            typeof payload.emergencyContactNumber === "string"
              ? payload.emergencyContactNumber.trim()
              : getEmergencyContactNumber(currentMetadata),
          emergency_contact:
            typeof payload.emergencyContactNumber === "string"
              ? payload.emergencyContactNumber.trim()
              : getEmergencyContactNumber(currentMetadata),
          identity_verification_status:
            typeof payload.identityVerificationStatus === "string"
              ? payload.identityVerificationStatus
              : typeof payload.identityVerified === "boolean"
                ? payload.identityVerified
                  ? "verified"
                  : "pending"
                : typeof currentMetadata.identity_verification_status === "string"
                  ? currentMetadata.identity_verification_status
                  : "pending",
          identity_document_type:
            payload.identityDocumentType === "ic" || payload.identityDocumentType === "passport"
              ? payload.identityDocumentType
              : typeof currentMetadata.identity_document_type === "string"
                ? currentMetadata.identity_document_type
                : "",
        },
      },
    );

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message || "Unable to update provider profile." }, { status: 500 });
    }
  }

  const providerPayload = Object.fromEntries(
    Object.entries({
      marketing_name: payload.marketingName?.trim(),
      service_location: payload.serviceLocation?.trim(),
      service_radius_km:
        typeof payload.serviceRadiusKm === "number" && Number.isFinite(payload.serviceRadiusKm)
          ? payload.serviceRadiusKm
          : undefined,
      bio: payload.bio?.trim(),
    }).filter(([, value]) => value !== undefined && value !== ""),
  );

  if (Object.keys(providerPayload).length > 0) {
    const { error } = await upsertProviderProfile(verified.adminClient, {
      id: verified.profile.id,
      ...providerPayload,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Unable to update listing." }, { status: 500 });
    }
  }

  if (
    typeof payload.phoneVerified === "boolean" ||
    typeof payload.identityVerified === "boolean" ||
    payload.identityDocumentType === "ic" ||
    payload.identityDocumentType === "passport" ||
    typeof payload.identityFrontImageUrl === "string" ||
    typeof payload.identityBackImageUrl === "string"
  ) {
    const storedIdentityFrontImageUrl = payload.identityFrontImageUrl?.trim()
      ? await uploadStoredMedia(verified.adminClient, {
          bucket: "identity-documents",
          dataUrl: payload.identityFrontImageUrl,
          ownerId: verified.profile.id,
          pathParts: ["identity", "front"],
          fileName:
            payload.identityDocumentType === "passport" ? "passport-front.jpg" : "ic-front.jpg",
          upsert: true,
          visibility: "private",
        })
      : payload.identityFrontImageUrl?.trim();
    const storedIdentityBackImageUrl = payload.identityBackImageUrl?.trim()
      ? await uploadStoredMedia(verified.adminClient, {
          bucket: "identity-documents",
          dataUrl: payload.identityBackImageUrl,
          ownerId: verified.profile.id,
          pathParts: ["identity", "back"],
          fileName:
            payload.identityDocumentType === "passport" ? "passport-back.jpg" : "ic-back.jpg",
          upsert: true,
          visibility: "private",
        })
      : payload.identityBackImageUrl?.trim();
    const verificationPayload = {
      phone_verified: payload.phoneVerified,
      email_verified: Boolean(verified.authUser.email_confirmed_at),
      identity_verified: payload.identityVerified,
      kyc_verified: payload.identityVerified,
      identity_document_type: payload.identityDocumentType,
      identity_front_image_url: storedIdentityFrontImageUrl,
      identity_back_image_url: storedIdentityBackImageUrl,
    };
    const verificationPayloadWithoutDocuments = stripVerificationDocumentFields(verificationPayload);

    const byProviderId = await verified.adminClient
      .from("provider_verifications")
      .upsert(
        {
          provider_id: verified.profile.id,
          ...verificationPayload,
        },
        { onConflict: "provider_id" },
      );

    if (byProviderId.error && isMissingVerificationDocumentColumnError(byProviderId.error.message)) {
      const fallbackByProviderId = await verified.adminClient
        .from("provider_verifications")
        .upsert(
          {
            provider_id: verified.profile.id,
            ...verificationPayloadWithoutDocuments,
          },
          { onConflict: "provider_id" },
        );

      if (fallbackByProviderId.error && isMissingConflictTargetError(fallbackByProviderId.error.message)) {
        const existingVerification = await verified.adminClient
          .from("provider_verifications")
          .select("id")
          .eq("provider_id", verified.profile.id)
          .maybeSingle();

        if (existingVerification.data?.id) {
          const { error } = await verified.adminClient
            .from("provider_verifications")
            .update(verificationPayloadWithoutDocuments)
            .eq("id", existingVerification.data.id);

          if (error) {
            return NextResponse.json(
              { error: error.message || "Unable to update provider verification." },
              { status: 500 },
            );
          }
        } else {
          const { error } = await verified.adminClient
            .from("provider_verifications")
            .insert({
              provider_id: verified.profile.id,
              ...verificationPayloadWithoutDocuments,
            });

          if (error) {
            return NextResponse.json(
              { error: error.message || "Unable to update provider verification." },
              { status: 500 },
            );
          }
        }
      } else if (fallbackByProviderId.error) {
        const byId = await verified.adminClient
          .from("provider_verifications")
          .upsert(
            {
              id: verified.profile.id,
              ...verificationPayloadWithoutDocuments,
            },
            { onConflict: "id" },
          );

        if (byId.error) {
          return NextResponse.json(
            { error: byId.error.message || "Unable to update provider verification." },
            { status: 500 },
          );
        }
      }
    } else if (byProviderId.error && isMissingConflictTargetError(byProviderId.error.message)) {
      const existingVerification = await verified.adminClient
        .from("provider_verifications")
        .select("id")
        .eq("provider_id", verified.profile.id)
        .maybeSingle();

      if (existingVerification.data?.id) {
        const { error } = await verified.adminClient
          .from("provider_verifications")
          .update(verificationPayload)
          .eq("id", existingVerification.data.id);

        if (error) {
          return NextResponse.json(
            { error: error.message || "Unable to update provider verification." },
            { status: 500 },
          );
        }
      } else {
        const { error } = await verified.adminClient
          .from("provider_verifications")
          .insert({
            provider_id: verified.profile.id,
            ...verificationPayload,
          });

        if (error) {
          return NextResponse.json(
            { error: error.message || "Unable to update provider verification." },
            { status: 500 },
          );
        }
      }
    } else if (byProviderId.error) {
      const byId = await verified.adminClient
        .from("provider_verifications")
        .upsert(
          {
            id: verified.profile.id,
            ...verificationPayload,
          },
          { onConflict: "id" },
        );

      if (byId.error) {
        return NextResponse.json(
          { error: byId.error.message || "Unable to update provider verification." },
          { status: 500 },
        );
      }
    }
  }

  if (payload.identityVerificationStatus === "processing") {
    const providerMessage =
      "Your IC / Passport successfully submitted for verification. It will take up to 24 hours to activate.";

    await verified.adminClient.from("notifications").insert({
      user_id: verified.profile.id,
      booking_id: null,
      notification_type: "identity_verification_submitted",
      title: "Identity verification submitted",
      body: providerMessage,
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
          title: "Provider identity verification submitted",
          body: `${verified.profile.full_name?.trim() || "A provider"} submitted IC / Passport for verification review.`,
        })),
      );
    }
  }

  const emailVerified = Boolean(verified.authUser.email_confirmed_at);
  await syncEmailVerification(verified.adminClient, verified.profile.id, emailVerified);

  const refreshedProfile = await verified.adminClient
    .from("profiles")
    .select("id, full_name, email, role, status, phone, avatar_url")
    .eq("id", verified.profile.id)
    .maybeSingle();

  if (refreshedProfile.error || !refreshedProfile.data) {
    return NextResponse.json({ error: "Unable to load updated provider." }, { status: 500 });
  }

  const providerProfile = await ensureProviderProfile(
    verified.adminClient,
    refreshedProfile.data as ProfileRow,
  );

  if (!providerProfile) {
    return NextResponse.json({ error: "Unable to load updated provider." }, { status: 500 });
  }

  return NextResponse.json(
    await buildResponse(
      verified.adminClient,
      refreshedProfile.data as ProfileRow,
      providerProfile,
      verified.authUser,
    ),
  );
}
