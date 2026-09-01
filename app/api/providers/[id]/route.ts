import { NextResponse } from "next/server";

import { getProviderDetail } from "@/lib/provider-detail";
import { parseCustomerLocation } from "@/lib/customer-location";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  const customerLocation = parseCustomerLocation(searchParams);
  const detail = await getProviderDetail(id, service, customerLocation);

  if (!detail) {
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
