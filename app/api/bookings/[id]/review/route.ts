import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { sendPushNotificationToUser } from "@/lib/push-notifications";
import {
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import { uploadStoredMediaList } from "@/lib/server-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewPayload = {
  rating?: number;
  comment?: string;
  photos?: string[];
  tags?: string[];
  recommend?: boolean;
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
    | "work_finished_by_provider"
    | "work_confirmed_by_user"
    | "final_payment_sent"
    | "cash_paid_by_user"
    | "payment_received_by_provider"
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

async function verifyCustomerRequest(request: Request) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured yet." },
        { status: 500 },
      ),
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

  if (profileError || !profile || isProviderRole((profile as ProfileRow).role)) {
    return {
      error: NextResponse.json(
        { error: "This account is not a customer account." },
        { status: 403 },
      ),
    };
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  };
}

function isMissingReviewedAtColumnError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return normalized.includes("column") && normalized.includes("reviewed_at");
}

function isMissingReviewMetadataColumnError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return normalized.includes("column") && (
    normalized.includes("tags") ||
    normalized.includes("recommend") ||
    normalized.includes("photos")
  );
}

function isMissingReviewsTableError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("could not find the table") && normalized.includes("reviews")
  ) || (
    normalized.includes("relation") && normalized.includes("reviews") && normalized.includes("does not exist")
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const verified = await verifyCustomerRequest(request);

  if ("error" in verified) {
    return verified.error;
  }

  const params = await context.params;
  const payload = (await request.json()) as ReviewPayload;
  const rating = Math.max(1, Math.min(5, Math.round(Number(payload.rating ?? 0))));
  const comment = payload.comment?.trim() ?? "";
  const tags = (payload.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const photos = await uploadStoredMediaList(
    verified.adminClient,
    (payload.photos ?? []).map((photo, index) => ({
      dataUrl: photo.trim(),
      fileName: `customer-review-${index + 1}.jpg`,
    })).filter((item) => Boolean(item.dataUrl)),
    {
      bucket: "review-images",
      ownerId: verified.profile.id,
      pathPrefix: [params.id, "customer-review"],
      visibility: "public",
    },
  );
  const recommend = payload.recommend !== false;

  if (!rating || !Number.isFinite(rating)) {
    return NextResponse.json(
      { error: "A rating from 1 to 5 is required." },
      { status: 400 },
    );
  }

  const { data: booking, error: bookingError } = await verified.adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, service_label, booking_status")
    .eq("id", params.id)
    .eq("customer_id", verified.profile.id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: "Booking was not found." },
      { status: 404 },
    );
  }

  const bookingRow = booking as BookingRow;

  if (
    bookingRow.booking_status !== "cash_paid_by_user" &&
    bookingRow.booking_status !== "payment_received_by_provider" &&
    bookingRow.booking_status !== "completed" &&
    bookingRow.booking_status !== "review_requested" &&
    bookingRow.booking_status !== "reviewed"
  ) {
    return NextResponse.json(
      { error: "This booking can be reviewed only after the task is completed." },
      { status: 400 },
    );
  }

  const { data: existingReview, error: existingReviewError } = await verified.adminClient
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingRow.id)
    .eq("customer_id", verified.profile.id)
    .maybeSingle();

  if (existingReviewError) {
    return NextResponse.json(
      {
        error: isMissingReviewsTableError(existingReviewError.message)
          ? "The reviews table is missing in Supabase. Run the latest database migration, then try again."
          : existingReviewError.message || "Unable to load existing review.",
      },
      { status: 500 },
    );
  }

  const reviewPayload = {
    booking_id: bookingRow.id,
    provider_id: bookingRow.provider_id,
    customer_id: verified.profile.id,
    rating,
    comment,
    photos,
    tags,
    recommend,
  };

  if (existingReview?.id) {
    let { error: updateReviewError } = await verified.adminClient
      .from("reviews")
      .update(reviewPayload)
      .eq("id", existingReview.id);

    if (updateReviewError && isMissingReviewMetadataColumnError(updateReviewError.message)) {
      const fallbackWrite = await verified.adminClient
        .from("reviews")
        .update({
          booking_id: bookingRow.id,
          provider_id: bookingRow.provider_id,
          customer_id: verified.profile.id,
          rating,
          comment,
        })
        .eq("id", existingReview.id);

      updateReviewError = fallbackWrite.error;
    }

    if (updateReviewError) {
      return NextResponse.json(
        {
          error: isMissingReviewsTableError(updateReviewError.message)
            ? "The reviews table is missing in Supabase. Run the latest database migration, then try again."
            : updateReviewError.message || "Unable to update review.",
        },
        { status: 500 },
      );
    }
  } else {
    let { error: insertReviewError } = await verified.adminClient
      .from("reviews")
      .insert(reviewPayload);

    if (insertReviewError && isMissingReviewMetadataColumnError(insertReviewError.message)) {
      const fallbackWrite = await verified.adminClient
        .from("reviews")
        .insert({
          booking_id: bookingRow.id,
          provider_id: bookingRow.provider_id,
          customer_id: verified.profile.id,
          rating,
          comment,
        });

      insertReviewError = fallbackWrite.error;
    }

    if (insertReviewError) {
      return NextResponse.json(
        {
          error: isMissingReviewsTableError(insertReviewError.message)
            ? "The reviews table is missing in Supabase. Run the latest database migration, then try again."
            : insertReviewError.message || "Unable to submit review.",
        },
        { status: 500 },
      );
    }
  }

  const shouldMoveToReviewed =
    bookingRow.booking_status === "completed" ||
    bookingRow.booking_status === "review_requested" ||
    bookingRow.booking_status === "reviewed";
  const bookingReviewUpdate = shouldMoveToReviewed
    ? {
        booking_status: "reviewed",
        user_review_status: "submitted",
        reviewed_at: new Date().toISOString(),
      }
    : {
        user_review_status: "submitted",
      };

  let { error: bookingUpdateError } = await verified.adminClient
    .from("bookings")
    .update(bookingReviewUpdate)
    .eq("id", bookingRow.id)
    .eq("customer_id", verified.profile.id);

  if (bookingUpdateError && isMissingReviewedAtColumnError(bookingUpdateError.message)) {
    const fallbackWrite = await verified.adminClient
      .from("bookings")
      .update(shouldMoveToReviewed ? { booking_status: "reviewed" } : {})
      .eq("id", bookingRow.id)
      .eq("customer_id", verified.profile.id);

    bookingUpdateError = fallbackWrite.error;
  }

  if (bookingUpdateError) {
    return NextResponse.json(
      { error: bookingUpdateError.message || "Unable to update booking review status." },
      { status: 500 },
    );
  }

  await verified.adminClient.from("notifications").insert({
    user_id: bookingRow.provider_id,
    booking_id: bookingRow.id,
    notification_type: "review_submitted",
    title: "New customer review",
    body: `${verified.profile.full_name?.trim() || "A customer"} reviewed your ${bookingRow.service_label} booking.`,
  });

  await sendPushNotificationToUser(bookingRow.provider_id, {
    title: "New customer review",
    body: `${verified.profile.full_name?.trim() || "A customer"} reviewed your ${bookingRow.service_label} booking.`,
    bookingId: bookingRow.id,
    path: `/provider/reviews`,
  });

  return NextResponse.json({ success: true });
}
