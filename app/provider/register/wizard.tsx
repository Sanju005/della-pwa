"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  ImageCropModal,
  cropImageFromSelection,
  type CropSelection,
  type CropTone,
} from "@/app/_components/image-crop-modal";
import {
  IMAGE_UPLOAD_ACCEPT,
  isAcceptedImageFile,
  isCroppableImageFile,
} from "@/lib/image-upload";
import {
  availabilityDays,
  createDefaultProviderRegistration,
  documentTypes,
  malaysianStates,
  sexOptions,
  serviceIcons,
  serviceSpecialties,
  timePresets,
} from "@/lib/provider-registration-config";
import { resolveCurrentLiveLocation } from "@/lib/live-location";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  ProviderRegistrationData,
  ProviderService,
} from "@/lib/provider-registration-types";
import { providerServices } from "@/lib/provider-registration-types";

type RegistrationUploadBucket =
  | "profile-images"
  | "provider-work-images"
  | "certificates"
  | "identity-documents";

type ReverseLocationResponse = {
  label: string;
  formattedAddress?: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  houseNumber?: string;
};

const DynamicLocationPickerMap = dynamic(
  () =>
    import("@/app/_components/location-picker-map").then((module) => ({
      default: module.LocationPickerMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#f5f1fa] text-[13px] font-semibold text-[#4b5563]">
        Loading map...
      </div>
    ),
  }
);

function getTodayIso() {
  return new Date().toISOString().split("T")[0] ?? "";
}
const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const CERTIFICATE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_AND_MEDIA_ACCEPT = IMAGE_UPLOAD_ACCEPT;
const CERTIFICATE_ACCEPT = `${IMAGE_UPLOAD_ACCEPT},.pdf,application/pdf`;
const AVAILABILITY_TIME_OPTIONS = [
  "12:00 AM",
  "01:00 AM",
  "02:00 AM",
  "03:00 AM",
  "04:00 AM",
  "05:00 AM",
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
];

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

function isDataUrl(value: string) {
  return value.trim().startsWith("data:");
}

function sanitizeUploadSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

function cloneRegistrationData(data: ProviderRegistrationData): ProviderRegistrationData {
  return {
    ...data,
    basicProfile: { ...data.basicProfile },
    account: { ...data.account },
    selectedServices: [...data.selectedServices],
    availability: {
      ...data.availability,
      days: [...data.availability.days],
    },
    providerLocation: { ...data.providerLocation },
    verification: {
      ...data.verification,
      phoneOtp: [...data.verification.phoneOtp],
      emailOtp: [...data.verification.emailOtp],
    },
    serviceDetails: Object.fromEntries(
      providerServices.map((service) => [
        service,
        {
          ...data.serviceDetails[service],
          specialties: [...data.serviceDetails[service].specialties],
          imageCaptions: [...data.serviceDetails[service].imageCaptions],
          imageDataUrls: [...data.serviceDetails[service].imageDataUrls],
          certificateCaptions: [...data.serviceDetails[service].certificateCaptions],
          certificateDataUrls: [...data.serviceDetails[service].certificateDataUrls],
        },
      ]),
    ) as ProviderRegistrationData["serviceDetails"],
  };
}

async function uploadRegistrationAsset(options: {
  bucket: RegistrationUploadBucket;
  dataUrl: string;
  fileName: string;
  ownerId: string;
  pathParts: string[];
  visibility: "public" | "private";
}) {
  if (!isDataUrl(options.dataUrl)) {
    return options.dataUrl;
  }

  const response = await fetch("/api/provider/register/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const result = (await response.json()) as { value?: string; error?: string };

  if (!response.ok || !result.value) {
    throw new Error(result.error || "Unable to upload registration asset.");
  }

  return result.value;
}

async function prepareRegistrationPayloadForSubmit(
  data: ProviderRegistrationData,
  ownerId: string,
) {
  const nextData = cloneRegistrationData(data);
  const emergencyContact =
    nextData.basicProfile.emergencyContact.trim() ||
    nextData.basicProfile.emergencyContactNumber.trim();

  nextData.basicProfile.emergencyContact = emergencyContact;
  nextData.basicProfile.emergencyContactNumber = emergencyContact;

  nextData.basicProfile.avatarDataUrl = await uploadRegistrationAsset({
    bucket: "profile-images",
    dataUrl: nextData.basicProfile.avatarDataUrl,
    fileName: nextData.basicProfile.profileImageName || "avatar.jpg",
    ownerId,
    pathParts: ["profile", "avatar"],
    visibility: "public",
  });

  const documentType =
    nextData.verification.documentType.trim().toLowerCase().includes("passport")
      ? "passport"
      : "ic";

  nextData.verification.frontImageDataUrl = await uploadRegistrationAsset({
    bucket: "identity-documents",
    dataUrl: nextData.verification.frontImageDataUrl,
    fileName:
      nextData.verification.frontImageName ||
      `${documentType === "passport" ? "passport" : "ic"}-front.jpg`,
    ownerId,
    pathParts: ["identity", "front"],
    visibility: "private",
  });

  nextData.verification.backImageDataUrl = await uploadRegistrationAsset({
    bucket: "identity-documents",
    dataUrl: nextData.verification.backImageDataUrl,
    fileName:
      nextData.verification.backImageName ||
      `${documentType === "passport" ? "passport" : "ic"}-back.jpg`,
    ownerId,
    pathParts: ["identity", "back"],
    visibility: "private",
  });

  await Promise.all(
    nextData.selectedServices.map(async (service) => {
      const serviceKey = sanitizeUploadSegment(service.toLowerCase());
      const details = nextData.serviceDetails[service];

      details.imageDataUrls = await Promise.all(
        details.imageDataUrls.map((value, index) =>
          uploadRegistrationAsset({
            bucket: "provider-work-images",
            dataUrl: value,
            fileName: `${serviceKey}-work-${index + 1}.jpg`,
            ownerId,
            pathParts: [serviceKey, "work", `${index + 1}`],
            visibility: "public",
          }),
        ),
      );

      details.certificateDataUrls = await Promise.all(
        details.certificateDataUrls.map((value, index) =>
          uploadRegistrationAsset({
            bucket: "certificates",
            dataUrl: value,
            fileName:
              details.certificateCaptions[index]?.trim() ||
              `${serviceKey}-certificate-${index + 1}`,
            ownerId,
            pathParts: [serviceKey, "certificates", `${index + 1}`],
            visibility: "private",
          }),
        ),
      );
    }),
  );

  return nextData;
}

async function prepareCertificateUpload(file: File) {
  if (file.type !== "application/pdf" && !isAcceptedImageFile(file)) {
    throw new Error("Certificates must be JPG, JPEG, PNG, GIF, TIFF, JFIF, or PDF.");
  }

  if (file.size > CERTIFICATE_UPLOAD_MAX_BYTES) {
    throw new Error("Certificate file must be smaller than 5MB.");
  }

  return {
    displayName: file.name,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function combineResidentialAddress(data: ProviderRegistrationData["basicProfile"]) {
  return [
    data.unitNumber,
    data.addressLine1,
    data.addressLine2,
    data.postcode,
    data.city,
    data.state,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

type FlowStep =
  | { type: "basic"; label: string }
  | { type: "pre-verification"; label: string }
  | { type: "services"; label: string }
  | { type: "service-detail"; label: string; service: ProviderService }
  | { type: "availability"; label: string }
  | { type: "location"; label: string }
  | { type: "review"; label: string }
  | { type: "submitted"; label: string }
  | { type: "verification"; label: string }
  | { type: "identity"; label: string }
  | { type: "success"; label: string };

export function ProviderRegistrationWizard() {
  const [data, setData] = useState<ProviderRegistrationData>(
    createDefaultProviderRegistration()
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [registrationId, setRegistrationId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [basicFieldErrors, setBasicFieldErrors] = useState<Record<string, string>>({});
  const [servicesError, setServicesError] = useState("");
  const [showBasicProfileSavedModal, setShowBasicProfileSavedModal] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [hasProviderSession, setHasProviderSession] = useState(false);
  const [cropState, setCropState] = useState<{
    sourceDataUrl: string;
    fileName: string;
    tone: CropTone;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  } | null>(null);
  const uploadOwnerIdRef = useRef(`provider-registration-${crypto.randomUUID()}`);

  const steps = useMemo<FlowStep[]>(() => {
    const dynamicServiceSteps = data.selectedServices.map((service) => ({
      type: "service-detail" as const,
      label: `${service} Service Details`,
      service,
    }));

    return [
      { type: "basic", label: "Basic Profile" },
      { type: "pre-verification", label: "Email Verification" },
      { type: "services", label: "Select Services" },
      ...dynamicServiceSteps,
      { type: "availability", label: "Availability" },
      { type: "location", label: "Provider Location" },
      { type: "review", label: "Review & Submit" },
      { type: "submitted", label: "Listing Submitted" },
      { type: "verification", label: "Verification - Step 1" },
      { type: "identity", label: "Verification - Step 2" },
      { type: "success", label: "Success" },
    ];
  }, [data.selectedServices]);

  const activeStep = steps[Math.min(stepIndex, steps.length - 1)];
  const getStepIndex = (type: FlowStep["type"]) => steps.findIndex((step) => step.type === type);

  const submitRegistration = async () => {
    const payload = await prepareRegistrationPayloadForSubmit(
      data,
      uploadOwnerIdRef.current,
    );
    const response = await fetch("/api/provider/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

        const result = (await response.json()) as
          | {
              id: string;
              status: string;
              phoneVerified: boolean;
              emailVerified: boolean;
              identityVerified: boolean;
              verificationSetupFailed?: boolean;
            }
          | { error?: string };

    if (!response.ok || !("id" in result)) {
      throw new Error(
        "error" in result && result.error
          ? result.error
          : "Unable to submit registration."
      );
    }

    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase is not configured yet.");
    }

    const signInResult = await client.auth.signInWithPassword({
      email: data.account.email.trim().toLowerCase(),
      password: data.account.password,
    });

    if (signInResult.error) {
      throw new Error(signInResult.error.message || "Unable to sign in to the new provider account.");
    }

    setHasProviderSession(true);
    setRegistrationId(result.id);
    return result;
  };

  const goNext = () => {
    if (activeStep.type === "basic") {
      const nextBasicErrors: Record<string, string> = {};

      if (!data.basicProfile.firstName.trim()) {
        nextBasicErrors.firstName = "First name is required.";
      }
      if (!data.basicProfile.lastName.trim()) {
        nextBasicErrors.lastName = "Last name is required.";
      }
      if (!data.basicProfile.sex) {
        nextBasicErrors.sex = "Please select gender.";
      }
      if (!data.basicProfile.dateOfBirth.trim()) {
        nextBasicErrors.dateOfBirth = "Date of birth is required.";
      }
      if (!data.basicProfile.addressLine1.trim()) {
        nextBasicErrors.addressLine1 = "Address line 1 is required.";
      }
      if (!data.basicProfile.postcode.trim()) {
        nextBasicErrors.postcode = "Postcode is required.";
      }
      if (!data.basicProfile.city.trim()) {
        nextBasicErrors.city = "City is required.";
      }
      if (!data.basicProfile.state.trim()) {
        nextBasicErrors.state = "State is required.";
      }
      if (!data.basicProfile.country.trim()) {
        nextBasicErrors.country = "Country is required.";
      }
      if (!data.account.email.trim()) {
        nextBasicErrors.email = "Email is required.";
      }
      if (!data.account.phoneNumber.trim()) {
        nextBasicErrors.phoneNumber = "Phone number is required.";
      }
      if (!data.basicProfile.emergencyContactNumber.trim()) {
        nextBasicErrors.emergencyContactNumber = "Emergency contact number is required.";
      }
      if (!data.account.password) {
        nextBasicErrors.password = "Password is required.";
      }
      if (!data.account.confirmPassword) {
        nextBasicErrors.confirmPassword = "Please confirm your password.";
      }

      if (Object.keys(nextBasicErrors).length > 0) {
        setBasicFieldErrors(nextBasicErrors);
        setSubmitError("");
        return;
      }

      if (data.account.password !== data.account.confirmPassword) {
        setBasicFieldErrors({
          password: "Passwords do not match.",
          confirmPassword: "Passwords do not match.",
        });
        setSubmitError("");
        return;
      }

      if (data.account.password.length < 8) {
        setBasicFieldErrors({
          password: "Password must be at least 8 characters long.",
        });
        setSubmitError("");
        return;
      }

      const passwordRuleFailures = getPasswordRuleFailures(data.account.password);
      if (passwordRuleFailures.length > 0) {
        setBasicFieldErrors({
          password: "Password must contain uppercase, lowercase, number, and symbol.",
        });
        setSubmitError("");
        return;
      }

      setBasicFieldErrors({});
      setSubmitError("");
      setShowBasicProfileSavedModal(true);
      return;
    }

    if (activeStep.type === "services" && data.selectedServices.length === 0) {
      setServicesError("Please select at least one service.");
      setSubmitError("");
      return;
    }

    if (activeStep.type === "review") {
      startTransition(async () => {
        setSubmitError("");
        try {
          await submitRegistration();
          setStepIndex((current) => Math.min(current + 1, steps.length - 1));
        } catch (error) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Unable to submit registration."
          );
          return;
        }
      });

      return;
    }

    if (activeStep.type === "identity") {
      startTransition(async () => {
        setSubmitError("");

        if (!hasProviderSession) {
          setSubmitError("Please submit the listing first before starting verification.");
          return;
        }

        const client = getSupabaseClient();

        if (!client) {
          setSubmitError("Supabase is not configured yet.");
          return;
        }

        const {
          data: { session },
        } = await client.auth.getSession();

        if (!session) {
          setSubmitError("Your provider session expired. Please log in again.");
          return;
        }

        const response = await fetch("/api/provider/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            phoneVerified: data.verification.phoneOtp.join("") === "123456",
            identityVerified: false,
            identityVerificationStatus: Boolean(
              data.verification.documentType &&
                data.verification.frontImageName &&
                data.verification.backImageName
            )
              ? "processing"
              : "pending",
            identityDocumentType: data.verification.documentType
              .trim()
              .toLowerCase()
              .includes("passport")
              ? "passport"
              : "ic",
            identityFrontImageUrl: data.verification.frontImageDataUrl,
            identityBackImageUrl: data.verification.backImageDataUrl,
          }),
        });

        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          setSubmitError(result.error || "Unable to submit verification.");
          return;
        }

        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      });

      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const updateBasic = (
    field: keyof ProviderRegistrationData["basicProfile"],
    value: string | number
  ) => {
    setBasicFieldErrors((current) => {
      const keysToClear =
        field === "avatarDataUrl" || field === "profileImageName"
          ? [field, "profileImage"]
          : [field];
      if (!keysToClear.some((key) => current[key])) {
        return current;
      }

      const next = { ...current };
      for (const key of keysToClear) {
        delete next[key];
      }
      return next;
    });
    setData((current) => ({
      ...current,
      basicProfile: { ...current.basicProfile, [field]: value },
    }));
  };

  const updateAccount = (
    field: keyof ProviderRegistrationData["account"],
    value: string
  ) => {
    setBasicFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setData((current) => ({
      ...current,
      account: { ...current.account, [field]: value },
    }));
  };

  const toggleService = (service: ProviderService) => {
    setServicesError("");
    setData((current) => {
      const selected = current.selectedServices.includes(service)
        ? current.selectedServices.filter((item) => item !== service)
        : [...current.selectedServices, service];

      return {
        ...current,
        selectedServices: selected,
      };
    });
  };

  const updateServiceDetail = (
    service: ProviderService,
    field: keyof ProviderRegistrationData["serviceDetails"][ProviderService],
    value: string | string[]
  ) => {
    setData((current) => ({
      ...current,
      serviceDetails: {
        ...current.serviceDetails,
        [service]: {
          ...current.serviceDetails[service],
          [field]: value,
        },
      },
    }));
  };

  const toggleAvailabilityDay = (day: string) => {
    setData((current) => {
      const days = current.availability.days.includes(day)
        ? current.availability.days.filter((item) => item !== day)
        : [...current.availability.days, day];

      return {
        ...current,
        availability: {
          ...current.availability,
          days,
        },
      };
    });
  };

  const updateAvailability = (
    field: keyof ProviderRegistrationData["availability"],
    value: string | string[]
  ) => {
    setData((current) => ({
      ...current,
      availability: { ...current.availability, [field]: value },
    }));
  };

  const updateVerification = (
    field: keyof ProviderRegistrationData["verification"],
    value: string | string[]
  ) => {
    setData((current) => ({
      ...current,
      verification: { ...current.verification, [field]: value },
    }));
  };

  const openCropper = async ({
    file,
    tone,
    maxSizeBytes = IMAGE_UPLOAD_MAX_BYTES,
    aspectRatio,
    onApply,
  }: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => {
    if (!isAcceptedImageFile(file)) {
      throw new Error("Only JPG, JPEG, PNG, GIF, WEBP, TIFF, or JFIF images are allowed.");
    }

    if (!isCroppableImageFile(file)) {
      throw new Error("This image cannot be cropped here. Please use JPG, PNG, WEBP, or GIF.");
    }

    if (file.size > maxSizeBytes) {
      throw new Error(`Image must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
    }

    const sourceDataUrl = await readFileAsDataUrl(file);

    setCropState({
      sourceDataUrl,
      fileName: file.name,
      tone,
      aspectRatio,
      onApply,
    });
  };

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#faf7fd]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-4 py-4 sm:justify-center">
        <div className="safe-top safe-bottom-lg overflow-hidden rounded-[34px] border border-[#e6daf1] bg-white shadow-[0_20px_60px_rgba(142,94,181,0.08)]">
          <div className="px-5 pb-6 pt-5">
            <div className="mb-5 flex items-center gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#111827]"
                  aria-label="Back"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
              ) : (
                <span className="inline-flex h-8 w-8" aria-hidden />
              )}
              <div className="min-w-0 flex-1 text-center">
                <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-[#111827]">
                  {screenHeading(activeStep)}
                </h1>
                <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
                  {screenSubtitle(activeStep)}
                </p>
              </div>
              <span className="inline-flex h-8 w-8" aria-hidden />
            </div>

            <ProgressHeader current={stepIndex} total={steps.length} label={activeStep.label} />

            {activeStep.type === "basic" ? (
              <BasicProfileStep
                data={data}
                updateBasic={updateBasic}
                updateAccount={updateAccount}
                openCropper={openCropper}
                fieldErrors={basicFieldErrors}
                setFieldError={(field, message) =>
                  setBasicFieldErrors((current) => ({
                    ...current,
                    [field]: message,
                  }))
                }
                setSubmitError={setSubmitError}
              />
            ) : null}
            {activeStep.type === "pre-verification" ? (
              <PreVerificationStep data={data} onUpdate={updateVerification} />
            ) : null}
            {activeStep.type === "services" ? (
              <SelectServicesStep
                selectedServices={data.selectedServices}
                onToggle={toggleService}
                error={servicesError}
              />
            ) : null}
            {activeStep.type === "service-detail" ? (
              <ServiceDetailsStep
                service={activeStep.service}
                details={data.serviceDetails[activeStep.service]}
                onUpdate={updateServiceDetail}
                openCropper={openCropper}
              />
            ) : null}
            {activeStep.type === "availability" ? (
              <AvailabilityStep data={data} onToggleDay={toggleAvailabilityDay} onUpdate={updateAvailability} />
            ) : null}
            {activeStep.type === "location" ? (
              <ProviderLocationStep
                data={data}
                setSubmitError={setSubmitError}
                onUpdate={(field, value) =>
                  setData((current) => ({
                    ...current,
                    basicProfile: {
                      ...current.basicProfile,
                      ...(field === "areaLabel"
                        ? { serviceLocation: String(value) }
                        : {}),
                      ...(field === "radius"
                        ? { serviceRadius: Number(value) }
                        : {}),
                    },
                    providerLocation: { ...current.providerLocation, [field]: value },
                  }))
                }
              />
            ) : null}
            {activeStep.type === "review" ? (
              <ReviewStep
                data={data}
                onEditSection={(section) => {
                  if (section === "profile") {
                    setStepIndex(0);
                    return;
                  }
                  if (section === "services") {
                    setStepIndex(1);
                    return;
                  }
                  if (section === "availability") {
                    setStepIndex(steps.findIndex((step) => step.type === "availability"));
                  }
                }}
              />
            ) : null}
            {activeStep.type === "submitted" ? (
              <SubmissionChoiceStep
                registrationId={registrationId}
                onStartVerification={() =>
                  setStepIndex((current) => Math.min(current + 1, steps.length - 1))
                }
              />
            ) : null}
            {activeStep.type === "verification" ? (
              <VerificationStep data={data} onUpdate={updateVerification} />
            ) : null}
            {activeStep.type === "identity" ? (
              <IdentityStep
                data={data}
                onUpdate={updateVerification}
                openCropper={openCropper}
              />
            ) : null}
            {activeStep.type === "success" ? (
              <SuccessStep data={data} registrationId={registrationId} />
            ) : null}

            {submitError ? (
              <p className="mt-4 rounded-[12px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
                {submitError}
              </p>
            ) : null}

            {activeStep.type !== "success" && activeStep.type !== "submitted" ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.2)]"
              >
                {isSubmitting ? "Submitting..." : buttonLabel(activeStep)}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {showBasicProfileSavedModal ? (
        <BasicProfileSavedModal
          onContinue={() => {
            setShowBasicProfileSavedModal(false);
            setStepIndex(getStepIndex("services"));
          }}
        />
      ) : null}
      {cropState ? (
        <ImageCropModal
          imageDataUrl={cropState.sourceDataUrl}
          tone={cropState.tone}
          aspectRatio={cropState.aspectRatio}
          onClose={() => setCropState(null)}
          onApply={async (selection) => {
            try {
              const cropped = await cropImageFromSelection(cropState.sourceDataUrl, selection);
              cropState.onApply(cropped, cropState.fileName);
              setCropState(null);
            } catch (error) {
              setSubmitError(
                error instanceof Error ? error.message : "Unable to crop this image.",
              );
            }
          }}
        />
      ) : null}
    </main>
  );
}

function BasicProfileStep({
  data,
  updateBasic,
  updateAccount,
  openCropper,
  fieldErrors,
  setFieldError,
  setSubmitError,
}: {
  data: ProviderRegistrationData;
  updateBasic: (
    field: keyof ProviderRegistrationData["basicProfile"],
    value: string | number
  ) => void;
  updateAccount: (
    field: keyof ProviderRegistrationData["account"],
    value: string
  ) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
  fieldErrors: Record<string, string>;
  setFieldError: (field: string, message: string) => void;
  setSubmitError: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordRuleFailures = getPasswordRuleFailures(data.account.password);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void (async () => {
      try {
        setSubmitError("");
        await openCropper({
          file,
          tone: "profile",
          aspectRatio: 1,
          onApply: (dataUrl, fileName) => {
            updateBasic("profileImageName", fileName);
            updateBasic("avatarDataUrl", dataUrl);
          },
        });
      } catch (error) {
        setFieldError(
          "profileImage",
          error instanceof Error ? error.message : "Unable to process the profile photo.",
        );
        setSubmitError("");
      }
    })();
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
          Profile Image
        </span>
        <div className="rounded-[18px] border border-[#d9e2dd] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-4">
            <div className="relative flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f1fa]">
              {data.basicProfile.avatarDataUrl ? (
                <Image
                  src={data.basicProfile.avatarDataUrl}
                  alt="Profile preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <ProfilePhotoIcon className="h-8 w-8 text-[#8E5EB5]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#111827]">
                Add a profile photo
              </p>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                JPG, JPEG, PNG, GIF, or WEBP. Max 2MB. Crop before upload.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={PROFILE_AND_MEDIA_ACCEPT}
                onChange={handleAvatarChange}
                className="mt-3 block w-full text-[13px] text-[#4b5563] file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#8E5EB5] file:px-3 file:py-2 file:font-bold file:text-white"
              />
              {fieldErrors.profileImage ? (
                <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">
                  {fieldErrors.profileImage}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </label>

      <InputField
        label="First Name"
        value={data.basicProfile.firstName}
        error={fieldErrors.firstName}
        invalid={Boolean(fieldErrors.firstName)}
        onChange={(value) => updateBasic("firstName", value)}
      />
      <InputField
        label="Last Name"
        value={data.basicProfile.lastName}
        error={fieldErrors.lastName}
        invalid={Boolean(fieldErrors.lastName)}
        onChange={(value) => updateBasic("lastName", value)}
      />
      <SelectField
        label="Gender"
        value={data.basicProfile.sex}
        error={fieldErrors.sex}
        invalid={Boolean(fieldErrors.sex)}
        onChange={(value) => updateBasic("sex", value)}
        options={sexOptions}
      />
      <InputField label="Marketing Name" hint="e.g. Della Home Chef" value={data.basicProfile.marketingName} onChange={(value) => updateBasic("marketingName", value)} />
      <DateInputField
        label="Date of Birth"
        value={data.basicProfile.dateOfBirth}
        error={fieldErrors.dateOfBirth}
        invalid={Boolean(fieldErrors.dateOfBirth)}
        onChange={(value) => updateBasic("dateOfBirth", value)}
      />
      <div className="rounded-[16px] border border-[#ebe4f6] bg-[#fbf8ff] px-4 py-3">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#8E5EB5]">
          Address
        </p>
        <p className="mt-1 text-[12px] text-[#6b7280]">
          Enter the residential address used for your provider account.
        </p>
      </div>
      <InputField
        label="Unit No"
        value={data.basicProfile.unitNumber}
        onChange={(value) => updateBasic("unitNumber", value)}
      />
      <InputField
        label="Address Line 1"
        value={data.basicProfile.addressLine1}
        error={fieldErrors.addressLine1}
        invalid={Boolean(fieldErrors.addressLine1)}
        onChange={(value) => updateBasic("addressLine1", value)}
      />
      <InputField
        label="Address Line 2"
        value={data.basicProfile.addressLine2}
        onChange={(value) => updateBasic("addressLine2", value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Postcode"
          value={data.basicProfile.postcode}
          error={fieldErrors.postcode}
          invalid={Boolean(fieldErrors.postcode)}
          onChange={(value) => updateBasic("postcode", value)}
        />
        <InputField
          label="City"
          value={data.basicProfile.city}
          error={fieldErrors.city}
          invalid={Boolean(fieldErrors.city)}
          onChange={(value) => updateBasic("city", value)}
        />
      </div>
      <SelectField
        label="State"
        value={data.basicProfile.state}
        error={fieldErrors.state}
        invalid={Boolean(fieldErrors.state)}
        onChange={(value) => updateBasic("state", value)}
        options={malaysianStates}
      />
      <InputField
        label="Country"
        value={data.basicProfile.country}
        error={fieldErrors.country}
        invalid={Boolean(fieldErrors.country)}
        onChange={(value) => updateBasic("country", value)}
      />

      <InputField
        label="Email"
        value={data.account.email}
        error={fieldErrors.email}
        invalid={Boolean(fieldErrors.email)}
        onChange={(value) => updateAccount("email", value)}
      />
      <div>
        <p className="mb-2 text-[13px] font-semibold text-[#111827]">Phone</p>
        <div className="flex gap-2">
          <div className="flex h-11 w-[6.2rem] items-center rounded-[12px] border border-[#dfe8e2] px-3 text-[13px]">
            <MalaysiaFlagIcon className="mr-2 h-4 w-6 rounded-[3px]" />
            <span>{data.account.phoneCountryCode}</span>
            <ChevronDownIcon className="ml-auto h-4 w-4 text-[#6b7280]" />
          </div>
          <div className={`flex flex-1 items-center rounded-[12px] border px-4 ${fieldErrors.phoneNumber ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#dfe8e2]"}`}>
            <input
              value={data.account.phoneNumber}
              onChange={(event) => {
                updateAccount("phoneNumber", event.target.value);
              }}
              className="h-11 w-full border-0 bg-transparent text-[14px] text-[#111827] outline-none"
            />
          </div>
        </div>
        {fieldErrors.phoneNumber ? (
          <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{fieldErrors.phoneNumber}</p>
        ) : null}
      </div>
      <InputField
        label="Emergency Contact Number"
        value={data.basicProfile.emergencyContact || data.basicProfile.emergencyContactNumber}
        error={fieldErrors.emergencyContactNumber}
        invalid={Boolean(fieldErrors.emergencyContactNumber)}
        onChange={(value) => {
          updateBasic("emergencyContact", value);
          updateBasic("emergencyContactNumber", value);
        }}
      />
      <InputField
        label="Password"
        value={data.account.password}
        error={fieldErrors.password}
        invalid={Boolean(fieldErrors.password)}
        onChange={(value) => updateAccount("password", value)}
        rightIcon={<EyeIcon className="h-4 w-4 text-[#6b7280]" />}
        type="password"
      />
      <div className="rounded-[14px] bg-[#f5f1fa] px-4 py-3 text-[12px] leading-6 text-[#4b5563]">
        <p className={passwordRuleFailures.some((item) => item.includes("uppercase")) ? "text-[#dc2626]" : ""}>
          At least 1 uppercase letter
        </p>
        <p className={passwordRuleFailures.some((item) => item.includes("lowercase")) ? "text-[#dc2626]" : ""}>
          At least 1 lowercase letter
        </p>
        <p className={passwordRuleFailures.some((item) => item.includes("digit")) ? "text-[#dc2626]" : ""}>
          At least 1 number
        </p>
        <p className={passwordRuleFailures.some((item) => item.includes("symbol")) ? "text-[#dc2626]" : ""}>
          At least 1 symbol
        </p>
        <p className={passwordRuleFailures.some((item) => item.includes("8 characters")) ? "text-[#dc2626]" : ""}>
          At least 8 characters
        </p>
      </div>
      <InputField
        label="Retype Password"
        value={data.account.confirmPassword}
        error={fieldErrors.confirmPassword}
        invalid={Boolean(fieldErrors.confirmPassword)}
        onChange={(value) => updateAccount("confirmPassword", value)}
        rightIcon={<EyeIcon className="h-4 w-4 text-[#6b7280]" />}
        type="password"
      />
    </div>
  );
}

function SelectServicesStep({
  selectedServices,
  onToggle,
  error,
}: {
  selectedServices: ProviderService[];
  onToggle: (service: ProviderService) => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {providerServices.map((service) => {
        const active = selectedServices.includes(service);
        return (
          <button
            key={service}
            type="button"
            onClick={() => onToggle(service)}
            className="flex w-full items-center justify-between rounded-[16px] border border-[#e1e9e4] bg-white px-4 py-4 text-left shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5faf6] text-[#111827]">
                <ServiceIcon kind={serviceIcons[service]} className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-semibold text-[#111827]">{service}</span>
            </div>
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-[6px] border ${active ? "border-[#8E5EB5] bg-[#8E5EB5] text-white" : "border-[#cfd8d2] bg-white text-transparent"}`}>
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        );
      })}
      {error ? <p className="text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </div>
  );
}

function ServiceDetailsStep({
  service,
  details,
  onUpdate,
  openCropper,
}: {
  service: ProviderService;
  details: ProviderRegistrationData["serviceDetails"][ProviderService];
  onUpdate: (
    service: ProviderService,
    field: keyof ProviderRegistrationData["serviceDetails"][ProviderService],
    value: string | string[]
  ) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
}) {
  const specialtyExamples = serviceSpecialties[service];

  return (
    <div className="space-y-4">
      <SelectField label="Years of Experience" value={details.yearsExperience} onChange={(value) => onUpdate(service, "yearsExperience", value)} options={["1 Year", "2 Years", "3 Years", "4 Years", "5 Years", "6 Years", "7 Years", "8+ Years"]} />

      <TagInput
        label={`${service} Service Types / Specialties`}
        hint={`Type and press comma or Enter. Examples: ${specialtyExamples.join(", ")}`}
        values={details.specialties}
        onChange={(nextValues) => onUpdate(service, "specialties", nextValues)}
      />

      <AssetStrip
        label="Service Images"
        captions={details.imageCaptions}
        previews={details.imageDataUrls}
        tone="media"
        onSelect={(index, dataUrl) => {
          const nextDataUrls = [...details.imageDataUrls];
          nextDataUrls[index] = dataUrl;
          onUpdate(service, "imageDataUrls", nextDataUrls);
        }}
        onCaptionChange={(index, caption) => {
          const nextCaptions = [...details.imageCaptions];
          nextCaptions[index] = caption;
          onUpdate(service, "imageCaptions", nextCaptions);
        }}
        openCropper={openCropper}
      />
      <AssetStrip
        label="Certificates"
        captions={details.certificateCaptions}
        previews={details.certificateDataUrls}
        tone="certificate"
        onSelect={(index, dataUrl) => {
          const nextDataUrls = [...details.certificateDataUrls];
          nextDataUrls[index] = dataUrl;
          onUpdate(service, "certificateDataUrls", nextDataUrls);
        }}
        onCaptionChange={(index, caption) => {
          const nextCaptions = [...details.certificateCaptions];
          nextCaptions[index] = caption;
          onUpdate(service, "certificateCaptions", nextCaptions);
        }}
        openCropper={openCropper}
      />

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[#111827]">Rate</p>
        <div className="grid grid-cols-2 gap-3">
          <InputField compact label="Per Hour (RM)" value={details.hourlyRate} onChange={(value) => onUpdate(service, "hourlyRate", value)} />
          <InputField compact label="Per Day (RM)" value={details.dailyRate} onChange={(value) => onUpdate(service, "dailyRate", value)} />
        </div>
      </div>
    </div>
  );
}

function AvailabilityStep({
  data,
  onToggleDay,
  onUpdate,
}: {
  data: ProviderRegistrationData;
  onToggleDay: (day: string) => void;
  onUpdate: (
    field: keyof ProviderRegistrationData["availability"],
    value: string | string[]
  ) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#111827]">Days</p>
          <button
            type="button"
            onClick={() => onUpdate("days", [...availabilityDays])}
            className="text-[12px] font-bold text-[#8E5EB5]"
          >
            Select All
          </button>
        </div>
        <div className="space-y-2">
          {availabilityDays.map((day) => {
            const active = data.availability.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => onToggleDay(day)}
                className="flex w-full items-center justify-between rounded-[12px] px-1 py-1 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-[6px] border ${active ? "border-[#8E5EB5] bg-[#8E5EB5] text-white" : "border-[#cfd8d2] bg-white text-transparent"}`}>
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[14px] text-[#111827]">{day}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[#111827]">Time</p>
        <div className="space-y-2">
          {timePresets.map((preset) => {
            const active = data.availability.timePreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdate("timePreset", preset)}
                className="flex w-full items-center gap-3 rounded-[12px] px-1 py-1 text-left"
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-[#8E5EB5]" : "border-[#cfd8d2]"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#8E5EB5]" : "bg-transparent"}`} />
                </span>
                <span className="text-[14px] text-[#111827]">{preset}</span>
              </button>
            );
          })}
        </div>
      </div>

      {data.availability.timePreset === "Custom Time" ? (
        <div className="grid grid-cols-2 gap-3">
          <SelectField compact label="Start Time" value={data.availability.startTime} onChange={(value) => onUpdate("startTime", value)} options={AVAILABILITY_TIME_OPTIONS} />
          <SelectField compact label="End Time" value={data.availability.endTime} onChange={(value) => onUpdate("endTime", value)} options={AVAILABILITY_TIME_OPTIONS} />
        </div>
      ) : null}
    </div>
  );
}

function ProviderLocationStep({
  data,
  setSubmitError,
  onUpdate,
}: {
  data: ProviderRegistrationData;
  setSubmitError: (value: string) => void;
  onUpdate: (
    field: keyof ProviderRegistrationData["providerLocation"],
    value: string | number
  ) => void;
}) {
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const updateMapLocation = async (latitude: number, longitude: number) => {
    setIsResolvingAddress(true);

    try {
      const response = await fetch(
        `/api/location/reverse?lat=${latitude}&lng=${longitude}`,
        { cache: "no-store" }
      );
      const resolved = (await response.json()) as ReverseLocationResponse;
      const locationLabel =
        resolved.formattedAddress?.trim() ||
        resolved.label?.trim() ||
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      onUpdate("latitude", latitude);
      onUpdate("longitude", longitude);
      onUpdate("areaLabel", locationLabel);
      onUpdate("formattedAddress", resolved.formattedAddress?.trim() || locationLabel);
      onUpdate("road", resolved.road?.trim() || "");
      onUpdate("suburb", resolved.suburb?.trim() || "");
      onUpdate("city", resolved.city?.trim() || "");
      onUpdate("state", resolved.state?.trim() || "");
      onUpdate("postcode", resolved.postcode?.trim() || "");
      onUpdate("country", resolved.country?.trim() || "");
      onUpdate("houseNumber", resolved.houseNumber?.trim() || "");
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const requestCurrentLocation = () => {
    setIsLocating(true);
    void resolveCurrentLiveLocation("Current location", { persist: "current" })
      .then((nextLocation) => {
        if (!nextLocation) {
          setSubmitError("Location is not supported on this device.");
          return;
        }

        setSubmitError("");
        onUpdate("latitude", nextLocation.latitude);
        onUpdate("longitude", nextLocation.longitude);
        onUpdate("areaLabel", nextLocation.label || nextLocation.formattedAddress || "Current location");
        onUpdate(
          "formattedAddress",
          nextLocation.formattedAddress || nextLocation.label || "Current location",
        );
        onUpdate("road", nextLocation.road || "");
        onUpdate("suburb", nextLocation.suburb || "");
        onUpdate("city", nextLocation.city || "");
        onUpdate("state", nextLocation.state || "");
        onUpdate("postcode", nextLocation.postcode || "");
        onUpdate("country", nextLocation.country || "");
        onUpdate("houseNumber", nextLocation.houseNumber || "");
      })
      .catch(() => {
        setSubmitError("Unable to get current location. Please allow location access.");
      })
      .finally(() => {
        setIsLocating(false);
      });
  };

  useEffect(() => {
    if (!data.providerLocation.areaLabel.trim()) {
      requestCurrentLocation();
    }
  }, [data.providerLocation.areaLabel]);

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[#dfe8e2] bg-[#f6fbf7] p-4">
        <div className="space-y-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-6 text-[#111827] break-words">
              {isResolvingAddress
                ? "Updating address..."
                : data.providerLocation.areaLabel || "Current location not loaded yet."}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
              Providers will be visible to users inside this service radius.
            </p>
          </div>
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-white px-4 text-[13px] font-bold text-[#8E5EB5] shadow-[0_8px_20px_rgba(15,23,42,0.03)] sm:w-auto"
          >
            <PinIcon className="h-4 w-4" />
            {isLocating ? "Locating..." : "Use Current Location"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#dfe8e2] bg-[linear-gradient(180deg,#f7fbf7_0%,#eff7ef_100%)]">
        <div className="relative h-[18rem] overflow-hidden">
          <DynamicLocationPickerMap
            latitude={data.providerLocation.latitude}
            longitude={data.providerLocation.longitude}
            radiusKm={data.providerLocation.radius}
            onChange={({ latitude, longitude }) => {
              void updateMapLocation(latitude, longitude);
            }}
          />
          <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#8E5EB5] shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
            {data.providerLocation.radius} KM
          </span>
          <span className="absolute bottom-4 left-4 right-4 rounded-[12px] bg-white/92 px-3 py-2 text-[13px] font-medium text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
            {isResolvingAddress
              ? "Updating address..."
              : data.providerLocation.areaLabel || "Current location not loaded yet."}
          </span>
        </div>
      </div>

      <RangeField
        label="Service Radius"
        value={data.providerLocation.radius}
        min={5}
        max={30}
        suffix="KM"
        onChange={(value) => onUpdate("radius", value)}
      />
    </div>
  );
}

function ReviewStep({
  data,
  onEditSection,
}: {
  data: ProviderRegistrationData;
  onEditSection: (section: "profile" | "services" | "availability") => void;
}) {
  return (
    <div className="space-y-5">
      <ReviewCard title="Profile">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => onEditSection("profile")}
            className="rounded-[10px] border border-[#e6daf1] bg-[#fbf8ff] px-3 py-1.5 text-[12px] font-bold text-[#8E5EB5]"
          >
            Edit
          </button>
        </div>
        {data.basicProfile.avatarDataUrl ? (
          <div className="mb-4 flex justify-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[#e5d9f3]">
              <Image
                src={data.basicProfile.avatarDataUrl}
                alt="Profile preview"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          </div>
        ) : null}
        <ReviewLine icon={<UserIcon className="h-4 w-4" />} text={`${getProviderFullName(data)} (${data.basicProfile.marketingName})`} />
        <ReviewLine icon={<UserIcon className="h-4 w-4" />} text={`Gender: ${data.basicProfile.sex || "Male"}`} />
        <ReviewLine icon={<PhoneIcon className="h-4 w-4" />} text={`${data.account.phoneCountryCode} ${data.account.phoneNumber}`} />
        <ReviewLine icon={<RangeIcon className="h-4 w-4" />} text={`${data.providerLocation.radius} KM`} />
        <ReviewLine icon={<PinIcon className="h-4 w-4" />} text={combineResidentialAddress(data.basicProfile) || "No residential address provided"} />
      </ReviewCard>

      <ReviewCard title="Services">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => onEditSection("services")}
            className="rounded-[10px] border border-[#e6daf1] bg-[#fbf8ff] px-3 py-1.5 text-[12px] font-bold text-[#8E5EB5]"
          >
            Edit
          </button>
        </div>
        <div className="space-y-4">
          {data.selectedServices.map((service) => {
            const details = data.serviceDetails[service];
            return (
              <div key={service} className="border-t border-[#ecf1ed] pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-[14px] font-extrabold text-[#111827]">{service}</h3>
                <p className="mt-1 text-[13px] text-[#4b5563]">
                  RM{details.hourlyRate}/hr - RM{details.dailyRate}/day
                </p>
                <p className="mt-1 text-[13px] text-[#4b5563]">{details.yearsExperience} Exp</p>
                {details.specialties.length > 0 ? (
                  <p className="mt-1 text-[13px] text-[#4b5563]">
                    {details.specialties.join(", ")}
                  </p>
                ) : null}
                {details.imageDataUrls.some(Boolean) ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {details.imageDataUrls.map((image, index) =>
                      image ? (
                        <div key={`${service}-image-${index}`} className="space-y-1">
                          <div className="relative aspect-square overflow-hidden rounded-[12px] border border-[#e5d9f3]">
                            <Image src={image} alt={details.imageCaptions[index] || `${service} work ${index + 1}`} fill unoptimized className="object-cover" />
                          </div>
                          <p className="text-[11px] text-[#6b7280]">
                            {details.imageCaptions[index] || `Work ${index + 1}`}
                          </p>
                        </div>
                      ) : null,
                    )}
                  </div>
                ) : null}
                {details.certificateDataUrls.some(Boolean) ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-[12px] font-semibold text-[#111827]">Certificates</p>
                    {details.certificateDataUrls.map((file, index) =>
                      file ? (
                        <p key={`${service}-cert-${index}`} className="text-[12px] text-[#6b7280]">
                          {details.certificateCaptions[index] || `Certificate ${index + 1}`}
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ReviewCard>

      <ReviewCard title="Availability">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => onEditSection("availability")}
            className="rounded-[10px] border border-[#e6daf1] bg-[#fbf8ff] px-3 py-1.5 text-[12px] font-bold text-[#8E5EB5]"
          >
            Edit
          </button>
        </div>
        <p className="text-[13px] text-[#374151]">
          {formatAvailabilityDays(data.availability.days)} - {data.availability.timePreset === "Custom Time" ? `${data.availability.startTime} - ${data.availability.endTime}` : data.availability.timePreset}
        </p>
      </ReviewCard>
    </div>
  );
}

function VerificationStep({
  data,
  onUpdate,
}: {
  data: ProviderRegistrationData;
  onUpdate: (
    field: keyof ProviderRegistrationData["verification"],
    value: string | string[]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <PhoneOtpGroup
        value={`${data.account.phoneCountryCode} ${data.account.phoneNumber}`}
        otp={data.verification.phoneOtp}
        onChange={(next) => onUpdate("phoneOtp", next)}
      />
      <div className="rounded-[16px] border border-[#e5d9f3] bg-[#fbf8ff] px-4 py-3">
        <p className="text-[13px] font-extrabold text-[#111827]">Email Verification</p>
        <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
          We removed email OTP here. Your email will be verified from the activation link sent to{" "}
          <span className="font-bold text-[#111827]">{data.account.email || "your email"}</span>.
        </p>
      </div>
    </div>
  );
}

function PreVerificationStep({
  data,
  onUpdate,
}: {
  data: ProviderRegistrationData;
  onUpdate: (
    field: keyof ProviderRegistrationData["verification"],
    value: string | string[]
  ) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[#d7efdd] bg-[linear-gradient(180deg,#fbfffc_0%,#f2fbf4_100%)] p-5 shadow-[0_14px_30px_rgba(22,163,74,0.08)]">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#8E5EB5]/15" />
          <span className="absolute inset-2 rounded-full bg-[#8E5EB5]/10" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#8E5EB5] text-white shadow-[0_16px_28px_rgba(142,94,181,0.22)]">
            <CheckCircleFilledIcon className="h-7 w-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-[22px] font-extrabold tracking-[-0.04em] text-[#111827]">
          Verify Your Email
        </h2>
        <p className="mt-2 text-center text-[13px] leading-6 text-[#4b5563]">
          Your personal details are saved in this registration flow. We will send your activation
          email to <span className="font-bold text-[#111827]">{data.account.email || "your email"}</span>{" "}
          after you submit the provider registration.
        </p>
      </div>

      <VerificationStep data={data} onUpdate={onUpdate} />

      <div className="rounded-[16px] border border-[#e5d9f3] bg-white px-4 py-3 text-[12px] leading-5 text-[#6b7280] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        You can continue to select the services you provide after this step and finish account
        activation once your registration is submitted.
      </div>
    </div>
  );
}

function IdentityStep({
  data,
  onUpdate,
  openCropper,
}: {
  data: ProviderRegistrationData;
  onUpdate: (
    field: keyof ProviderRegistrationData["verification"],
    value: string | string[]
  ) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Document Type"
        value={data.verification.documentType}
        onChange={(value) => onUpdate("documentType", value)}
        options={documentTypes}
      />
      <UploadCard
        label="Upload Document (Front)"
        fileName={data.verification.frontImageName}
        preview={data.verification.frontImageDataUrl}
        onSelect={(fileName, dataUrl) => {
          onUpdate("frontImageName", fileName);
          onUpdate("frontImageDataUrl", dataUrl);
        }}
        openCropper={openCropper}
      />
      <UploadCard
        label="Upload Document (Back)"
        fileName={data.verification.backImageName}
        preview={data.verification.backImageDataUrl}
        onSelect={(fileName, dataUrl) => {
          onUpdate("backImageName", fileName);
          onUpdate("backImageDataUrl", dataUrl);
        }}
        openCropper={openCropper}
      />
    </div>
  );
}

function SuccessStep({
  data,
  registrationId,
}: {
  data: ProviderRegistrationData;
  registrationId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-[#e4ece7] bg-white p-5 text-center shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
        {data.basicProfile.avatarDataUrl ? (
          <div className="mx-auto mb-4 relative h-24 w-24 overflow-hidden rounded-full border border-[#e5d9f3]">
            <Image
              src={data.basicProfile.avatarDataUrl}
              alt="Profile preview"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#8E5EB5] text-white shadow-[0_18px_30px_rgba(142,94,181,0.22)]">
          <CheckIcon className="h-10 w-10" />
        </div>
        <h2 className="mt-5 text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">
          Profile Submitted for Verification
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#4b5563]">
          Your profile submitted for verification. You will verify within 48 hrs. For more details contact:{" "}
          <a href="mailto:admin@myswiper.my" className="font-extrabold text-[#8E5EB5]">
            admin@myswiper.my
          </a>
        </p>
        <Link
          href="/provider/profile"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] text-[14px] font-extrabold text-white"
        >
          View Profile
        </Link>
      </div>

      <div className="rounded-[20px] border border-[#e4ece7] bg-[linear-gradient(180deg,#fcfffd_0%,#f4fbf5_100%)] p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
        <h3 className="text-[22px] font-extrabold tracking-[-0.04em] text-[#8E5EB5]">
          Registration Summary
        </h3>
        <p className="mt-1 text-[13px] text-[#4b5563]">
          These are the actual details sent from this form.
        </p>

        <div className="mt-4 rounded-[16px] border border-[#bfe8c9] bg-white p-4">
          <div className="space-y-3 text-[13px] text-[#374151]">
            <ReviewLine
              icon={<UserIcon className="h-4 w-4" />}
              text={getProviderFullName(data) || "No name provided"}
            />
            <ReviewLine
              icon={<RangeIcon className="h-4 w-4" />}
              text={`${data.providerLocation.radius} KM service radius`}
            />
            <ReviewLine
              icon={<PhoneIcon className="h-4 w-4" />}
              text={`${data.account.phoneCountryCode} ${data.account.phoneNumber}`}
            />
            <ReviewLine
              icon={<CheckIcon className="h-4 w-4" />}
              text={`Registration ID: ${registrationId || "Pending"}`}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#dfe8e2] bg-white p-4">
          <h4 className="text-[15px] font-extrabold text-[#111827]">Selected Services</h4>
          <div className="mt-3 space-y-2">
            {data.selectedServices.map((service) => {
              const details = data.serviceDetails[service];

              return (
                <p key={service} className="text-[13px] text-[#374151]">
                  {service}: RM{details.hourlyRate || "0"}/hr, RM
                  {details.dailyRate || "0"}/day
                </p>
              );
            })}
          </div>
          {data.selectedServices.map((service) => {
            const details = data.serviceDetails[service];
            if (!details.imageDataUrls.some(Boolean) && !details.certificateDataUrls.some(Boolean)) {
              return null;
            }

            return (
              <div key={`${service}-assets`} className="mt-4 border-t border-[#ecf1ed] pt-4">
                <h5 className="text-[13px] font-bold text-[#111827]">{service} uploads</h5>
                {details.imageDataUrls.some(Boolean) ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {details.imageDataUrls.map((image, index) =>
                      image ? (
                        <div key={`${service}-success-image-${index}`} className="space-y-1">
                          <div className="relative aspect-square overflow-hidden rounded-[10px] border border-[#e5d9f3]">
                            <Image src={image} alt={details.imageCaptions[index] || `Work ${index + 1}`} fill unoptimized className="object-cover" />
                          </div>
                          <p className="text-[11px] text-[#6b7280]">{details.imageCaptions[index] || `Work ${index + 1}`}</p>
                        </div>
                      ) : null,
                    )}
                  </div>
                ) : null}
                {details.certificateDataUrls.some(Boolean) ? (
                  <div className="mt-3 space-y-1">
                    {details.certificateDataUrls.map((file, index) =>
                      file ? (
                        <p key={`${service}-success-cert-${index}`} className="text-[12px] text-[#6b7280]">
                          Certificate: {details.certificateCaptions[index] || `Certificate ${index + 1}`}
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/provider/dashboard"
        className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.2)]"
      >
        View My Profile
      </Link>
    </div>
  );
}

function SubmissionChoiceStep({
  registrationId,
  onStartVerification,
}: {
  registrationId: string;
  onStartVerification: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-[#d7efdd] bg-[linear-gradient(180deg,#fbfffc_0%,#f2fbf4_100%)] p-6 text-center shadow-[0_16px_36px_rgba(22,163,74,0.08)]">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#8E5EB5]/15" />
          <span className="absolute inset-2 rounded-full bg-[#8E5EB5]/10" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#8E5EB5] text-white shadow-[0_18px_30px_rgba(142,94,181,0.24)]">
            <CheckIcon className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-5 text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">
          Your Listing Has Been Submitted
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#4b5563]">
          Registration ID: {registrationId || "Pending"}.
          Verify your account now, or go straight to your own profile.
        </p>
      </div>

      <button
        type="button"
        onClick={onStartVerification}
        className="inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.2)]"
      >
        Verify Account
      </button>

      <Link
        href="/provider/dashboard"
        className="inline-flex h-12 w-full items-center justify-center rounded-[12px] border border-[#d8e4dc] bg-white text-[15px] font-extrabold text-[#111827] shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
      >
        Go to Profile
      </Link>
    </div>
  );
}

function BasicProfileSavedModal({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 px-4 pb-6 pt-10 sm:items-center">
      <div className="w-full max-w-[390px] overflow-hidden rounded-[28px] border border-[#e6daf1] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.22)] animate-[fade-in_220ms_ease-out]">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#8E5EB5]/15" />
          <span className="absolute inset-2 rounded-full bg-[#8E5EB5]/10" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#8E5EB5] text-white shadow-[0_18px_30px_rgba(142,94,181,0.24)]">
            <CheckIcon className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">
          Your Personal Details Are Saved
        </h2>
        <p className="mt-3 text-center text-[14px] leading-6 text-[#4b5563]">
          Your personal details have been saved successfully.
        </p>
        <p className="mt-2 text-center text-[12px] leading-5 text-[#6b7280]">
          Next, select the services you provide to continue your provider registration.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#8E5EB5] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.2)]"
        >
          Select Services
        </button>
      </div>
    </div>
  );
}

function ProgressHeader({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="font-bold text-[#8E5EB5]">Step {current + 1}</span>
        <span className="text-[#6b7280]">{current + 1}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-[#e6ece8]">
        <div
          className="h-2 rounded-full bg-[#8E5EB5]"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] font-semibold text-[#111827]">{label}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  hint,
  error,
  rightIcon,
  compact = false,
  type = "text",
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  rightIcon?: React.ReactNode;
  compact?: boolean;
  type?: string;
  invalid?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";

  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#111827]">
        {label}
      </span>
      {hint ? <p className="-mt-1 mb-2 text-[11px] text-[#6b7280]">{hint}</p> : null}
      <div className={`flex items-center rounded-[12px] border px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#dfe8e2]"}`}>
        <input
          type={isPasswordField && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${compact ? "h-10" : "h-11"} w-full border-0 bg-transparent text-[14px] text-[#111827] outline-none`}
        />
        {rightIcon ? (
          <button
            type="button"
            aria-label={isPasswordField && showPassword ? "Hide password" : "Show password"}
            onClick={() => {
              if (isPasswordField) {
                setShowPassword((current) => !current);
              }
            }}
            className="ml-3"
          >
            {rightIcon}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function DateInputField({
  label,
  value,
  onChange,
  error,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxDate, setMaxDate] = useState("");

  useEffect(() => {
    setMaxDate(getTodayIso());
  }, []);

  const openPicker = () => {
    const input = inputRef.current as (HTMLInputElement & {
      showPicker?: () => void;
    }) | null;

    if (!input) {
      return;
    }

    input.focus();
    input.showPicker?.();
  };

  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className={`flex items-center rounded-[12px] border px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#dfe8e2]"}`}>
        <input
          ref={inputRef}
          type="date"
          max={maxDate || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          className="h-11 w-full border-0 bg-transparent text-[14px] text-[#111827] outline-none"
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label="Open date picker"
          className="ml-3 text-[#6b7280]"
        >
          <CalendarIcon className="h-4 w-4 text-[#6b7280]" />
        </button>
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className={`rounded-[12px] border px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#dfe8e2]"}`}>
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-none border-0 bg-transparent text-[14px] text-[#111827] outline-none"
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  invalid = false,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  invalid?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#111827]">{label}</span>
      <div className={`flex items-center rounded-[12px] border px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#dfe8e2]"}`}>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${compact ? "h-10" : "h-11"} w-full appearance-none border-0 bg-transparent text-[14px] text-[#111827] outline-none`}
        >
          {placeholder ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="ml-3 h-4 w-4 text-[#6b7280]" />
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-[#111827]">
        <span>{label}</span>
        <span className="text-[12px] text-[#111827]">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full accent-[#8E5EB5]"
      />
      <div className="mt-1 flex justify-between text-[11px] text-[#6b7280]">
        <span>{min} {suffix}</span>
        <span>{max} {suffix}</span>
      </div>
    </div>
  );
}

function AssetStrip({
  label,
  captions,
  previews,
  tone,
  onSelect,
  onCaptionChange,
  openCropper,
}: {
  label: string;
  captions: string[];
  previews: string[];
  tone: "media" | "certificate";
  onSelect: (index: number, dataUrl: string) => void;
  onCaptionChange: (index: number, caption: string) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-[#111827]">{label}</p>
      <p className="mb-3 text-[12px] text-[#6b7280]">
        {tone === "media"
          ? "Square images only. JPG, JPEG, PNG, or GIF under 2MB. Crop each image before upload."
          : "Certificates can be JPG, JPEG, PNG, GIF, or PDF up to 5MB."}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {captions.map((caption, index) => (
          <AssetUploadSlot
            key={`${label}-${index}`}
            index={index}
            caption={caption}
            preview={previews[index] ?? ""}
            tone={tone}
            onSelect={onSelect}
            onCaptionChange={onCaptionChange}
            openCropper={openCropper}
          />
        ))}
      </div>
    </div>
  );
}

function AssetUploadSlot({
  index,
  caption,
  preview,
  tone,
  onSelect,
  onCaptionChange,
  openCropper,
}: {
  index: number;
  caption: string;
  preview: string;
  tone: "media" | "certificate";
  onSelect: (index: number, dataUrl: string) => void;
  onCaptionChange: (index: number, caption: string) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState("");

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (tone === "media") {
        setFieldError("");
        await openCropper({
          file,
          tone: "service",
          aspectRatio: 1,
          onApply: (dataUrl, fileName) => {
            onSelect(index, dataUrl);
            if (!caption.trim()) {
              onCaptionChange(index, `Work ${index + 1}`);
            }
            if (fileName) {
              setFieldError("");
            }
          },
        });
      } else {
        const prepared = await prepareCertificateUpload(file);
        setFieldError("");
        onSelect(index, prepared.dataUrl);
        if (!caption.trim()) {
          onCaptionChange(
            index,
            prepared.displayName,
          );
        }
      }
    } catch (error) {
      setFieldError(
        error instanceof Error ? error.message : "Unable to process the selected file."
      );
    }
  };

  return (
    <div className="rounded-[14px] border border-[#dfe8e2] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.03)]">
      <input
        ref={inputRef}
        type="file"
        accept={tone === "media" ? PROFILE_AND_MEDIA_ACCEPT : CERTIFICATE_ACCEPT}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full text-left"
      >
        <div
          className={`relative flex ${tone === "media" ? "aspect-square h-auto" : "h-24"} items-center justify-center overflow-hidden rounded-[12px] border border-[#e1e9e4] ${
            preview ? "bg-white" : "bg-[#f8fbf8]"
          }`}
        >
          {preview && !preview.startsWith("data:application/pdf") ? (
            <Image
              src={preview}
              alt={caption || `Upload ${index + 1}`}
              fill
              unoptimized
              className="object-cover"
            />
          ) : preview ? (
            <div className="flex flex-col items-center justify-center text-center text-[#8E5EB5]">
              <UploadIcon className="h-6 w-6" />
              <span className="mt-2 text-[11px] font-semibold">PDF Ready</span>
            </div>
          ) : (
            <PlusIcon className="h-6 w-6 text-[#8E5EB5]" />
          )}
        </div>
      </button>
      <input
        value={caption}
        onChange={(event) => onCaptionChange(index, event.target.value)}
        placeholder={tone === "media" ? "Add image caption" : "Add certificate caption"}
        className="mt-2 h-10 w-full rounded-[10px] border border-[#dfe8e2] px-3 text-[12px] text-[#111827] outline-none"
      />
      {fieldError ? (
        <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}

function TagInput({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (nextValues: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const cleaned = draft.trim().replace(/,$/, "");
    if (!cleaned) {
      setDraft("");
      return;
    }

    if (!values.includes(cleaned)) {
      onChange([...values, cleaned]);
    }
    setDraft("");
  };

  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-[#111827]">
        {label}
      </label>
      {hint ? <p className="mb-2 text-[12px] text-[#6b7280]">{hint}</p> : null}
      <div className="rounded-[14px] border border-[#dfe8e2] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.03)]">
        {values.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {values.map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-2 rounded-full bg-[#f5f1fa] px-3 py-1.5 text-[12px] font-semibold text-[#8E5EB5]"
              >
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  className="text-[#8E5EB5]"
                  aria-label={`Remove ${value}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          value={draft}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue.includes(",")) {
              const parts = nextValue.split(",");
              const nextDraft = parts.pop() ?? "";
              const nextTags = parts
                .map((item) => item.trim())
                .filter(Boolean)
                .filter((item) => !values.includes(item));

              if (nextTags.length > 0) {
                onChange([...values, ...nextTags]);
              }
              setDraft(nextDraft);
              return;
            }
            setDraft(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
            if (event.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commitDraft}
          placeholder="Type and press comma"
          className="h-10 w-full border-0 bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
        />
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-[#e4ece7] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
      <h3 className="text-[14px] font-extrabold text-[#111827]">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ReviewLine({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-[13px] text-[#374151]">
      <span className="text-[#111827]">{icon}</span>
      {text}
    </div>
  );
}

function PhoneOtpGroup({
  value,
  otp,
  onChange,
}: {
  value: string;
  otp: string[];
  onChange: (otp: string[]) => void;
}) {
  const [sendState, setSendState] = useState<"idle" | "sent">("idle");

  return (
    <div className="rounded-[16px] border border-[#dfe8e2] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#111827]">Phone Number Verification</p>
          <p className="mt-1 text-[13px] text-[#374151]">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => setSendState("sent")}
          className="shrink-0 rounded-[11px] bg-[#8E5EB5] px-3 py-2 text-[12px] font-extrabold text-white"
        >
          Send OTP
        </button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {otp.map((digit, index) => (
          <input
            key={`phone-otp-${index}`}
            value={digit}
            inputMode="numeric"
            maxLength={1}
            onChange={(event) => {
              const next = [...otp];
              next[index] = event.target.value.replace(/\D/g, "").slice(-1);
              onChange(next);
            }}
            className="h-11 rounded-[10px] border border-[#dfe8e2] text-center text-[15px] font-semibold text-[#111827] outline-none"
          />
        ))}
      </div>
      <p className="mt-3 text-[12px] font-semibold text-[#8E5EB5]">
        {sendState === "sent"
          ? "OTP requested. Connect an SMS provider to deliver real codes."
          : "Tap Send OTP to verify this phone number."}
      </p>
    </div>
  );
}

function UploadCard({
  label,
  fileName,
  preview,
  onSelect,
  openCropper,
}: {
  label: string;
  fileName: string;
  preview: string;
  onSelect: (fileName: string, dataUrl: string) => void;
  openCropper: (options: {
    file: File;
    tone: CropTone;
    maxSizeBytes?: number;
    aspectRatio?: number;
    onApply: (dataUrl: string, fileName: string) => void;
  }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFieldError("Please choose a JPG or PNG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldError("Each upload must be 5MB or smaller.");
      return;
    }

    setFieldError("");
    void openCropper({
      file,
      tone: "document",
      maxSizeBytes: CERTIFICATE_UPLOAD_MAX_BYTES,
      onApply: (dataUrl, nextFileName) => {
        setFieldError("");
        onSelect(nextFileName, dataUrl);
      },
    }).catch((error) => {
      setFieldError(
        error instanceof Error ? error.message : "Unable to crop this document image."
      );
    });
  };

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-[#111827]">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        onChange={handleChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-32 w-full flex-col items-center justify-center rounded-[16px] border border-[#dfe8e2] bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf4_100%)]"
      >
        {preview ? (
          <div className="relative h-full w-full overflow-hidden rounded-[16px]">
            <Image
              src={preview}
              alt={fileName || label}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : (
          <>
            <UploadIcon className="h-8 w-8 text-[#8E5EB5]" />
            <p className="mt-3 text-[14px] font-bold text-[#111827]">Upload or Capture Image</p>
            <p className="mt-1 text-[12px] text-[#6b7280]">JPG, PNG (Max 5MB). Crop before saving.</p>
          </>
        )}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-10 rounded-[12px] border border-[#e5d9f3] bg-white text-[12px] font-extrabold text-[#8E5EB5]"
        >
          Choose Image
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="h-10 rounded-[12px] bg-[#8E5EB5] text-[12px] font-extrabold text-white"
        >
          Capture Photo
        </button>
      </div>
      {fileName ? (
        <p className="mt-2 truncate text-[12px] font-semibold text-[#111827]">
          {fileName}
        </p>
      ) : null}
      {fieldError ? (
        <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}

function buttonLabel(step: FlowStep) {
  switch (step.type) {
    case "pre-verification":
      return "Continue to Services";
    case "service-detail":
      return "Save Service";
    case "location":
      return "Confirm Location";
    case "review":
      return "Submit for Listing";
    case "identity":
      return "Submit Verification";
    case "verification":
      return "Continue";
    default:
      return "Continue";
  }
}

function getProviderFullName(data: ProviderRegistrationData) {
  return [data.basicProfile.firstName, data.basicProfile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function screenHeading(step: FlowStep) {
  switch (step.type) {
    case "basic":
      return "Create Your Profile";
    case "pre-verification":
      return "Verify Your Email";
    case "services":
      return "Select Services";
    case "service-detail":
      return `${step.service} Service`;
    case "availability":
      return "Availability";
    case "location":
      return "Provider Location";
    case "review":
      return "Review & Submit";
    case "submitted":
      return "Listing Submitted";
    case "verification":
      return "Verify Your Account";
    case "identity":
      return "Verify Your Identity";
    case "success":
      return "Profile Submitted";
  }
}

function screenSubtitle(step: FlowStep) {
  switch (step.type) {
    case "basic":
      return "Add your profile, contact, and login details";
    case "pre-verification":
      return "Review activation and continue to your service setup";
    case "services":
      return "Select one or more services you provide";
    case "service-detail":
      return "Add details about your service";
    case "availability":
      return "Select your available days and time";
    case "location":
      return "Set your service area";
    case "review":
      return "Please review your information";
    case "submitted":
      return "Choose whether to verify now or later";
    case "verification":
      return "Let's verify your contact information";
    case "identity":
      return "Upload your identity document";
    case "success":
      return "Verification saved successfully";
  }
}

function getPasswordRuleFailures(value: string) {
  const failures: string[] = [];

  if (value.length < 8) {
    failures.push("8 characters");
  }
  if (!/[A-Z]/.test(value)) {
    failures.push("uppercase");
  }
  if (!/[a-z]/.test(value)) {
    failures.push("lowercase");
  }
  if (!/\d/.test(value)) {
    failures.push("digit");
  }
  if (!/[^\w\s]/.test(value)) {
    failures.push("symbol");
  }

  return failures;
}

function formatAvailabilityDays(days: string[]) {
  if (days.length === 7) {
    return "Mon - Sun";
  }
  if (days.length === 0) {
    return "No days selected";
  }
  return days.join(", ");
}

function mediaThumbClasses(index: number) {
  const classes = [
    "bg-[linear-gradient(135deg,#b45309_0%,#f59e0b_100%)]",
    "bg-[linear-gradient(135deg,#78350f_0%,#f97316_100%)]",
    "bg-[linear-gradient(135deg,#9a3412_0%,#f59e0b_100%)]",
  ];

  return classes[index] ?? "bg-[linear-gradient(135deg,#d1d5db_0%,#9ca3af_100%)]";
}

function iconClass(className?: string) {
  return className ?? "h-5 w-5";
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className={iconClass(className)}>
      <path d="M15 18 9 12l6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={iconClass(className)}>
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleFilledIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass(className)}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9Z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.7-3 4.4-4.5 8-4.5s6.3 1.5 8 4.5" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M6.6 3h3.1l1.2 4.6-1.8 1.8a15 15 0 0 0 5.4 5.4l1.8-1.8L21 14.3v3.1c0 .9-.7 1.6-1.6 1.6C10.8 19 5 13.2 5 6.6 5 5.7 5.7 5 6.6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={iconClass(className)}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M12 16V5m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" strokeLinecap="round" />
    </svg>
  );
}

function RangeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M4 12h16" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProfilePhotoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass(className)}>
      <path d="M4 7h4l1.5-2h5L16 7h4v12H4z" />
      <circle cx="12" cy="13" r="4" />
      <path d="M18 4v4M16 6h4" strokeLinecap="round" />
    </svg>
  );
}

function MalaysiaFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className}>
      <rect width="28" height="20" rx="3" fill="#ffffff" />
      <path d="M0 0h14v10H0z" fill="#1d4ed8" />
      <path d="M0 0h28v2H0zm0 4h28v2H0zm0 8h28v2H0zm0 12h28v2H0z" fill="#ef4444" />
      <path d="M0 8h28v2H0zm0 8h28v2H0z" fill="#ef4444" />
      <circle cx="7" cy="5" r="3.3" fill="#facc15" />
      <circle cx="8.1" cy="5" r="2.6" fill="#1d4ed8" />
      <path d="m10.2 2.4.6 1.5 1.6.1-1.2 1 .4 1.5-1.4-.8-1.4.8.4-1.5-1.2-1 1.6-.1.6-1.5Z" fill="#facc15" />
    </svg>
  );
}

function ServiceIcon({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  switch (kind) {
    case "chef":
      return <ChefHatIcon className={className} />;
    case "maid":
    case "cleaner":
      return <CleaningIcon className={className} />;
    case "driver":
      return <CarIcon className={className} />;
    case "tutor":
      return <TutorIcon className={className} />;
    case "babysitter":
      return <BabyIcon className={className} />;
    case "plumber":
      return <WrenchIcon className={className} />;
    case "electrician":
      return <BoltIcon className={className} />;
    default:
      return <DotsGroupIcon className={className} />;
  }
}

function ChefHatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M8 10a3 3 0 1 1 0-6 3.7 3.7 0 0 1 4 2 3.8 3.8 0 0 1 6 3 3 3 0 0 1-2 5H8a3 3 0 0 1 0-4Z" />
      <path d="M9 14v4h6v-4" strokeLinecap="round" />
    </svg>
  );
}

function CleaningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M6 21h8M10 3l6 6-8 8-3-3 8-8Z" />
      <path d="M14 7 8 13" strokeLinecap="round" />
    </svg>
  );
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M5 16V9l2-3h10l2 3v7" />
      <path d="M3 13h18M7 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}

function TutorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="m4 7 8-3 8 3-8 3-8-3Zm2 3v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </svg>
  );
}

function BabyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <circle cx="12" cy="8" r="3" />
      <path d="M8 20v-3a4 4 0 0 1 8 0v3M10 4c1 0 1.5-1 2-2 0 .8.8 2 2 2" strokeLinecap="round" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="m14 7 3-3a3 3 0 1 1 3 3l-3 3" />
      <path d="m5 19 8-8 3 3-8 8H5v-3Z" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClass(className)}>
      <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsGroupIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass(className)}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
      <circle cx="16" cy="16" r="2" />
    </svg>
  );
}
