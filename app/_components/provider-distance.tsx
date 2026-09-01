import { formatDistanceKm } from "@/lib/provider-distance";

export function ProviderDistanceText({
  distanceKm,
  suffix = "",
}: {
  distanceKm: number | null;
  suffix?: string;
}) {
  if (distanceKm === null) {
    return <>Distance unavailable{suffix}</>;
  }

  return <>{formatDistanceKm(distanceKm)}{suffix}</>;
}
