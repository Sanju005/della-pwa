import type { ProviderRegistrationData, ProviderService } from "./provider-registration-types";

export const serviceSpecialties: Record<ProviderService, string[]> = {
  Chef: ["Arabic", "Malay", "Indian", "Western", "Vegetarian"],
  Maid: ["Cleaning", "Vacuum", "Ironing", "Laundry", "Deep cleaning"],
  Tutor: ["Mathematics", "English", "Science", "BM", "Tamil"],
  Driver: ["Airport pickup", "Personal driver", "Hourly driver", "Outstation", "Delivery"],
  Cleaner: ["Cleaning", "Vacuum", "Ironing", "Laundry", "Deep cleaning"],
  Babysitter: ["Newborn care", "Toddler care", "Feeding", "Homework support", "Night care"],
  Plumber: ["Pipe repair", "Toilet repair", "Water leak", "Installation", "Emergency repair"],
  Electrician: ["Wiring", "Lighting", "Fan installation", "Socket repair", "Emergency repair"],
  Other: ["General help", "On-site support", "Custom requests", "Home visits", "Flexible service"],
};

export const serviceIcons: Record<ProviderService, string> = {
  Chef: "chef",
  Maid: "maid",
  Tutor: "tutor",
  Driver: "driver",
  Cleaner: "cleaner",
  Babysitter: "babysitter",
  Plumber: "plumber",
  Electrician: "electrician",
  Other: "other",
};

export const availabilityDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const timePresets = [
  "24 Hours",
  "9 AM - 9 PM",
  "Custom Time",
];

export const documentTypes = [
  "IC / Passport / Driving License",
  "Passport",
  "Driving License",
  "National ID",
];

export const sexOptions = ["Male", "Female"];

export const malaysianStates = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];

export function createEmptyServiceDetails(): ProviderRegistrationData["serviceDetails"] {
  return {
    Chef: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Maid: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Tutor: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Driver: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Cleaner: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Babysitter: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Plumber: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Electrician: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
    Other: {
      yearsExperience: "",
      specialties: [],
      imageCaptions: ["", "", ""],
      imageDataUrls: ["", "", ""],
      certificateCaptions: ["", "", ""],
      certificateDataUrls: ["", "", ""],
      hourlyRate: "",
      dailyRate: "",
    },
  };
}

export function createDefaultProviderRegistration(): ProviderRegistrationData {
  return {
    basicProfile: {
      firstName: "",
      lastName: "",
      sex: "Male",
      profileImageName: "",
      avatarDataUrl: "",
      marketingName: "",
      dateOfBirth: "",
      unitNumber: "",
      addressLine1: "",
      addressLine2: "",
      postcode: "",
      city: "",
      state: "",
      country: "Malaysia",
      serviceLocation: "",
      serviceRadius: 15,
      emergencyContactNumber: "",
    },
    account: {
      email: "",
      phoneCountryCode: "+60",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
    selectedServices: [],
    serviceDetails: createEmptyServiceDetails(),
    availability: {
      days: [],
      timePreset: "9 AM - 9 PM",
      startTime: "09:00 AM",
      endTime: "09:00 PM",
    },
    providerLocation: {
      radius: 15,
      areaLabel: "",
      latitude: 3.139,
      longitude: 101.6869,
      formattedAddress: "",
      road: "",
      suburb: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
      houseNumber: "",
    },
    verification: {
      phoneOtp: ["", "", "", "", "", ""],
      emailOtp: ["", "", "", "", "", ""],
      documentType: "",
      frontImageName: "",
      frontImageDataUrl: "",
      backImageName: "",
      backImageDataUrl: "",
    },
  };
}
