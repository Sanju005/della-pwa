import type { CustomerLocation } from "./provider-catalog";

export function parseCustomerLocation(
  searchParams: URLSearchParams,
): CustomerLocation | null {
  const rawLat = searchParams.get("lat");
  const rawLng = searchParams.get("lng");

  if (!rawLat || !rawLng) {
    return null;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}
