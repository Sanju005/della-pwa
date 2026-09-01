import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createProviderRegistration } from "@/lib/provider-registration-storage";
import type {
  ProviderRegistrationData,
  ProviderServiceDetails,
} from "@/lib/provider-registration-types";
import {
  uploadStoredMedia,
  uploadStoredMediaList,
} from "@/lib/server-media-storage";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_ROLE = "service_provider";

function toSignupErrorMessage(errorMessage?: string) {
  const normalizedMessage = errorMessage?.trim().toLowerCase() ?? "";

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return "Too many verification emails were requested. Please wait a few minutes and try again.";
  }

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  ) {
    return "An account with this phone number already exists. Try logging in instead.";
  }

  return errorMessage || "Unable to create provider account.";
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

function normalizePhone(countryCode: string, phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  const normalizedCountryCode = countryCode.trim() || "+60";

  if (!digits) {
    return normalizedCountryCode;
  }

  if (digits.startsWith("60")) {
    return `+${digits}`;
  }

  const countryDigits = normalizedCountryCode.replace(/[^\d]/g, "");

  return `+${countryDigits}${digits}`;
}

function toServiceType(service: string) {
  return service.trim().toLowerCase();
}

function normalizeStoredMedia(items: string[] | undefined) {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStoredCaptions(captions: string[] | undefined, mediaItems: string[]) {
  return mediaItems.map((_, index) => captions?.[index]?.trim() || `Work ${index + 1}`);
}

function buildProviderBio(payload: ProviderRegistrationData) {
  const specialties = payload.selectedServices
    .flatMap((service) => payload.serviceDetails[service].specialties)
    .filter(Boolean)
    .slice(0, 4);

  const services = payload.selectedServices.join(", ");
  const specialtyLabel = specialties.length > 0 ? ` Specialties: ${specialties.join(", ")}.` : "";

  return `Provider for ${services} in ${payload.basicProfile.serviceLocation}.${specialtyLabel}`;
}

function buildResidentialAddress(payload: ProviderRegistrationData) {
  return [
    payload.basicProfile.unitNumber,
    payload.basicProfile.addressLine1,
    payload.basicProfile.addressLine2,
    payload.basicProfile.postcode,
    payload.basicProfile.city,
    payload.basicProfile.state,
    payload.basicProfile.country,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function getEmergencyContact(payload: ProviderRegistrationData) {
  return (
    payload.basicProfile.emergencyContact?.trim() ||
    payload.basicProfile.emergencyContactNumber?.trim() ||
    ""
  );
}

function isMissingColumnError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("column") &&
    (normalized.includes("city") ||
      normalized.includes("state") ||
      normalized.includes("country") ||
      normalized.includes("postcode") ||
      normalized.includes("road") ||
      normalized.includes("suburb") ||
      normalized.includes("emergency_contact") ||
      normalized.includes("emergency_contact_number") ||
      normalized.includes("verification_status") ||
      normalized.includes("house_number") ||
      normalized.includes("latitude") ||
      normalized.includes("longitude") ||
      normalized.includes("formatted_address"))
  );
}

function isMissingConflictTargetError(message?: string) {
  return (message ?? "")
    .toLowerCase()
    .includes("no unique or exclusion constraint matching the on conflict specification");
}

function getProviderFullName(payload: ProviderRegistrationData) {
  return [payload.basicProfile.firstName, payload.basicProfile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function upsertProviderVerification(
  adminClient: ReturnType<typeof getAdminSupabaseClient>,
  providerId: string,
  phoneVerified: boolean,
  emailVerified: boolean,
  identityVerified: boolean,
  identityDocument?: {
    documentType?: string;
    frontImageUrl?: string;
    backImageUrl?: string;
  },
) {
  if (!adminClient) {
    return { error: { message: "Supabase is not configured yet." } };
  }

  const payload = {
    phone_verified: phoneVerified,
    email_verified: emailVerified,
    identity_verified: identityVerified,
    kyc_verified: identityVerified,
    background_check_verified: false,
    identity_document_type: identityDocument?.documentType?.trim() || null,
    identity_front_image_url: identityDocument?.frontImageUrl?.trim() || null,
    identity_back_image_url: identityDocument?.backImageUrl?.trim() || null,
  };
  const {
    identity_document_type: _identityDocumentType,
    identity_front_image_url: _identityFrontImageUrl,
    identity_back_image_url: _identityBackImageUrl,
    ...fallbackPayload
  } = payload;

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
    return byProviderId;
  }

  if (
    (byProviderId.error.message ?? "").toLowerCase().includes("column") &&
    ((byProviderId.error.message ?? "").toLowerCase().includes("identity_document_type") ||
      (byProviderId.error.message ?? "").toLowerCase().includes("identity_front_image_url") ||
      (byProviderId.error.message ?? "").toLowerCase().includes("identity_back_image_url"))
  ) {
    const fallbackByProviderId = await adminClient
      .from("provider_verifications")
      .upsert(
        {
          provider_id: providerId,
          ...fallbackPayload,
        },
        { onConflict: "provider_id" },
      );

    if (!fallbackByProviderId.error) {
      return fallbackByProviderId;
    }

    if (isMissingConflictTargetError(fallbackByProviderId.error.message)) {
      const existingVerification = await adminClient
        .from("provider_verifications")
        .select("id")
        .eq("provider_id", providerId)
        .maybeSingle();

      if (existingVerification.data?.id) {
        return adminClient
          .from("provider_verifications")
          .update(fallbackPayload)
          .eq("id", existingVerification.data.id);
      }

      return adminClient
        .from("provider_verifications")
        .insert({
          provider_id: providerId,
          ...fallbackPayload,
        });
    }

    return adminClient
      .from("provider_verifications")
      .upsert(
        {
          id: providerId,
          ...fallbackPayload,
        },
        { onConflict: "id" },
      );
  }

  if (isMissingConflictTargetError(byProviderId.error.message)) {
    const existingVerification = await adminClient
      .from("provider_verifications")
      .select("id")
      .eq("provider_id", providerId)
      .maybeSingle();

    if (existingVerification.data?.id) {
      return adminClient
        .from("provider_verifications")
        .update(fallbackPayload)
        .eq("id", existingVerification.data.id);
    }

    return adminClient
      .from("provider_verifications")
      .insert({
        provider_id: providerId,
        ...fallbackPayload,
      });
  }

  return adminClient
    .from("provider_verifications")
    .upsert(
      {
        id: providerId,
        ...fallbackPayload,
      },
      { onConflict: "id" },
    );
}

async function ensureProviderAdminMetadata(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  providerId: string,
) {
  const attemptedPayloads: Array<Record<string, unknown>> = [
    {
      provider_id: providerId,
      review_status: "pending_review",
      approval_status: "pending_review",
    },
    {
      provider_id: providerId,
      approval_status: "pending_review",
    },
    {
      provider_id: providerId,
    },
  ];

  let lastError: { message?: string } | null = null;

  for (const payload of attemptedPayloads) {
    const upsertByProviderId = await adminClient
      .from("provider_admin_metadata")
      .upsert(payload, { onConflict: "provider_id" });

    if (!upsertByProviderId.error) {
      return upsertByProviderId;
    }

    lastError = upsertByProviderId.error;

    if (isMissingConflictTargetError(upsertByProviderId.error.message)) {
      const existing = await adminClient
        .from("provider_admin_metadata")
        .select("id")
        .eq("provider_id", providerId)
        .maybeSingle();

      if (existing.data?.id) {
        const updateResult = await adminClient
          .from("provider_admin_metadata")
          .update(payload)
          .eq("id", existing.data.id);

        if (!updateResult.error) {
          return updateResult;
        }

        lastError = updateResult.error;
      } else {
        const insertResult = await adminClient
          .from("provider_admin_metadata")
          .insert(payload);

        if (!insertResult.error) {
          return insertResult;
        }

        lastError = insertResult.error;
      }
    }

    const upsertById = await adminClient
      .from("provider_admin_metadata")
      .upsert(
        {
          id: providerId,
          ...payload,
        },
        { onConflict: "id" },
      );

    if (!upsertById.error) {
      return upsertById;
    }

    lastError = upsertById.error;
  }

  return { error: lastError ?? { message: "Unable to create provider admin metadata." } };
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

function isMissingRelationError(message?: string) {
  const normalized = message?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("relation") ||
    normalized.includes("schema cache")
  );
}

function stripProviderServiceMediaFields(
  providerService: Record<string, unknown>,
) {
  const nextProviderService = { ...providerService };
  delete nextProviderService.image_data_urls;
  delete nextProviderService.image_captions;
  delete nextProviderService.certificate_data_urls;
  delete nextProviderService.certificate_captions;
  return nextProviderService;
}

function toAvailabilityTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return trimmed;
  }

  const [, hourPart, minutePart, period] = match;
  let hour = Number(hourPart);

  if (period.toUpperCase() === "PM" && hour < 12) {
    hour += 12;
  }

  if (period.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minutePart}`;
}

function getRegistrationAvailabilityRange(payload: ProviderRegistrationData) {
  if (payload.availability.timePreset === "24 Hours") {
    return { startTime: "00:00", endTime: "23:59", timeMode: "24_hours" };
  }

  if (payload.availability.timePreset === "9 AM - 9 PM") {
    return { startTime: "09:00", endTime: "21:00", timeMode: "preset" };
  }

  return {
    startTime: toAvailabilityTime(payload.availability.startTime || "09:00 AM"),
    endTime: toAvailabilityTime(payload.availability.endTime || "09:00 PM"),
    timeMode: "custom",
  };
}

function buildStoredRegistrationPayload(
  payload: ProviderRegistrationData,
  storedAvatarUrl: string,
  storedIdentityFrontImageUrl: string,
  storedIdentityBackImageUrl: string,
  storedServices: Array<{
    serviceType: string;
    imageDataUrls: string[];
    certificateDataUrls: string[];
  }>,
) {
  const serviceMediaByType = new Map(
    storedServices.map((service) => [service.serviceType, service] as const),
  );

  return {
    ...payload,
    basicProfile: {
      ...payload.basicProfile,
      emergencyContact:
        payload.basicProfile.emergencyContact?.trim() ||
        payload.basicProfile.emergencyContactNumber?.trim(),
      emergencyContactNumber:
        payload.basicProfile.emergencyContactNumber?.trim() ||
        payload.basicProfile.emergencyContact?.trim(),
      avatarDataUrl: storedAvatarUrl,
    },
    verification: {
      ...payload.verification,
      frontImageDataUrl: storedIdentityFrontImageUrl,
      backImageDataUrl: storedIdentityBackImageUrl,
    },
    serviceDetails: Object.fromEntries(
      Object.entries(payload.serviceDetails).map(([service, details]) => {
        const stored = serviceMediaByType.get(toServiceType(service));
        return [
          service,
          {
            ...details,
            imageDataUrls: stored?.imageDataUrls ?? details.imageDataUrls,
            certificateDataUrls: stored?.certificateDataUrls ?? details.certificateDataUrls,
          },
        ];
      }),
    ) as Record<keyof ProviderRegistrationData["serviceDetails"], ProviderServiceDetails>,
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProviderRegistrationData;
    const fullName = getProviderFullName(payload);
    const sex = payload.basicProfile.sex === "Male" || payload.basicProfile.sex === "Female"
      ? payload.basicProfile.sex
      : "";

    if (!payload.basicProfile.firstName || !payload.basicProfile.lastName || !sex) {
      return NextResponse.json(
        { error: "Missing required registration fields." },
        { status: 400 }
      );
    }

    // Providers authenticate by verified phone number, not email — email is
    // collected and verified later from Profile. The phone must already be
    // normalized (e.g. +60123456789) by the time it reaches this endpoint;
    // Flutter only calls this after the phone OTP step succeeds.
    const normalizedPhone = normalizePhone(
      payload.account.phoneCountryCode,
      payload.account.phoneNumber,
    );

    if (normalizedPhone.replace(/[^\d]/g, "").length < 8) {
      return NextResponse.json(
        { error: "A verified phone number is required." },
        { status: 400 }
      );
    }

    const emergencyContact = getEmergencyContact(payload);

    if (!payload.basicProfile.country.trim() || !emergencyContact) {
      return NextResponse.json(
        { error: "Country and emergency contact are required." },
        { status: 400 }
      );
    }

    if (payload.selectedServices.length === 0) {
      return NextResponse.json(
        { error: "Select at least one service." },
        { status: 400 }
      );
    }

    if (payload.account.password !== payload.account.confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (payload.account.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (
      !/[A-Z]/.test(payload.account.password) ||
      !/[a-z]/.test(payload.account.password) ||
      !/\d/.test(payload.account.password) ||
      !/[^\w\s]/.test(payload.account.password)
    ) {
      return NextResponse.json(
        { error: "Password must contain uppercase, lowercase, number, and symbol." },
        { status: 400 }
      );
    }

    const adminClient = getAdminSupabaseClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 }
      );
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      phone: normalizedPhone,
      password: payload.account.password,
      phone_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: payload.basicProfile.firstName.trim(),
        last_name: payload.basicProfile.lastName.trim(),
        sex,
        role: PROVIDER_ROLE,
        marketing_name: payload.basicProfile.marketingName.trim(),
        country: payload.basicProfile.country.trim(),
        // provider_profiles.residential_address stores these joined into one
        // string (see buildResidentialAddress) — the Flutter Profile screen
        // edits them as two separate lines, so they're kept here too rather
        // than adding new provider_profiles columns for them.
        address_line_1: payload.basicProfile.addressLine1.trim(),
        address_line_2: payload.basicProfile.addressLine2.trim(),
        emergency_contact: emergencyContact,
        emergency_contact_number: emergencyContact,
        identity_verification_status:
          payload.verification.documentType.trim() &&
          payload.verification.frontImageName.trim() &&
          payload.verification.backImageName.trim()
            ? "processing"
            : "pending",
        identity_document_type: payload.verification.documentType.trim().toLowerCase().includes("passport")
          ? "passport"
          : payload.verification.documentType.trim()
            ? "ic"
            : "",
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: toSignupErrorMessage(authError?.message) },
        { status: 400 }
      );
    }

    if (!authData.user.phone_confirmed_at) {
      const { error: confirmError } = await adminClient.auth.admin.updateUserById(
        authData.user.id,
        {
          phone_confirm: true,
        }
      );

      if (confirmError) {
        return NextResponse.json(
          { error: "Account created, but phone confirmation setup failed." },
          { status: 500 }
        );
      }
    }

    const providerId = authData.user.id;
    const storedAvatarUrl = payload.basicProfile.avatarDataUrl?.trim()
      ? await uploadStoredMedia(adminClient, {
          bucket: "profile-images",
          dataUrl: payload.basicProfile.avatarDataUrl,
          ownerId: providerId,
          pathParts: ["avatar"],
          fileName: "avatar.jpg",
          upsert: true,
          visibility: "public",
        })
      : "";
    const storedIdentityFrontImageUrl = payload.verification.frontImageDataUrl?.trim()
      ? await uploadStoredMedia(adminClient, {
          bucket: "identity-documents",
          dataUrl: payload.verification.frontImageDataUrl,
          ownerId: providerId,
          pathParts: ["identity", "front"],
          fileName:
            payload.verification.documentType === "passport" ? "passport-front.jpg" : "ic-front.jpg",
          upsert: true,
          visibility: "private",
        })
      : "";
    const storedIdentityBackImageUrl = payload.verification.backImageDataUrl?.trim()
      ? await uploadStoredMedia(adminClient, {
          bucket: "identity-documents",
          dataUrl: payload.verification.backImageDataUrl,
          ownerId: providerId,
          pathParts: ["identity", "back"],
          fileName:
            payload.verification.documentType === "passport" ? "passport-back.jpg" : "ic-back.jpg",
          upsert: true,
          visibility: "private",
        })
      : "";
    const phoneVerified = payload.verification.phoneOtp.join("") === "123456";
    const hasSubmittedIdentityDocuments = Boolean(
      payload.verification.documentType &&
        payload.verification.frontImageName &&
        payload.verification.backImageName,
    );
    const identityVerified = false;

    const baseProfilePayload = {
      id: providerId,
      full_name: fullName,
      // No email at registration — collected and verified later in Profile.
      email: null,
      role: PROVIDER_ROLE,
      phone: normalizedPhone,
      avatar_url: storedAvatarUrl || null,
      status: "pending",
    };

    const profileWithEmergencyPayload = {
      ...baseProfilePayload,
      emergency_contact: emergencyContact || null,
      emergency_contact_number: emergencyContact || null,
    };

    let profileError: { message?: string } | null = null;
    const profileWrite = await adminClient
      .from("profiles")
      .upsert(profileWithEmergencyPayload, { onConflict: "id" });

    profileError = profileWrite.error;

    if (profileError && isMissingColumnError(profileError.message)) {
      const fallbackProfileWrite = await adminClient
        .from("profiles")
        .upsert(baseProfilePayload, { onConflict: "id" });

      profileError = fallbackProfileWrite.error;
    }

    if (profileError) {
      return NextResponse.json(
        { error: "Account created, but profile setup failed." },
        { status: 500 }
      );
    }

    const baseProviderProfilePayload = {
      id: providerId,
      marketing_name: payload.basicProfile.marketingName.trim(),
      sex: sex || null,
      date_of_birth: payload.basicProfile.dateOfBirth.trim() || null,
      residential_address: buildResidentialAddress(payload) || null,
      service_location:
        payload.providerLocation.areaLabel.trim() ||
        payload.providerLocation.formattedAddress.trim() ||
        payload.basicProfile.serviceLocation.trim(),
      service_radius_km: payload.providerLocation.radius,
      bio: buildProviderBio(payload),
      approval_status: "pending_review",
      verification_status: "partially_verified",
      is_visible: false,
    };

    let providerProfileError: { message?: string } | null = null;

    const providerProfileWithAddressPayload = {
      ...baseProviderProfilePayload,
      formatted_address: payload.providerLocation.formattedAddress.trim() || null,
      road: payload.providerLocation.road.trim() || null,
      suburb: payload.providerLocation.suburb.trim() || null,
      city: payload.providerLocation.city.trim() || null,
      state: payload.providerLocation.state.trim() || null,
      postcode: payload.providerLocation.postcode.trim() || null,
      country: payload.providerLocation.country.trim() || null,
      house_number: payload.providerLocation.houseNumber.trim() || null,
      latitude: payload.providerLocation.latitude,
      longitude: payload.providerLocation.longitude,
    };

    const providerProfileWrite = await adminClient
      .from("provider_profiles")
      .upsert(providerProfileWithAddressPayload, { onConflict: "id" });

    providerProfileError = providerProfileWrite.error;

    if (providerProfileError && isMissingColumnError(providerProfileError.message)) {
      const fallbackWrite = await adminClient
        .from("provider_profiles")
        .upsert(baseProviderProfilePayload, { onConflict: "id" });

      providerProfileError = fallbackWrite.error;
    }

    if (providerProfileError) {
      return NextResponse.json(
        { error: "Account created, but provider profile setup failed." },
        { status: 500 }
      );
    }

    const providerAdminMetadataWrite = await ensureProviderAdminMetadata(
      adminClient,
      providerId,
    );

    if (providerAdminMetadataWrite.error) {
      return NextResponse.json(
        { error: "Account created, but provider admin metadata setup failed." },
        { status: 500 }
      );
    }

    const availabilityDays = payload.availability.days
      .map((day) => day.trim().toLowerCase())
      .filter(Boolean);

    let availabilitySetupFailed = false;

    if (availabilityDays.length > 0) {
      const availabilityRange = getRegistrationAvailabilityRange(payload);
      const availabilityWrite = await adminClient
        .from("provider_availability")
        .insert(
          availabilityDays.map((day) => ({
            provider_id: providerId,
            day_of_week: day,
            time_mode: availabilityRange.timeMode,
            start_time: availabilityRange.startTime,
            end_time: availabilityRange.endTime,
          })),
        );

      if (availabilityWrite.error) {
        availabilitySetupFailed = true;

        if (!isMissingRelationError(availabilityWrite.error.message)) {
          return NextResponse.json(
            { error: "Account created, but provider availability setup failed." },
            { status: 500 }
          );
        }
      }
    }

    const verificationResult = await upsertProviderVerification(
      adminClient,
      providerId,
      phoneVerified,
      false,
      identityVerified,
      {
        documentType: payload.verification.documentType,
        frontImageUrl: storedIdentityFrontImageUrl,
        backImageUrl: storedIdentityBackImageUrl,
      },
    );

    const verificationSetupFailed = Boolean(verificationResult.error);

    const providerServicesPayload = await Promise.all(
      payload.selectedServices.map(async (service) => {
        const details = payload.serviceDetails[service];
        const imageDataUrls = await uploadStoredMediaList(
          adminClient,
          normalizeStoredMedia(details.imageDataUrls).map((dataUrl, index) => ({
            dataUrl,
            fileName: `${toServiceType(service)}-work-${index + 1}.jpg`,
          })),
          {
            bucket: "provider-work-images",
            ownerId: providerId,
            pathPrefix: [toServiceType(service), "work"],
            visibility: "public",
          },
        );
        const certificateDataUrls = await uploadStoredMediaList(
          adminClient,
          normalizeStoredMedia(details.certificateDataUrls).map((dataUrl, index) => ({
            dataUrl,
            fileName: `${toServiceType(service)}-certificate-${index + 1}.jpg`,
          })),
          {
            bucket: "certificates",
            ownerId: providerId,
            pathPrefix: [toServiceType(service), "certificates"],
            visibility: "private",
          },
        );

        return {
          provider_id: providerId,
          service_type: toServiceType(service),
          years_experience: details.yearsExperience,
          hourly_rate: Number(details.hourlyRate || 0),
          daily_rate: Number(details.dailyRate || 0),
          image_data_urls: imageDataUrls,
          image_captions: normalizeStoredCaptions(details.imageCaptions, imageDataUrls),
          certificate_data_urls: certificateDataUrls,
          certificate_captions: normalizeStoredCaptions(
            details.certificateCaptions,
            certificateDataUrls,
          ),
        };
      }),
    );

    let providerServicesWrite = await adminClient
      .from("provider_services")
      .insert(providerServicesPayload)
      .select("id, service_type");

    if (
      providerServicesWrite.error &&
      isMissingProviderServiceMediaColumnError(providerServicesWrite.error.message)
    ) {
      providerServicesWrite = await adminClient
        .from("provider_services")
        .insert(
          providerServicesPayload.map((providerService) =>
            stripProviderServiceMediaFields(providerService),
          ),
        )
        .select("id, service_type");
    }

    const { data: insertedServices, error: providerServicesError } = providerServicesWrite;

    if (providerServicesError) {
      return NextResponse.json(
        { error: "Account created, but provider services setup failed." },
        { status: 500 }
      );
    }

    const serviceIdByType = new Map(
      (insertedServices ?? []).map((row) => [row.service_type, row.id] as const),
    );

    const specialtyPayload = payload.selectedServices.flatMap((service) => {
      const serviceType = toServiceType(service);
      const providerServiceId = serviceIdByType.get(serviceType);

      if (!providerServiceId) {
        return [];
      }

      return payload.serviceDetails[service].specialties
        .filter((specialty) => specialty.trim().length > 0)
        .map((specialty) => ({
          provider_service_id: providerServiceId,
          specialty,
        }));
    });

    if (specialtyPayload.length > 0) {
      const { error: specialtiesError } = await adminClient
        .from("provider_service_specialties")
        .insert(specialtyPayload);

      if (specialtiesError) {
        return NextResponse.json(
          { error: "Account created, but provider specialties setup failed." },
          { status: 500 }
        );
      }
    }

    const registrationPayload = buildStoredRegistrationPayload(
      payload,
      storedAvatarUrl,
      storedIdentityFrontImageUrl,
      storedIdentityBackImageUrl,
      providerServicesPayload.map((service) => ({
        serviceType: service.service_type,
        imageDataUrls: service.image_data_urls,
        certificateDataUrls: service.certificate_data_urls,
      })),
    );

    const record = await createProviderRegistration(registrationPayload, providerId, {
      phoneVerified,
      emailVerified: false,
      identityVerified,
    });

    return NextResponse.json({
      id: record.id,
      status: record.status,
      phoneVerified: verificationSetupFailed ? false : record.phoneVerified,
      emailVerified: verificationSetupFailed ? false : record.emailVerified,
      identityVerified: verificationSetupFailed ? false : record.identityVerified,
      verificationSetupFailed,
      availabilitySetupFailed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to submit provider registration.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
