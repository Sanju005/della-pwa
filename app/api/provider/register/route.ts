import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createProviderRegistration } from "@/lib/provider-registration-storage";
import type { ProviderRegistrationData } from "@/lib/provider-registration-types";
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

  if (normalizedMessage.includes("user already registered")) {
    return "An account with this email already exists. Try logging in instead.";
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
    return byProviderId;
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
        .update(payload)
        .eq("id", existingVerification.data.id);
    }

    return adminClient
      .from("provider_verifications")
      .insert({
        provider_id: providerId,
        ...payload,
      });
  }

  return adminClient
    .from("provider_verifications")
    .upsert(
      {
        id: providerId,
        ...payload,
      },
      { onConflict: "id" },
    );
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProviderRegistrationData;
    const fullName = getProviderFullName(payload);
    const sex = payload.basicProfile.sex === "Male" || payload.basicProfile.sex === "Female"
      ? payload.basicProfile.sex
      : "";

    if (!payload.basicProfile.firstName || !payload.basicProfile.lastName || !sex || !payload.account.email) {
      return NextResponse.json(
        { error: "Missing required registration fields." },
        { status: 400 }
      );
    }

    if (!payload.basicProfile.country.trim() || !payload.basicProfile.emergencyContactNumber.trim()) {
      return NextResponse.json(
        { error: "Country and emergency contact number are required." },
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
      email: payload.account.email.trim().toLowerCase(),
      password: payload.account.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: payload.basicProfile.firstName.trim(),
        last_name: payload.basicProfile.lastName.trim(),
        sex,
        role: PROVIDER_ROLE,
        marketing_name: payload.basicProfile.marketingName.trim(),
        country: payload.basicProfile.country.trim(),
        emergency_contact_number: payload.basicProfile.emergencyContactNumber.trim(),
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: toSignupErrorMessage(authError?.message) },
        { status: 400 }
      );
    }

    if (!authData.user.email_confirmed_at) {
      const { error: confirmError } = await adminClient.auth.admin.updateUserById(
        authData.user.id,
        {
          email_confirm: true,
        }
      );

      if (confirmError) {
        return NextResponse.json(
          { error: "Account created, but email confirmation setup failed." },
          { status: 500 }
        );
      }
    }

    const providerId = authData.user.id;
    const normalizedPhone = normalizePhone(
      payload.account.phoneCountryCode,
      payload.account.phoneNumber,
    );
    const phoneVerified = payload.verification.phoneOtp.join("") === "123456";
    const identityVerified = Boolean(
      payload.verification.documentType &&
        payload.verification.frontImageName &&
        payload.verification.backImageName,
    );

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: providerId,
        full_name: fullName,
        email: payload.account.email.trim().toLowerCase(),
        role: PROVIDER_ROLE,
        phone: normalizedPhone,
        avatar_url: payload.basicProfile.avatarDataUrl?.trim() || null,
        status: "pending",
      }, { onConflict: "id" });

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
      is_visible: true,
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

    const availabilityDays = payload.availability.days
      .map((day) => day.trim().toLowerCase())
      .filter(Boolean);

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
        return NextResponse.json(
          { error: "Account created, but provider availability setup failed." },
          { status: 500 }
        );
      }
    }

    const verificationResult = await upsertProviderVerification(
      adminClient,
      providerId,
      phoneVerified,
      true,
      identityVerified,
    );

    const verificationSetupFailed = Boolean(verificationResult.error);

    const providerServicesPayload = payload.selectedServices.map((service) => {
      const details = payload.serviceDetails[service];
      const imageDataUrls = normalizeStoredMedia(details.imageDataUrls);
      const certificateDataUrls = normalizeStoredMedia(details.certificateDataUrls);

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
    });

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

    const record = await createProviderRegistration(payload, providerId, {
      phoneVerified,
      emailVerified: true,
      identityVerified,
    });

    return NextResponse.json({
      id: record.id,
      status: record.status,
      phoneVerified: verificationSetupFailed ? false : record.phoneVerified,
      emailVerified: verificationSetupFailed ? false : record.emailVerified,
      identityVerified: verificationSetupFailed ? false : record.identityVerified,
      verificationSetupFailed,
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
