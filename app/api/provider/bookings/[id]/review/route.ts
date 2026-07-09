import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";
import { uploadStoredMediaList } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewPayload = {
  rating?: number;
  comment?: string;
  photos?: string[];
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type BookingRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  service_label: string;
  booking_status:
    | "pending"
    | "accepted"
    | "on_the_way"
    | "arrived"
    | "completed"
    | "paid"
    | "review_requested"
    | "reviewed"
    | "declined"
    | "cancelled";
};

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

function getAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function verifyProviderRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 }),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json({ error: "This account is not a provider account." }, { status: 403 }),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const verified = await verifyProviderRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const params = await context.params;
  const payload = (await request.json().catch(() => ({}))) as ReviewPayload;
  const rating = Math.max(1, Math.min(5, Math.round(Number(payload.rating ?? 0))));
  const comment = payload.comment?.trim() ?? "";
  const photos = await uploadStoredMediaList(
    verified.adminClient,
    (payload.photos ?? []).map((photo, index) => ({
      dataUrl: photo.trim(),
      fileName: `provider-review-${index + 1}.jpg`,
    })).filter((item) => Boolean(item.dataUrl)),
    {
      bucket: "review-images",
      ownerId: verified.profile.id,
      pathPrefix: [params.id, "provider-review"],
      visibility: "public",
    },
  );

  if (!rating || !Number.isFinite(rating)) {
    return NextResponse.json({ error: "A rating from 1 to 5 is required." }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, service_label, booking_status")
    .eq("id", params.id)
    .eq("provider_id", verified.profile.id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking was not found." }, { status: 404 });
  }

  const bookingRow = booking as BookingRow;

  if (
    bookingRow.booking_status !== "completed" &&
    bookingRow.booking_status !== "review_requested" &&
    bookingRow.booking_status !== "reviewed"
  ) {
    return NextResponse.json(
      { error: "Provider review is only available after the booking is fully completed." },
      { status: 400 },
    );
  }

  const { data: existingReview, error: existingReviewError } = await verified.adminClient
    .from("provider_customer_reviews")
    .select("id")
    .eq("booking_id", bookingRow.id)
    .eq("provider_id", verified.profile.id)
    .maybeSingle();

  if (existingReviewError) {
    return NextResponse.json(
      { error: existingReviewError.message || "Unable to load provider review." },
      { status: 500 },
    );
  }

  const reviewPayload = {
    booking_id: bookingRow.id,
    provider_id: verified.profile.id,
    customer_id: bookingRow.customer_id,
    rating,
    comment,
    photos,
  };

  let reviewWrite = existingReview?.id
    ? await verified.adminClient
        .from("provider_customer_reviews")
        .update(reviewPayload)
        .eq("id", existingReview.id)
    : await verified.adminClient
        .from("provider_customer_reviews")
        .insert(reviewPayload);

  if (reviewWrite.error && reviewWrite.error.message?.toLowerCase().includes("photos")) {
    const fallbackPayload = {
      booking_id: bookingRow.id,
      provider_id: verified.profile.id,
      customer_id: bookingRow.customer_id,
      rating,
      comment,
    };

    reviewWrite = existingReview?.id
      ? await verified.adminClient
          .from("provider_customer_reviews")
          .update(fallbackPayload)
          .eq("id", existingReview.id)
      : await verified.adminClient
          .from("provider_customer_reviews")
          .insert(fallbackPayload);
  }

  if (reviewWrite.error) {
    return NextResponse.json(
      { error: reviewWrite.error.message || "Unable to submit provider review." },
      { status: 500 },
    );
  }

  const bookingReviewUpdate = {
    provider_review_status: "submitted",
  };

  const { error: bookingUpdateError } = await verified.adminClient
    .from("bookings")
    .update(bookingReviewUpdate)
    .eq("id", bookingRow.id)
    .eq("provider_id", verified.profile.id);

  if (bookingUpdateError) {
    return NextResponse.json(
      { error: bookingUpdateError.message || "Unable to update booking review status." },
      { status: 500 },
    );
  }

  await verified.adminClient.from("notifications").insert({
    user_id: bookingRow.customer_id,
    booking_id: bookingRow.id,
    notification_type: "review_submitted",
    title: "New provider review",
    body: `${verified.profile.full_name?.trim() || "Your provider"} reviewed your ${bookingRow.service_label} booking.`,
  });

  try {
    await sendPushNotificationToUser(bookingRow.customer_id, {
      title: "New provider review",
      body: `${verified.profile.full_name?.trim() || "Your provider"} reviewed your ${bookingRow.service_label} booking.`,
      bookingId: bookingRow.id,
      path: `/profile/bookings/${bookingRow.id}`,
    });
  } catch (pushError) {
    console.error("[Provider review submit] Failed to send customer push notification:", pushError);
  }

  return NextResponse.json({ success: true });
}
