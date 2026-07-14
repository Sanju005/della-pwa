"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ImageCropModal,
  cropImageFromSelection,
  type CropTone,
} from "@/app/_components/image-crop-modal";

import {
  Icons,
  RegisterHeader,
  RegisterShell,
  RegisterTitle,
} from "../../register/_components/register-ui";
import {
  IMAGE_UPLOAD_ACCEPT,
  isAcceptedImageFile,
  isCroppableImageFile,
} from "@/lib/image-upload";
import { getSupabaseClient } from "@/lib/supabase";
import { malaysianStates } from "@/lib/provider-registration-config";

function getTodayIso() {
  return new Date().toISOString().split("T")[0] ?? "";
}

export default function SignupUserPage() {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<"" | "Male" | "Female">("Male");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [addressLabel, setAddressLabel] = useState("Address 1");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [country, setCountry] = useState("Malaysia");
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ id: number; label: string; latitude: number; longitude: number }>
  >([]);
  const [selectedAddressPreview, setSelectedAddressPreview] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cropState, setCropState] = useState<{
    fileName: string;
    sourceDataUrl: string;
    tone: CropTone;
    aspectRatio?: number;
  } | null>(null);

  useEffect(() => {
    const query = [addressLine1, addressLine2, postcode, city, stateName]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });

        const result = (await response.json()) as {
          results?: Array<{ id: number; label: string; latitude: number; longitude: number }>;
        };

        if (!active) {
          return;
        }

        setAddressSuggestions(Array.isArray(result.results) ? result.results : []);
      } catch {
        if (active) {
          setAddressSuggestions([]);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [addressLine1, addressLine2, city, postcode, stateName]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedImageFile(file)) {
      setFieldErrors((current) => ({
        ...current,
        profileImage: "Please choose a JPG, PNG, GIF, WEBP, TIFF, or JFIF image for the profile photo.",
      }));
      return;
    }

    if (!isCroppableImageFile(file)) {
      setFieldErrors((current) => ({
        ...current,
        profileImage: "This image cannot be cropped here. Please use JPG, PNG, WEBP, or GIF.",
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFieldErrors((current) => ({
        ...current,
        profileImage: "Profile photo must be 2MB or smaller.",
      }));
      return;
    }

    void (async () => {
      try {
        setError("");
        setFieldErrors((current) => {
          if (!current.profileImage) {
            return current;
          }
          const next = { ...current };
          delete next.profileImage;
          return next;
        });
        setCropState({
          fileName: file.name,
          sourceDataUrl: await readFileAsDataUrl(file),
          tone: "profile",
          aspectRatio: 1,
        });
      } catch {
        setFieldErrors((current) => ({
          ...current,
          profileImage: "Unable to process the selected profile image.",
        }));
      }
    })();
  };

  const applyAddressSuggestion = async (suggestion: {
    id: number;
    label: string;
    latitude: number;
    longitude: number;
  }) => {
    setSelectedAddressPreview(suggestion.label);
    setAddressSuggestions([]);

    try {
      const response = await fetch(
        `/api/location/reverse?lat=${suggestion.latitude}&lng=${suggestion.longitude}`,
        { cache: "no-store" }
      );

      const result = (await response.json()) as {
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };

      setCity(result.city?.trim() || city);
      setStateName(result.state?.trim() || stateName);
      setPostcode(result.postcode?.trim() || postcode);
      setCountry(result.country?.trim() || "Malaysia");
    } catch {
      // Keep the manual address fields if reverse lookup is unavailable.
    }
  };

  const clearInvalidField = (field: string) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const nextFieldErrors: Record<string, string> = {};

    if (!firstName) {
      nextFieldErrors.firstName = "First name is required.";
    }
    if (!lastName) {
      nextFieldErrors.lastName = "Last name is required.";
    }
    if (!sex) {
      nextFieldErrors.sex = "Please select gender.";
    }
    if (!dateOfBirth) {
      nextFieldErrors.dateOfBirth = "Date of birth is required.";
    }
    if (!email) {
      nextFieldErrors.email = "Email is required.";
    }
    if (!phoneNumber) {
      nextFieldErrors.phoneNumber = "Phone number is required.";
    }
    if (!emergencyContactNumber) {
      nextFieldErrors.emergencyContactNumber = "Emergency contact number is required.";
    }
    if (!addressLine1) {
      nextFieldErrors.addressLine1 = "Address line 1 is required.";
    }
    if (!postcode) {
      nextFieldErrors.postcode = "Postcode is required.";
    }
    if (!city) {
      nextFieldErrors.city = "City is required.";
    }
    if (!stateName) {
      nextFieldErrors.state = "State is required.";
    }
    if (!country) {
      nextFieldErrors.country = "Country is required.";
    }
    if (!password) {
      nextFieldErrors.password = "Password is required.";
    }
    if (!confirmPassword) {
      nextFieldErrors.confirmPassword = "Please confirm your password.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("");
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }

    startTransition(async () => {
      setError("");
      setFieldErrors({});

      const response = await fetch("/api/auth/register/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          sex,
          avatarDataUrl,
          email,
          phoneNumber,
          emergencyContactNumber,
          password,
          confirmPassword,
          addressLabel,
          addressLine1,
          addressLine2,
          postcode,
          city,
          state: stateName,
          country,
        }),
      });

      const result = (await response.json()) as
        | { success: true; email: string; requiresEmailVerification: boolean }
        | { error?: string };

      if (!response.ok || !("success" in result)) {
        setError(
          "error" in result && result.error
            ? result.error
            : "Unable to create your account."
        );
        return;
      }

      if (result.requiresEmailVerification) {
        router.push(`/signup/check-email?email=${encodeURIComponent(result.email)}`);
        return;
      }

      const client = getSupabaseClient();

      if (!client) {
        setError("Account created, but automatic sign-in is unavailable right now.");
        router.push("/login");
        return;
      }

      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.user) {
        setError("Account created, but automatic sign-in failed. Please log in.");
        router.push("/login");
        return;
      }

      router.push("/signup/user/welcome");
    });
  };

  return (
    <RegisterShell>
      <RegisterHeader showBack backHref="/signup" />
      <RegisterTitle
        title="Create account as User"
        subtitle="Fill in the details below to create your Swiper account."
      />

      <div className="mt-8 space-y-4">
        <ProfileImageField value={avatarDataUrl} onChange={handleAvatarChange} error={fieldErrors.profileImage} />
        <ControlledField
          label="First Name"
          placeholder="Enter your first name"
          value={firstName}
          onChange={(value) => {
            clearInvalidField("firstName");
            setFirstName(value);
          }}
          icon={<Icons.User className="h-5 w-5" />}
          error={fieldErrors.firstName}
          invalid={Boolean(fieldErrors.firstName)}
        />
        <ControlledField
          label="Last Name"
          placeholder="Enter your last name"
          value={lastName}
          onChange={(value) => {
            clearInvalidField("lastName");
            setLastName(value);
          }}
          icon={<Icons.User className="h-5 w-5" />}
          error={fieldErrors.lastName}
          invalid={Boolean(fieldErrors.lastName)}
        />
        <ControlledSelectField
          label="Gender"
          value={sex}
          onChange={(value) => {
            clearInvalidField("sex");
            setSex(value as "" | "Male" | "Female");
          }}
          icon={<Icons.User className="h-5 w-5" />}
          options={["Male", "Female"]}
          hidePlaceholder
          error={fieldErrors.sex}
          invalid={Boolean(fieldErrors.sex)}
        />
        <ControlledDateField
          label="Date of Birth"
          value={dateOfBirth}
          onChange={(value) => {
            clearInvalidField("dateOfBirth");
            setDateOfBirth(value);
          }}
          icon={<CalendarIcon className="h-5 w-5" />}
          error={fieldErrors.dateOfBirth}
          invalid={Boolean(fieldErrors.dateOfBirth)}
        />
        <ControlledField
          label="Email"
          placeholder="Enter email address"
          value={email}
          onChange={(value) => {
            clearInvalidField("email");
            setEmail(value);
          }}
          icon={<Icons.Mail className="h-5 w-5" />}
          type="email"
          error={fieldErrors.email}
          invalid={Boolean(fieldErrors.email)}
        />
        <ControlledPhoneField
          value={phoneNumber}
          onChange={(value) => {
            clearInvalidField("phoneNumber");
            setPhoneNumber(value);
          }}
          error={fieldErrors.phoneNumber}
          invalid={Boolean(fieldErrors.phoneNumber)}
        />
        <ControlledPhoneField
          label="Emergency Contact Number"
          value={emergencyContactNumber}
          onChange={(value) => {
            clearInvalidField("emergencyContactNumber");
            setEmergencyContactNumber(value);
          }}
          error={fieldErrors.emergencyContactNumber}
          invalid={Boolean(fieldErrors.emergencyContactNumber)}
        />
        <div className="rounded-[22px] border border-[#e7ece8] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <h2 className="text-[15px] font-extrabold text-[#111827]">Saved Address</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
            Add your main address now. You can save more addresses later from your profile.
          </p>
          <div className="mt-4 space-y-4">
            <ControlledField
              label="Address Name"
              placeholder="Address 1"
              value={addressLabel}
              onChange={setAddressLabel}
              icon={<MapPinIcon className="h-5 w-5" />}
            />
            <ControlledField
              label="Address Line 1"
              placeholder="Street name, building, area"
              value={addressLine1}
              onChange={(value) => {
                clearInvalidField("addressLine1");
                setAddressLine1(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
              error={fieldErrors.addressLine1}
              invalid={Boolean(fieldErrors.addressLine1)}
            />
            {addressSuggestions.length > 0 ? (
              <div className="rounded-[16px] border border-[#e5e7eb] bg-[#fbfcff] p-2">
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => void applyAddressSuggestion(suggestion)}
                    className="flex w-full items-start gap-3 rounded-[12px] px-3 py-2 text-left hover:bg-white"
                  >
                    <span className="mt-0.5 text-[#8E5EB5]">
                      <MapPinIcon className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] leading-5 text-[#374151]">
                      {suggestion.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedAddressPreview ? (
              <div className="rounded-[14px] bg-[#f5f1fa] px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                Location preview: {selectedAddressPreview}
              </div>
            ) : null}
            <ControlledField
              label="Address Line 2"
              placeholder="Apartment, floor, landmark"
              value={addressLine2}
              onChange={(value) => {
                clearInvalidField("addressLine2");
                setAddressLine2(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
            />
            <ControlledField
              label="Postcode"
              placeholder="Postcode"
              value={postcode}
              onChange={(value) => {
                clearInvalidField("postcode");
                setPostcode(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
              error={fieldErrors.postcode}
              invalid={Boolean(fieldErrors.postcode)}
            />
            <ControlledField
              label="City"
              placeholder="City"
              value={city}
              onChange={(value) => {
                clearInvalidField("city");
                setCity(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
              error={fieldErrors.city}
              invalid={Boolean(fieldErrors.city)}
            />
            <ControlledSelectField
              label="State"
              value={stateName}
              onChange={(value) => {
                clearInvalidField("state");
                setStateName(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
              options={malaysianStates}
              error={fieldErrors.state}
              invalid={Boolean(fieldErrors.state)}
            />
            <ControlledField
              label="Country"
              placeholder="Country"
              value={country}
              onChange={(value) => {
                clearInvalidField("country");
                setCountry(value);
              }}
              icon={<MapPinIcon className="h-5 w-5" />}
              error={fieldErrors.country}
              invalid={Boolean(fieldErrors.country)}
            />
          </div>
        </div>
        <ControlledField
          label="Password"
          placeholder="Create a password"
          value={password}
          onChange={(value) => {
            clearInvalidField("password");
            setPassword(value);
          }}
          icon={<Icons.Lock className="h-5 w-5" />}
          rightIcon={<Icons.EyeOff className="h-5 w-5" />}
          type="password"
          error={fieldErrors.password}
          invalid={Boolean(fieldErrors.password)}
        />
        <div className="rounded-[18px] bg-[#f5f1fa] px-4 py-3 text-[13px] leading-6 text-[#4b5563]">
          <p>At least 8 characters</p>
          <p>One uppercase letter</p>
          <p>One number</p>
          <p>One special character</p>
        </div>
        <ControlledField
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(value) => {
            clearInvalidField("confirmPassword");
            setConfirmPassword(value);
          }}
          icon={<Icons.Lock className="h-5 w-5" />}
          rightIcon={<Icons.EyeOff className="h-5 w-5" />}
          type="password"
          error={fieldErrors.confirmPassword}
          invalid={Boolean(fieldErrors.confirmPassword)}
        />
      </div>

      <label className="mt-5 flex items-start gap-3 text-[14px] leading-6 text-[#4b5563]">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[#cfd8d1]"
        />
        <span>
          I agree to the{" "}
          <Link href="/signup/user" className="font-bold text-[#8E5EB5]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/signup/user" className="font-bold text-[#8E5EB5]">
            Privacy Policy
          </Link>
        </span>
      </label>

      {error ? (
        <p className="mt-4 rounded-[14px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex h-13 w-full items-center justify-center rounded-[14px] bg-[#8E5EB5] px-5 text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(142,94,181,0.22)] transition hover:bg-[#7B4EA1] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </div>

      <p className="mt-7 text-center text-[15px] text-[#4b5563]">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-[#8E5EB5]">
          Log in
        </Link>
      </p>
      {cropState ? (
        <ImageCropModal
          imageDataUrl={cropState.sourceDataUrl}
          tone={cropState.tone}
          aspectRatio={cropState.aspectRatio}
          onClose={() => setCropState(null)}
          onApply={async (selection) => {
            try {
              const cropped = await cropImageFromSelection(cropState.sourceDataUrl, selection);
              setAvatarDataUrl(cropped);
              setCropState(null);
              clearInvalidField("profileImage");
            } catch {
              setFieldErrors((current) => ({
                ...current,
                profileImage: "Unable to process the selected profile image.",
              }));
            }
          }}
        />
      ) : null}
    </RegisterShell>
  );
}

function ProfileImageField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        Profile Image
      </span>
      <div className="rounded-[18px] border border-[#d9e2dd] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-4">
          <div className="relative flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f1fa]">
            {value ? (
              <Image src={value} alt="Profile preview" fill unoptimized className="object-cover" />
            ) : (
              <Icons.User className="h-8 w-8 text-[#8E5EB5]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#111827]">Add a profile photo</p>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              JPG, PNG, GIF, WEBP, TIFF, or JFIF, up to 2MB. Crop before saving.
            </p>
            <input
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              onChange={onChange}
              className="mt-3 block w-full text-[13px] text-[#4b5563] file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#8E5EB5] file:px-3 file:py-2 file:font-bold file:text-white"
            />
            {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
          </div>
        </div>
      </div>
    </label>
  );
}

function ControlledDateField({
  label,
  value,
  onChange,
  icon,
  error,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  error?: string;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxDate, setMaxDate] = useState("");

  useEffect(() => {
    setMaxDate(getTodayIso());
  }, []);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    pickerInput.showPicker?.();
  };

  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <div
        className={`flex h-13 items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${
          invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#d9e2dd]"
        }`}
      >
        <span className="mr-3 text-[#8E5EB5]">{icon}</span>
        <input
          ref={inputRef}
          type="date"
          max={maxDate || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none"
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label="Open date picker"
          className="ml-3 text-[#6b7280]"
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function ControlledSelectField({
  label,
  value,
  onChange,
  icon,
  options,
  hidePlaceholder = false,
  error,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  options: string[];
  hidePlaceholder?: boolean;
  error?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <div
        className={`flex h-13 items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${
          invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#d9e2dd]"
        }`}
      >
        <span className="mr-3 text-[#8E5EB5]">{icon}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full flex-1 appearance-none border-0 bg-transparent text-[15px] text-[#111827] outline-none"
        >
          {!hidePlaceholder ? <option value="">Select</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="ml-3 text-[#6b7280]">
          <ChevronDownIcon className="h-5 w-5" />
        </span>
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function ControlledField({
  label,
  placeholder,
  value,
  onChange,
  icon,
  rightIcon,
  type = "text",
  error,
  invalid = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  rightIcon?: ReactNode;
  type?: string;
  error?: string;
  invalid?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password";

  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <div
        className={`flex h-13 items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${
          invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#d9e2dd]"
        }`}
      >
        <span className="mr-3 text-[#8E5EB5]">{icon}</span>
        <input
          type={isPasswordField && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
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
            className="ml-3 text-[#6b7280]"
          >
            {rightIcon}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function ControlledPhoneField({
  label = "Phone Number",
  value,
  onChange,
  error,
  invalid = false,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <div className="flex gap-2.5">
        <div className="flex h-13 w-[8.25rem] items-center rounded-[14px] border border-[#d9e2dd] bg-white px-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
          <span className="mr-2">
            <MalaysiaFlagIcon className="h-5 w-7 rounded-[4px]" />
          </span>
          <span className="text-[15px] font-medium text-[#111827]">+60</span>
        </div>
        <div
          className={`flex h-13 flex-1 items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)] ${
            invalid ? "border-[#ef4444] bg-[#fff5f5]" : "border-[#d9e2dd]"
          }`}
        >
          <PhoneIcon className="mr-3 h-5 w-5 text-[#8E5EB5]" />
          <input
            type="tel"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter phone number"
            className="h-full flex-1 border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
          />
        </div>
      </div>
      {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
    </label>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        d="M6.6 3h3.1l1.2 4.6-1.8 1.8a15 15 0 0 0 5.4 5.4l1.8-1.8L21 14.3v3.1c0 .9-.7 1.6-1.6 1.6C10.8 19 5 13.2 5 6.6 5 5.7 5.7 5 6.6 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      <path
        d="m10.2 2.4.6 1.5 1.6.1-1.2 1 .4 1.5-1.4-.8-1.4.8.4-1.5-1.2-1 1.6-.1.6-1.5Z"
        fill="#facc15"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}
