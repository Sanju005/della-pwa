import { NextResponse } from "next/server";
import { getProviderCatalog } from "@/lib/provider-catalog";
import { parseCustomerLocation } from "@/lib/customer-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  const customerLocation = parseCustomerLocation(searchParams);
  const data = await getProviderCatalog(service, customerLocation);

  return NextResponse.json(data);
}
