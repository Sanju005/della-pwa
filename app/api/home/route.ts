import { NextResponse } from "next/server";
import { getHomeFeedData } from "@/lib/home-feed";
import { parseCustomerLocation } from "@/lib/customer-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerLocation = parseCustomerLocation(searchParams);
  const data = await getHomeFeedData(customerLocation);

  return NextResponse.json(data);
}
