"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  LoaderCircle,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";

import {
  clearCurrentLiveLocation,
  clearStoredLiveLocation,
  deleteStoredPlace,
  loadCurrentLiveLocation,
  loadStoredLiveLocation,
  resolveLiveLocationFromCoordinates,
  type ReverseGeocodeResponse,
  resolveCurrentLiveLocation,
  saveCurrentLiveLocation,
  saveStoredPlace,
  saveStoredLiveLocation,
  type StoredLiveLocation,
} from "@/lib/live-location";

type SearchResult = {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
};

type SearchResponse = {
  results: SearchResult[];
};

type LiveLocationChipProps = {
  fallbackLabel: string;
  className?: string;
  titleLabel?: string;
  onLocationChange?: (location: StoredLiveLocation) => void;
  onLocationClear?: () => void;
  displayLabel?: string;
  leadingIcon?: "pin" | "search";
  showChevron?: boolean;
  mode?: "current" | "saved";
};

const DynamicLocationPickerMap = dynamic(
  () =>
    import("./location-picker-map").then((module) => ({
      default: module.LocationPickerMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#eef9f0] text-[13px] font-semibold text-[#4b5563]">
        Loading map...
      </div>
    ),
  }
);

export function LiveLocationChip({
  fallbackLabel,
  className = "",
  titleLabel,
  onLocationChange,
  onLocationClear,
  displayLabel,
  leadingIcon = "pin",
  showChevron = true,
  mode = "current",
}: LiveLocationChipProps) {
  const [location, setLocation] = useState<StoredLiveLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const hasResolvedInitialLocation = useRef(false);
  const lastResolvedLocationRef = useRef<StoredLiveLocation | null>(location);

  useEffect(() => {
    setLocation(mode === "saved" ? loadStoredLiveLocation() : loadCurrentLiveLocation());
  }, [mode]);

  useEffect(() => {
    if (location) {
      onLocationChange?.(location);
    }
  }, [location, onLocationChange]);

  useEffect(() => {
    lastResolvedLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (hasResolvedInitialLocation.current) {
      return;
    }

    hasResolvedInitialLocation.current = true;

    if (mode === "saved") {
      return;
    }

    let active = true;
    let watchId: number | null = null;

    const refreshCurrentLocation = async (
      coords?: { latitude: number; longitude: number }
    ) => {
      if (!active) {
        return;
      }

      setIsLoading(true);

      try {
        const nextLocation = coords
          ? await resolveLiveLocationFromCoordinates(
              coords.latitude,
              coords.longitude,
              fallbackLabel,
              { persist: "current" }
            )
          : await resolveCurrentLiveLocation(fallbackLabel, {
              persist: "current",
            });

        if (active && nextLocation) {
          setLocation(nextLocation);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const timerId = window.setTimeout(() => {
      void refreshCurrentLocation();

      if (!("geolocation" in navigator)) {
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const previous = lastResolvedLocationRef.current;
          const nextCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          if (
            previous &&
            calculateDistanceMeters(
              previous.latitude,
              previous.longitude,
              nextCoords.latitude,
              nextCoords.longitude
            ) < 120
          ) {
            return;
          }

          void refreshCurrentLocation(nextCoords);
        },
        () => {
          return;
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60000,
          timeout: 15000,
        }
      );
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [fallbackLabel, mode]);

  const activeLabel = location?.label ?? fallbackLabel;
  const visibleLabel = displayLabel ?? activeLabel;
  const locationTitle = location
    ? `Saved at ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : "Pick your location on the map";

  return (
    <>
      <div className={`min-w-0 ${className}`.trim()}>
        {titleLabel ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
            {titleLabel}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="flex min-h-[3.25rem] w-full min-w-0 items-center gap-2.5 rounded-[18px] border border-[#e3ebe6] bg-white px-4 text-[15px] font-semibold text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
          title={locationTitle}
        >
          {leadingIcon === "search" ? (
            <Search className="h-5.5 w-5.5 shrink-0 text-[#667085]" />
          ) : (
            <MapPin className="h-5.5 w-5.5 shrink-0 fill-[#16A34A] text-[#16A34A]" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{visibleLabel}</span>
          {isLoading ? (
            <LoaderCircle className="h-4.5 w-4.5 shrink-0 animate-spin text-[#16A34A]" />
          ) : showChevron ? (
            <ChevronDown className="h-4.5 w-4.5 shrink-0 text-[#667085]" />
          ) : null}
        </button>
      </div>

      {isPickerOpen ? (
        <LocationPickerModal
          fallbackLabel={fallbackLabel}
          initialLocation={location}
          mode={mode}
          onClose={() => setIsPickerOpen(false)}
          onSave={(nextLocation) => {
            setLocation(nextLocation);
            setIsPickerOpen(false);
          }}
          onDelete={() => {
            setLocation(null);
            onLocationClear?.();
            setIsPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function LocationPickerModal({
  fallbackLabel,
  initialLocation,
  mode,
  onClose,
  onSave,
  onDelete,
}: {
  fallbackLabel: string;
  initialLocation: StoredLiveLocation | null;
  mode: "current" | "saved";
  onClose: () => void;
  onSave: (location: StoredLiveLocation) => void;
  onDelete: () => void;
}) {
  const [query, setQuery] = useState(initialLocation?.label ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coords, setCoords] = useState(() => ({
    latitude: initialLocation?.latitude ?? 3.1274,
    longitude: initialLocation?.longitude ?? 101.7452,
  }));
  const [selectedLabel, setSelectedLabel] = useState(initialLocation?.label ?? fallbackLabel);
  const [addressLabel, setAddressLabel] = useState(initialLocation?.addressLabel ?? "Home");
  const [formattedAddress, setFormattedAddress] = useState(
    initialLocation?.formattedAddress ?? initialLocation?.label ?? fallbackLabel
  );
  const [houseNumber, setHouseNumber] = useState(initialLocation?.houseNumber ?? "");
  const [buildingName, setBuildingName] = useState(initialLocation?.buildingName ?? "");
  const [floor, setFloor] = useState(initialLocation?.floor ?? "");
  const [unitNumber, setUnitNumber] = useState(initialLocation?.unitNumber ?? "");
  const [pickupNote, setPickupNote] = useState(initialLocation?.pickupNote ?? "");
  const [road, setRoad] = useState(initialLocation?.road ?? "");
  const [suburb, setSuburb] = useState(initialLocation?.suburb ?? "");
  const [city, setCity] = useState(initialLocation?.city ?? "");
  const [state, setState] = useState(initialLocation?.state ?? "");
  const [postcode, setPostcode] = useState(initialLocation?.postcode ?? "");
  const [country, setCountry] = useState(initialLocation?.country ?? "");
  const [saveMessage, setSaveMessage] = useState("");
  const [draftId, setDraftId] = useState(initialLocation?.id ?? "");

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const shouldSearch = trimmedQuery.length >= 2;

    if (!shouldSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);

      void fetch(`/api/location/search?q=${encodeURIComponent(trimmedQuery)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Search failed");
          }

          return (await response.json()) as SearchResponse;
        })
        .then((data) => {
          setResults(data.results);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  async function updateLabelFromCoords(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `/api/location/reverse?lat=${latitude}&lng=${longitude}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Reverse geocode failed");
      }

      const data = (await response.json()) as ReverseGeocodeResponse;
      const nextLabel = data.label || fallbackLabel;
      const nextFormattedAddress = data.formattedAddress ?? nextLabel;
      setSelectedLabel(nextLabel);
      setQuery(nextFormattedAddress);
      setFormattedAddress(nextFormattedAddress);
      setRoad(data.road ?? "");
      setSuburb(data.suburb ?? "");
      setCity(data.city ?? "");
      setState(data.state ?? "");
      setPostcode(data.postcode ?? "");
      setCountry(data.country ?? "");
      if (!houseNumber.trim()) {
        setHouseNumber(data.houseNumber ?? "");
      }
    } catch {
      setSelectedLabel(fallbackLabel);
    }
  }

  const handleMapChange = (nextCoords: {
    latitude: number;
    longitude: number;
  }) => {
    setCoords(nextCoords);
    setQuery("Loading exact address...");
    setSelectedLabel("Loading exact address...");
    setFormattedAddress("Loading exact address...");
    void updateLabelFromCoords(nextCoords.latitude, nextCoords.longitude);
  };

  const handlePickCurrentLocation = () => {
    setIsSaving(true);

    void resolveCurrentLiveLocation(fallbackLabel, {
      persist: mode === "saved" ? "saved" : "current",
    })
      .then((nextLocation) => {
        if (!nextLocation) {
          return;
        }

        setCoords({
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        });
        setSelectedLabel(nextLocation.label);
        setQuery(nextLocation.label);
        setFormattedAddress(nextLocation.formattedAddress ?? nextLocation.label);
        setRoad(nextLocation.road ?? "");
        setSuburb(nextLocation.suburb ?? "");
        setCity(nextLocation.city ?? "");
        setState(nextLocation.state ?? "");
        setPostcode(nextLocation.postcode ?? "");
        setCountry(nextLocation.country ?? "");
        setHouseNumber(nextLocation.houseNumber ?? "");
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleSave = (forceNewPlace = false) => {
    const nextLocation = {
      id: forceNewPlace ? undefined : draftId || undefined,
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: selectedLabel || fallbackLabel,
      addressLabel,
      formattedAddress: formattedAddress || selectedLabel || fallbackLabel,
      road,
      suburb,
      city,
      state,
      postcode,
      country,
      houseNumber,
      buildingName,
      floor,
      unitNumber,
      pickupNote,
      updatedAt: new Date().toISOString(),
    };

    if (mode === "saved") {
      const activeLocation = saveStoredLiveLocation(nextLocation);
      const savedPlace = saveStoredPlace(activeLocation);
      setDraftId(savedPlace.id ?? "");
      setSaveMessage("Address saved successfully.");
      onSave(savedPlace);
      return;
    }

    const currentLocation = saveCurrentLiveLocation(nextLocation);
    setDraftId(currentLocation.id ?? "");
    setSaveMessage("Live location updated successfully.");
    onSave(currentLocation);
  };

  const handleDelete = () => {
    if (mode === "saved" && draftId) {
      deleteStoredPlace(draftId);
    }

    if (mode === "saved") {
      clearStoredLiveLocation();
      setSaveMessage("Address deleted.");
    } else {
      clearCurrentLiveLocation();
      setSaveMessage("Live location cleared.");
    }

    onDelete();
  };

  const handleSaveAnotherPlace = () => {
    setDraftId("");
    setAddressLabel("Other");
    setHouseNumber("");
    setBuildingName("");
    setFloor("");
    setUnitNumber("");
    setPickupNote("");
    setSaveMessage("Ready to save another place.");
  };

  const helperText = useMemo(
    () =>
      `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
    [coords.latitude, coords.longitude]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#0f172a]/50 sm:items-center sm:justify-center">
      <div className="flex h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.2)] sm:h-[46rem] sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#111827]">
              Choose your location
            </h2>
            <p className="mt-1 text-[13px] text-[#4b5563]">
              Search, tap the map, or drag the pin to adjust.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f7f6] text-[#475467]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 rounded-[18px] border border-[#dfe7e2] px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <Search className="h-5 w-5 shrink-0 text-[#16A34A]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search area, street, or address"
                className="w-full border-0 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#667085]"
              />
              {isSearching ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[#16A34A]" />
              ) : null}
            </div>

            {query.trim().length >= 2 && results.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-[18px] border border-[#e4ece7] bg-white">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setCoords({
                        latitude: result.latitude,
                        longitude: result.longitude,
                      });
                      setSelectedLabel(result.label);
                      setQuery(result.label);
                      setFormattedAddress(result.label);
                      setResults([]);
                      void updateLabelFromCoords(result.latitude, result.longitude);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      index > 0 ? "border-t border-[#edf1ef]" : ""
                    }`}
                  >
                    <p className="text-[14px] font-semibold text-[#111827]">
                      {result.label}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="px-5">
            <div className="overflow-hidden rounded-[24px] border border-[#dcecdf]">
              <div className="h-[16rem] w-full bg-[#eef9f0] sm:h-[18rem]">
                <DynamicLocationPickerMap
                  latitude={coords.latitude}
                  longitude={coords.longitude}
                  onChange={handleMapChange}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 px-5 pb-5">
            <div className="rounded-[18px] bg-[#f8fcf9] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9f9ec] text-[#16a34a]">
                  <Navigation className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-extrabold text-[#111827]">
                    {selectedLabel || fallbackLabel}
                  </p>
                  <p className="mt-1 text-[12px] text-[#6b7280]">{helperText}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <LabeledField
                    label="Address label"
                    value={addressLabel}
                    onChange={setAddressLabel}
                    placeholder="Home"
                  />
                  <LabeledField
                    label="House number"
                    value={houseNumber}
                    onChange={setHouseNumber}
                    placeholder="28A"
                  />
                </div>
                <LabeledField
                  label="Building / Condo"
                  value={buildingName}
                  onChange={setBuildingName}
                  placeholder="Taman Million / Wisma..."
                />
                <div className="grid grid-cols-2 gap-3">
                  <LabeledField
                    label="Floor"
                    value={floor}
                    onChange={setFloor}
                    placeholder="8"
                  />
                  <LabeledField
                    label="Unit number"
                    value={unitNumber}
                    onChange={setUnitNumber}
                    placeholder="A-3-12"
                  />
                </div>
                <LabeledField
                  label="Note"
                  value={pickupNote}
                  onChange={setPickupNote}
                  placeholder="Near gate, blue door, beside KFC"
                />
              </div>

              <GrabAddressCard
                addressLabel={addressLabel}
                houseNumber={houseNumber}
                buildingName={buildingName}
                floor={floor}
                unitNumber={unitNumber}
                pickupNote={pickupNote}
                selectedLabel={selectedLabel}
                formattedAddress={formattedAddress}
                distanceLabel={helperText}
              />

              {saveMessage ? (
                <p className="mt-3 text-[12px] font-semibold text-[#16a34a]">
                  {saveMessage}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handlePickCurrentLocation}
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center rounded-[12px] border border-[#dcecdf] bg-white px-4 text-[14px] font-extrabold text-[#111827] disabled:opacity-70"
                >
                  {isSaving ? "Locating..." : "Use Current Location"}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className="inline-flex h-11 items-center justify-center rounded-[12px] bg-[#16a34a] px-4 text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(22,163,74,0.18)]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex h-11 items-center justify-center rounded-[12px] border border-[#f3c7c7] bg-[#fff4f4] px-4 text-[14px] font-extrabold text-[#b42318]"
                  >
                    Delete
                  </button>
                </div>
                {mode === "saved" ? (
                  <button
                    type="button"
                    onClick={handleSaveAnotherPlace}
                    className="inline-flex h-11 w-full items-center justify-center rounded-[12px] border border-dashed border-[#16a34a] bg-[#fbfffc] px-4 text-[14px] font-extrabold text-[#16a34a]"
                  >
                    Save Another Place
                  </button>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const startLatitude = degreesToRadians(fromLatitude);
  const endLatitude = degreesToRadians(toLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function LabeledField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.04em] text-[#6b7280]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[12px] border border-[#dcecdf] bg-white px-3 text-[14px] text-[#111827] outline-none placeholder:text-[#98a2b3]"
      />
    </label>
  );
}

function GrabAddressCard({
  addressLabel,
  houseNumber,
  buildingName,
  floor,
  unitNumber,
  pickupNote,
  selectedLabel,
  formattedAddress,
  distanceLabel,
}: {
  addressLabel: string;
  houseNumber: string;
  buildingName: string;
  floor: string;
  unitNumber: string;
  pickupNote: string;
  selectedLabel: string;
  formattedAddress: string;
  distanceLabel: string;
}) {
  const mainLine =
    [houseNumber, buildingName || selectedLabel].filter(Boolean).join(", ") ||
    selectedLabel;
  const fullAddressLine = [houseNumber, buildingName, formattedAddress]
    .filter(Boolean)
    .join(", ");
  const detailLine = [floor && `Floor ${floor}`, unitNumber && `Unit ${unitNumber}`]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="mt-4 overflow-hidden rounded-[20px] border border-[#dcecdf] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="bg-[#eef9ff] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
              {addressLabel || "Saved address"}
            </p>
            <p className="mt-1 truncate text-[18px] font-extrabold text-[#111827]">
              {mainLine}
            </p>
            <p className="mt-1 text-[13px] text-[#4b5563]">{distanceLabel}</p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#ef4444] shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
            <MapPin className="h-5 w-5 fill-current" />
          </span>
        </div>
      </div>
      <div className="space-y-2 px-4 py-4">
        <p className="text-[14px] font-semibold text-[#111827]">
          {fullAddressLine || formattedAddress}
        </p>
        {detailLine ? (
          <p className="text-[13px] text-[#4b5563]">{detailLine}</p>
        ) : null}
        {pickupNote ? (
          <p className="text-[13px] text-[#2563eb]">{pickupNote}</p>
        ) : (
          <p className="text-[13px] text-[#98a2b3]">
            Add pickup details like near the gate, lobby, or landmark.
          </p>
        )}
      </div>
    </div>
  );
}
