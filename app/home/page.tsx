import { MarketplaceScreen } from "./_components/marketplace-ui";
import { getHomeFeedData } from "@/lib/home-feed";
import { parseCustomerLocation } from "@/lib/customer-location";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customerLocation = parseCustomerLocation(new URLSearchParams(searchParams));
  const data = await getHomeFeedData(customerLocation);

  return <MarketplaceScreen {...data} />;
}
