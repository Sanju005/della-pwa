import "server-only";

import { createClient } from "@supabase/supabase-js";

import { sendPushNotificationToUser } from "./push-notifications";
import { getSupabaseServiceKey, getSupabaseUrl } from "./supabase-env";

export type BookingConversationThread = {
  bookingId: string;
  counterpartId: string;
  counterpartName: string;
  serviceLabel: string;
  location: string;
  schedule: string;
  preview: string;
  lastMessageAt: string;
  lastSenderRole: "customer" | "provider" | "admin" | "system";
  unreadCount: number;
};

export type BookingConversationMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  senderRole: "customer" | "provider" | "admin" | "system";
  senderName: string;
  messageText: string;
  attachmentDataUrl?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  createdAt: string;
  isOwnMessage: boolean;
};

export type BookingConversationDetail = {
  bookingId: string;
  counterpartId: string;
  counterpartName: string;
  serviceLabel: string;
  location: string;
  schedule: string;
  messages: BookingConversationMessage[];
  unreadCount: number;
  canSendMessages: boolean;
  bookingStatus:
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
  location_text: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  customer_note: string | null;
  provider_response_note: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: "customer" | "provider" | "admin" | "system";
  message_text: string;
  attachment_data_url: string | null;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  created_at: string;
};

type ReadStateRow = {
  booking_id: string;
  last_read_at: string;
};

export function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

export function getAdminSupabaseClient() {
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

export async function verifyAuthenticatedUser(
  request: Request,
  expectedRole: "customer" | "provider",
) {
  const adminClient = getAdminSupabaseClient();

  if (!adminClient) {
    return {
      error: { status: 500, body: { error: "Supabase is not configured yet." } },
    } as const;
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: { status: 401, body: { error: "Missing auth token." } },
    } as const;
  }

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: { status: 401, body: { error: "Invalid session." } },
    } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: { status: 404, body: { error: "Profile was not found." } },
    } as const;
  }

  if (expectedRole === "provider" && !isProviderRole((profile as ProfileRow).role)) {
    return {
      error: { status: 403, body: { error: "This account is not a provider." } },
    } as const;
  }

  if (expectedRole === "customer" && isProviderRole((profile as ProfileRow).role)) {
    return {
      error: { status: 403, body: { error: "This account is a provider account." } },
    } as const;
  }

  return {
    adminClient,
    profile: profile as ProfileRow,
  } as const;
}

function formatSchedule(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);

  const dateLabel = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(start);

  const formatTime = (value: Date) =>
    new Intl.DateTimeFormat("en-MY", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(value);

  return `${dateLabel}, ${formatTime(start)} - ${formatTime(end)}`;
}

function mapSchemaError(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("booking_message_reads") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  ) {
    return "Messaging read-state schema is missing. Apply `supabase/migrations/20260701_create_booking_message_reads.sql` and refresh the Supabase schema cache.";
  }

  if (
    normalized.includes("attachment_data_url") ||
    normalized.includes("attachment_file_name") ||
    normalized.includes("attachment_mime_type")
  ) {
    return "Booking message attachment schema is missing. Apply `supabase/migrations/20260702_booking_message_attachments.sql` and refresh the Supabase schema cache.";
  }

  return message || null;
}

function isConversationClosed(
  bookingStatus: BookingRow["booking_status"],
) {
  return [
    "review_requested",
    "reviewed",
    "declined",
    "cancelled",
  ].includes(bookingStatus);
}

async function loadParticipantNames(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  userIds: string[],
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  return new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [
      row.id,
      row.full_name?.trim() || "User",
    ]),
  );
}

async function loadReadStates(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  bookingIds: string[],
) {
  if (bookingIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await adminClient
    .from("booking_message_reads")
    .select("booking_id, last_read_at")
    .eq("user_id", userId)
    .in("booking_id", bookingIds);

  if (error) {
    throw new Error(mapSchemaError(error.message) || "Unable to load message read states.");
  }

  return new Map(
    ((data ?? []) as ReadStateRow[]).map((row) => [row.booking_id, row.last_read_at]),
  );
}

export async function loadConversationThreads(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  viewer: ProfileRow,
  viewerRole: "customer" | "provider",
) {
  const participantColumn = viewerRole === "customer" ? "customer_id" : "provider_id";

  const { data: bookings, error: bookingsError } = await adminClient
    .from("bookings")
    .select(`
      id,
      customer_id,
      provider_id,
      service_label,
      booking_status,
      location_text,
      scheduled_date,
      scheduled_start_time,
      scheduled_end_time,
      customer_note,
      provider_response_note,
      created_at
    `)
    .eq(participantColumn, viewer.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (bookingsError) {
    throw new Error(bookingsError.message || "Unable to load booking conversations.");
  }

  const bookingRows = (bookings ?? []) as BookingRow[];
  const bookingIds = bookingRows.map((row) => row.id);

  const counterpartIds = bookingRows.map((row) =>
    viewerRole === "customer" ? row.provider_id : row.customer_id,
  );

  const [counterpartNames, readStateMap, messagesResult] = await Promise.all([
    loadParticipantNames(adminClient, counterpartIds),
    loadReadStates(adminClient, viewer.id, bookingIds),
    bookingIds.length > 0
      ? adminClient
          .from("booking_messages")
          .select("id, booking_id, sender_id, sender_role, message_text, attachment_data_url, attachment_file_name, attachment_mime_type, created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as MessageRow[], error: null }),
  ]);

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message || "Unable to load booking messages.");
  }

  const latestMessageByBooking = new Map<string, MessageRow>();
  const unreadCountByBooking = new Map<string, number>();

  for (const message of (messagesResult.data ?? []) as MessageRow[]) {
    if (!latestMessageByBooking.has(message.booking_id)) {
      latestMessageByBooking.set(message.booking_id, message);
    }

    if (message.sender_id === viewer.id) {
      continue;
    }

    const lastReadAt = readStateMap.get(message.booking_id);
    if (!lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime()) {
      unreadCountByBooking.set(
        message.booking_id,
        (unreadCountByBooking.get(message.booking_id) ?? 0) + 1,
      );
    }
  }

  return bookingRows.map((booking) => {
    const latestMessage = latestMessageByBooking.get(booking.id);
    const counterpartId = viewerRole === "customer" ? booking.provider_id : booking.customer_id;
    const fallbackText =
      viewerRole === "customer"
        ? booking.provider_response_note?.trim() || booking.customer_note?.trim() || "Booking created."
        : booking.customer_note?.trim() || booking.provider_response_note?.trim() || "Booking created.";

    return {
      bookingId: booking.id,
      counterpartId,
      counterpartName: counterpartNames.get(counterpartId) || (viewerRole === "customer" ? "Provider" : "Customer"),
      serviceLabel: booking.service_label,
      location: booking.location_text,
      schedule: formatSchedule(
        booking.scheduled_date,
        booking.scheduled_start_time,
        booking.scheduled_end_time,
      ),
      preview:
        latestMessage?.message_text?.trim() ||
        (latestMessage?.attachment_data_url ? "Attachment" : "") ||
        fallbackText,
      lastMessageAt: latestMessage?.created_at || booking.created_at,
      lastSenderRole:
        latestMessage?.sender_role ||
        (viewerRole === "customer"
          ? booking.provider_response_note?.trim()
            ? "provider"
            : booking.customer_note?.trim()
              ? "customer"
              : "system"
          : booking.customer_note?.trim()
            ? "customer"
            : booking.provider_response_note?.trim()
              ? "provider"
              : "system"),
      unreadCount: unreadCountByBooking.get(booking.id) ?? 0,
    } satisfies BookingConversationThread;
  });
}

export async function loadConversationDetail(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  viewer: ProfileRow,
  viewerRole: "customer" | "provider",
  bookingId: string,
) {
  const participantColumn = viewerRole === "customer" ? "customer_id" : "provider_id";

  const { data: booking, error: bookingError } = await adminClient
    .from("bookings")
    .select(`
      id,
      customer_id,
      provider_id,
      service_label,
      booking_status,
      location_text,
      scheduled_date,
      scheduled_start_time,
      scheduled_end_time,
      customer_note,
      provider_response_note,
      created_at
    `)
    .eq("id", bookingId)
    .eq(participantColumn, viewer.id)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error("Booking conversation was not found.");
  }

  const bookingRow = booking as BookingRow;
  const counterpartId =
    viewerRole === "customer" ? bookingRow.provider_id : bookingRow.customer_id;

  const [participantNames, messagesResult, readStateMap] = await Promise.all([
    loadParticipantNames(adminClient, [viewer.id, counterpartId]),
    adminClient
      .from("booking_messages")
      .select("id, booking_id, sender_id, sender_role, message_text, attachment_data_url, attachment_file_name, attachment_mime_type, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    loadReadStates(adminClient, viewer.id, [bookingId]),
  ]);

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message || "Unable to load booking messages.");
  }

  const lastReadAt = readStateMap.get(bookingId);
  const messageRows = (messagesResult.data ?? []) as MessageRow[];

  return {
    bookingId: bookingRow.id,
    counterpartId,
    counterpartName:
      participantNames.get(counterpartId) || (viewerRole === "customer" ? "Provider" : "Customer"),
    serviceLabel: bookingRow.service_label,
    location: bookingRow.location_text,
    schedule: formatSchedule(
      bookingRow.scheduled_date,
      bookingRow.scheduled_start_time,
      bookingRow.scheduled_end_time,
    ),
    messages: messageRows.map((message) => ({
      id: message.id,
      bookingId: message.booking_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      senderName:
        participantNames.get(message.sender_id) ||
        (message.sender_role === "customer"
          ? "Customer"
          : message.sender_role === "provider"
            ? "Provider"
            : "System"),
      messageText: message.message_text,
      attachmentDataUrl: message.attachment_data_url ?? undefined,
      attachmentFileName: message.attachment_file_name ?? undefined,
      attachmentMimeType: message.attachment_mime_type ?? undefined,
      createdAt: message.created_at,
      isOwnMessage: message.sender_id === viewer.id,
    })),
    unreadCount: messageRows.filter((message) => {
      if (message.sender_id === viewer.id) {
        return false;
      }

      return !lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime();
    }).length,
    canSendMessages: !isConversationClosed(bookingRow.booking_status),
    bookingStatus: bookingRow.booking_status,
  } satisfies BookingConversationDetail;
}

export async function markConversationRead(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  bookingId: string,
) {
  const { error } = await adminClient
    .from("booking_message_reads")
    .upsert(
      {
        booking_id: bookingId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "booking_id,user_id" },
    );

  if (error) {
    throw new Error(mapSchemaError(error.message) || "Unable to mark messages as read.");
  }
}

export async function sendConversationMessage(
  adminClient: NonNullable<ReturnType<typeof getAdminSupabaseClient>>,
  viewer: ProfileRow,
  viewerRole: "customer" | "provider",
  bookingId: string,
  messageText: string,
  attachment?: {
    attachmentDataUrl?: string;
    attachmentFileName?: string;
    attachmentMimeType?: string;
  },
) {
  const participantColumn = viewerRole === "customer" ? "customer_id" : "provider_id";
  const trimmedMessage = messageText.trim();
  const trimmedAttachmentDataUrl = attachment?.attachmentDataUrl?.trim() ?? "";
  const trimmedAttachmentFileName = attachment?.attachmentFileName?.trim() ?? "";
  const trimmedAttachmentMimeType = attachment?.attachmentMimeType?.trim() ?? "";

  if (!trimmedMessage && !trimmedAttachmentDataUrl) {
    throw new Error("Message cannot be empty.");
  }

  const { data: booking, error: bookingError } = await adminClient
    .from("bookings")
    .select("id, customer_id, provider_id, service_label, booking_status")
    .eq("id", bookingId)
    .eq(participantColumn, viewer.id)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error("Booking conversation was not found.");
  }

  const bookingRow = booking as Pick<
    BookingRow,
    "id" | "customer_id" | "provider_id" | "service_label" | "booking_status"
  >;

  if (isConversationClosed(bookingRow.booking_status)) {
    throw new Error("Messaging is closed for this booking.");
  }

  const { error } = await adminClient
    .from("booking_messages")
    .insert({
      booking_id: bookingId,
      sender_id: viewer.id,
      sender_role: viewerRole,
      message_text: trimmedMessage,
      attachment_data_url: trimmedAttachmentDataUrl || null,
      attachment_file_name: trimmedAttachmentDataUrl ? trimmedAttachmentFileName || "Attachment" : null,
      attachment_mime_type: trimmedAttachmentDataUrl ? trimmedAttachmentMimeType || null : null,
    });

  if (error) {
    throw new Error(mapSchemaError(error.message) || error.message || "Unable to send message.");
  }

  await markConversationRead(adminClient, viewer.id, bookingId);

  const recipientId =
    viewerRole === "customer" ? bookingRow.provider_id : bookingRow.customer_id;
  const recipientPath =
    viewerRole === "customer"
      ? `/provider/messages?booking=${bookingId}`
      : `/profile/messages?booking=${bookingId}`;
  const senderName =
    viewer.full_name?.trim() || (viewerRole === "customer" ? "Customer" : "Provider");
  const pushTitle = `New message from ${senderName}`;
  const pushBody = trimmedMessage
    ? trimmedMessage.length > 120
      ? `${trimmedMessage.slice(0, 117)}...`
      : trimmedMessage
    : `${senderName} sent an attachment in your ${bookingRow.service_label} booking chat.`;

  const { error: notificationError } = await adminClient.from("notifications").insert({
    user_id: recipientId,
    booking_id: bookingId,
    notification_type: "booking_message",
    title: pushTitle,
    body: pushBody,
  });

  if (notificationError) {
    console.error("[Booking messages] Failed to store message notification:", notificationError);
  }

  try {
    await sendPushNotificationToUser(recipientId, {
      title: pushTitle,
      body: pushBody,
      bookingId,
      path: recipientPath,
      type: "message",
      event: "message_received",
      conversationId: bookingId,
      senderId: viewer.id,
    });
  } catch (pushError) {
    console.error("[Booking messages] Failed to send push notification:", pushError);
  }
}
