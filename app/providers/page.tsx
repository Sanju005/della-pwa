import { ProvidersCatalogScreen } from "./providers-catalog-screen";
import {
  buildCategoryBannerSrc,
  buildProviderDetailHref,
  getProviderCatalog,
} from "@/lib/provider-catalog";
import { parseCustomerLocation } from "@/lib/customer-location";

export const dynamic = "force-dynamic";

export default async function ProvidersPage(props: {
  searchParams: Promise<{ service?: string; lat?: string; lng?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customerLocation = parseCustomerLocation(new URLSearchParams(searchParams));
  const data = await getProviderCatalog(searchParams.service ?? null, customerLocation);
  const screenData = {
    ...data,
    bannerSrc: buildCategoryBannerSrc(data.service),
    listings: data.listings.map((listing) => ({
      ...listing,
      href: buildProviderDetailHref(listing),
      portraitSrc: listing.profileImageUrl,
    })),
  };

  return <ProvidersCatalogScreen data={screenData} />;
}
