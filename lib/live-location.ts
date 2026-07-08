"use client";

export type StoredLiveLocation = {
  id?: string;
  latitude: number;
  longitude: number;
  label: string;
  addressLabel?: string;
  formattedAddress?: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  houseNumber?: string;
  buildingName?: string;
  floor?: string;
  unitNumber?: string;
  pickupNote?: string;
  updatedAt: string;
};

const LIVE_LOCATION_STORAGE_KEY = "della.live.location";
const CURRENT_LIVE_LOCATION_STORAGE_KEY = "della.current.location";
const SAVED_PLACES_STORAGE_KEY = "della.saved.places";
const SELECTED_PROVIDER_SEARCH_LOCATION_STORAGE_KEY =
  "della.provider.search.location";

function buildLocationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `place-${Date.now()}`;
}

function normalizeStoredLocation(parsed: StoredLiveLocation) {
  return {
    ...parsed,
    id: parsed.id ?? buildLocationId(),
    addressLabel: parsed.addressLabel ?? "Home",
    formattedAddress: parsed.formattedAddress ?? parsed.label,
    road: parsed.road ?? "",
    suburb: parsed.suburb ?? "",
    city: parsed.city ?? "",
    state: parsed.state ?? "",
    postcode: parsed.postcode ?? "",
    country: parsed.country ?? "",
    houseNumber: parsed.houseNumber ?? "",
    buildingName: parsed.buildingName ?? "",
    floor: parsed.floor ?? "",
    unitNumber: parsed.unitNumber ?? "",
    pickupNote: parsed.pickupNote ?? "",
  };
}

export function loadStoredLiveLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(LIVE_LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLiveLocation;
    return normalizeStoredLocation(parsed);
  } catch {
    return null;
  }
}

export function saveStoredLiveLocation(location: StoredLiveLocation) {
  const normalized = normalizeStoredLocation(location);

  if (typeof window === "undefined") {
    return normalized;
  }

  window.localStorage.setItem(
    LIVE_LOCATION_STORAGE_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}

export function loadCurrentLiveLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(CURRENT_LIVE_LOCATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLiveLocation;
    return normalizeStoredLocation(parsed);
  } catch {
    return null;
  }
}

export function saveCurrentLiveLocation(location: StoredLiveLocation) {
  const normalized = normalizeStoredLocation(location);

  if (typeof window === "undefined") {
    return normalized;
  }

  window.localStorage.setItem(
    CURRENT_LIVE_LOCATION_STORAGE_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}

export function clearCurrentLiveLocation() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CURRENT_LIVE_LOCATION_STORAGE_KEY);
}

export function clearStoredLiveLocation() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LIVE_LOCATION_STORAGE_KEY);
}

export function loadSavedPlaces() {
  if (typeof window === "undefined") {
    return [] as StoredLiveLocation[];
  }

  const raw = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
  if (!raw) {
    return [] as StoredLiveLocation[];
  }

  try {
    const parsed = JSON.parse(raw) as StoredLiveLocation[];
    return parsed.map(normalizeStoredLocation);
  } catch {
    return [] as StoredLiveLocation[];
  }
}

export function loadSelectedProviderSearchLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(
    SELECTED_PROVIDER_SEARCH_LOCATION_STORAGE_KEY
  );
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLiveLocation;
    return normalizeStoredLocation(parsed);
  } catch {
    return null;
  }
}

export function saveSelectedProviderSearchLocation(location: StoredLiveLocation) {
  const normalized = normalizeStoredLocation(location);

  if (typeof window === "undefined") {
    return normalized;
  }

  window.localStorage.setItem(
    SELECTED_PROVIDER_SEARCH_LOCATION_STORAGE_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}

export function clearSelectedProviderSearchLocation() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SELECTED_PROVIDER_SEARCH_LOCATION_STORAGE_KEY);
}

export function saveStoredPlace(location: StoredLiveLocation) {
  if (typeof window === "undefined") {
    return normalizeStoredLocation(location);
  }

  const normalized = normalizeStoredLocation(location);
  const places = loadSavedPlaces();
  const nextPlaces = [
    normalized,
    ...places.filter((item) => item.id !== normalized.id),
  ];

  window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
  return normalized;
}

export function deleteStoredPlace(placeId?: string) {
  if (typeof window === "undefined" || !placeId) {
    return;
  }

  const nextPlaces = loadSavedPlaces().filter((item) => item.id !== placeId);
  window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
}

export function buildMapsHref(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export type ReverseGeocodeResponse = {
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

type LiveLocationPersistMode = "current" | "saved" | "both" | "none";

type ResolveCurrentLiveLocationOptions = {
  persist?: LiveLocationPersistMode;
};

function persistResolvedLiveLocation(
  location: StoredLiveLocation,
  persist: LiveLocationPersistMode
) {
  if (persist === "saved") {
    return saveStoredLiveLocation(location);
  }

  if (persist === "both") {
    const savedLocation = saveStoredLiveLocation(location);
    return saveCurrentLiveLocation(savedLocation);
  }

  if (persist === "none") {
    return normalizeStoredLocation(location);
  }

  return saveCurrentLiveLocation(location);
}

export async function resolveLiveLocationFromCoordinates(
  latitude: number,
  longitude: number,
  fallbackLabel: string,
  options?: ResolveCurrentLiveLocationOptions
) {
  const persist = options?.persist ?? "current";
  let label = fallbackLabel;

  try {
    const response = await fetch(
      `/api/location/reverse?lat=${latitude}&lng=${longitude}`,
      { cache: "no-store" }
    );

    if (response.ok) {
      const data = (await response.json()) as ReverseGeocodeResponse;
      if (data.label) {
        label = data.label;
      }

      const nextLocation = {
        latitude,
        longitude,
        label,
        addressLabel: "Home",
        formattedAddress: data.formattedAddress ?? label,
        road: data.road ?? "",
        suburb: data.suburb ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        postcode: data.postcode ?? "",
        country: data.country ?? "",
        houseNumber: data.houseNumber ?? "",
        buildingName: "",
        floor: "",
        unitNumber: "",
        pickupNote: "",
        updatedAt: new Date().toISOString(),
      };

      return persistResolvedLiveLocation(nextLocation, persist);
    }
  } catch {
    label = fallbackLabel;
  }

  const nextLocation = {
    latitude,
    longitude,
    label,
    addressLabel: "Home",
    formattedAddress: label,
    road: "",
    suburb: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    houseNumber: "",
    buildingName: "",
    floor: "",
    unitNumber: "",
    pickupNote: "",
    updatedAt: new Date().toISOString(),
  };

  return persistResolvedLiveLocation(nextLocation, persist);
}

export async function resolveCurrentLiveLocation(
  fallbackLabel: string,
  options?: ResolveCurrentLiveLocationOptions
) {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 300000,
    });
  });

  return resolveLiveLocationFromCoordinates(
    position.coords.latitude,
    position.coords.longitude,
    fallbackLabel,
    options
  );
}
