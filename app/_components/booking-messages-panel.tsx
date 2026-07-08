"use client";

import { useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, FileText, MapPin, MessageCircleMore, Paperclip, SendHorizonal } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabase";
import {
  isPaymentProofMimeType,
  PAYMENT_PROOF_MAX_BYTES,
  readFileAsDataUrl,
} from "@/lib/upload-proof";

type Thread = {
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

type MessageItem = {
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

type ThreadDetail = {
  bookingId: string;
  counterpartId: string;
  counterpartName: string;
  serviceLabel: string;
  location: string;
  schedule: string;
  messages: MessageItem[];
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

type Theme = {
  accentText: string;
  accentBg: string;
  accentSoftBg: string;
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
  ownBubble: string;
  ownBubbleText: string;
  otherBubble: string;
  otherBubbleText: string;
  threadUnreadBorder: string;
  threadUnreadBg: string;
  composerButton: string;
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.max(1, Math.round((now.getTime() - date.getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function isPdfAttachment(mimeType?: string, fileName?: string) {
  return mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
}

function attachmentLabel(message: MessageItem) {
  return message.attachmentFileName || "Attachment";
}

export function BookingMessagesPanel({
  role,
  basePath,
  emptyTitle,
  emptyDescription,
  emptyActionHref,
  emptyActionLabel,
  fixedBookingId,
  hideThreadList = false,
  hideOpenBookingLink = false,
  theme,
}: {
  role: "customer" | "provider";
  basePath: "/profile/messages" | "/provider/messages";
  emptyTitle: string;
  emptyDescription: string;
  emptyActionHref: string;
  emptyActionLabel: string;
  fixedBookingId?: string;
  hideThreadList?: boolean;
  hideOpenBookingLink?: boolean;
  theme: Theme;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedBookingId = fixedBookingId || searchParams.get("booking") || "";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachmentDataUrl, setAttachmentDataUrl] = useState("");
  const [attachmentFileName, setAttachmentFileName] = useState("");
  const [attachmentMimeType, setAttachmentMimeType] = useState("");
  const [error, setError] = useState("");
  const [isSending, startSending] = useTransition();

  const apiBasePath = role === "customer" ? "/api/profile/messages" : "/api/provider/messages";

  async function withSession<T>(callback: (accessToken: string) => Promise<T>) {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error("Supabase is not configured yet.");
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      router.push("/login");
      throw new Error("Your session expired. Please log in again.");
    }

    return callback(session.access_token);
  }

  async function loadThreads() {
    return withSession(async (accessToken) => {
      const response = await fetch(apiBasePath, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as
        | { threads: Thread[] }
        | { error?: string };

      if (!response.ok || !("threads" in result)) {
        throw new Error(("error" in result ? result.error : "") || "Unable to load conversations.");
      }

      setThreads(result.threads);
      return result.threads;
    });
  }

  async function loadThreadDetail(bookingId: string) {
    if (!bookingId) {
      setThreadDetail(null);
      return null;
    }

    return withSession(async (accessToken) => {
      setThreadLoading(true);
      const response = await fetch(`${apiBasePath}/${encodeURIComponent(bookingId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as
        | { thread: ThreadDetail }
        | { error?: string };

      if (!response.ok || !("thread" in result)) {
        throw new Error(("error" in result ? result.error : "") || "Unable to load conversation.");
      }

      setThreadDetail(result.thread);

      if (result.thread.unreadCount > 0) {
        await fetch(`${apiBasePath}/${encodeURIComponent(bookingId)}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        setThreads((current) =>
          current.map((thread) =>
            thread.bookingId === bookingId ? { ...thread, unreadCount: 0 } : thread,
          ),
        );
      }

      return result.thread;
    }).finally(() => {
      setThreadLoading(false);
    });
  }

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;

    async function boot() {
      try {
        const loadedThreads = await loadThreads();

        if (!active) {
          return;
        }

        const targetBookingId = fixedBookingId || selectedBookingId || loadedThreads[0]?.bookingId || "";

        if (!fixedBookingId && !selectedBookingId && targetBookingId) {
          router.replace(`${pathname}?booking=${encodeURIComponent(targetBookingId)}`, {
            scroll: false,
          });
        } else if (targetBookingId) {
          await loadThreadDetail(targetBookingId);
        }

        if (!client) {
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await client.auth.getSession();

        if (!active || !session) {
          setLoading(false);
          return;
        }

        channel = client
          .channel(`${role}-booking-messages-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "booking_messages",
            },
            async () => {
              const refreshedThreads = await loadThreads().catch(() => null);
              if (!active) {
                return;
              }

              const activeBookingId = fixedBookingId || selectedBookingId || refreshedThreads?.[0]?.bookingId || "";
              if (activeBookingId) {
                await loadThreadDetail(activeBookingId).catch(() => null);
              }
            },
          )
          .subscribe();
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load conversations.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      active = false;
      if (client && channel) {
        void client.removeChannel(channel);
      }
    };
  }, [apiBasePath, fixedBookingId, pathname, role, router, selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId) {
      setThreadDetail(null);
      return;
    }

    void loadThreadDetail(selectedBookingId).catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load conversation.");
    });
  }, [selectedBookingId]);

  const selectedThreadSummary = useMemo(
    () => threads.find((thread) => thread.bookingId === selectedBookingId) ?? null,
    [selectedBookingId, threads],
  );

  function openThread(bookingId: string) {
    if (fixedBookingId) {
      void loadThreadDetail(bookingId).catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load conversation.");
      });
      return;
    }

    router.replace(`${basePath}?booking=${encodeURIComponent(bookingId)}`, {
      scroll: false,
    });
  }

  function sendMessage() {
    const nextMessage = draft.trim();
    if (!selectedBookingId || (!nextMessage && !attachmentDataUrl) || !threadDetail?.canSendMessages) {
      return;
    }

    startSending(async () => {
      try {
        setError("");
        const thread = await withSession(async (accessToken) => {
          const response = await fetch(`${apiBasePath}/${encodeURIComponent(selectedBookingId)}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messageText: nextMessage,
              attachmentDataUrl,
              attachmentFileName,
              attachmentMimeType,
            }),
          });

          const result = (await response.json()) as
            | { thread: ThreadDetail }
            | { error?: string };

          if (!response.ok || !("thread" in result)) {
            throw new Error(("error" in result ? result.error : "") || "Unable to send message.");
          }

          return result.thread;
        });

        setDraft("");
        setAttachmentDataUrl("");
        setAttachmentFileName("");
        setAttachmentMimeType("");
        setThreadDetail(thread);
        const refreshedThreads = await loadThreads().catch(() => null);
        if (!fixedBookingId && !selectedBookingId && refreshedThreads?.[0]?.bookingId) {
          openThread(refreshedThreads[0].bookingId);
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to send message.");
      }
    });
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      setError("Attachment must be 5MB or smaller.");
      return;
    }

    if (!isPaymentProofMimeType(file.type)) {
      setError("Attachment must be JPG, PNG, GIF, WebP, or PDF.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachmentDataUrl(dataUrl);
      setAttachmentFileName(file.name);
      setAttachmentMimeType(file.type);
      setError("");
    } catch {
      setError("Unable to read attachment.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#e5e7eb] bg-white px-4 py-8 text-center text-[14px] text-[#6b7280]">
        Loading conversations...
      </div>
    );
  }

  const activeThread = threadDetail ?? selectedThreadSummary;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-[16px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] font-semibold text-[#dc2626]">
          {error}
        </p>
      ) : null}

      {!hideThreadList ? (
        <section className="rounded-[22px] border border-[#e5e7eb] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-black text-[#111827]">Booking Conversations</h2>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              Messages are grouped by booking so both sides stay in the same thread.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
            {threads.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {threads.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#d9e2dd] bg-[#fbfefc] px-4 py-8 text-center">
              <div className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full ${theme.accentSoftBg} ${theme.accentText}`}>
                <MessageCircleMore className="h-6 w-6" />
              </div>
              <p className="mt-4 text-[15px] font-extrabold text-[#111827]">{emptyTitle}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#6b7280]">{emptyDescription}</p>
              <Link
                href={emptyActionHref}
                className={`mt-4 inline-flex h-10 items-center justify-center rounded-[12px] px-4 text-[13px] font-extrabold text-white ${theme.composerButton}`}
              >
                {emptyActionLabel}
              </Link>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.bookingId}
                type="button"
                onClick={() => openThread(thread.bookingId)}
                className={`w-full rounded-[18px] border p-4 text-left ${
                  selectedBookingId === thread.bookingId
                    ? `${theme.accentBorder} ${theme.accentSoftBg}`
                    : thread.unreadCount > 0
                      ? `${theme.threadUnreadBorder} ${theme.threadUnreadBg}`
                      : "border-[#e5e7eb] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold text-[#111827]">
                      {thread.counterpartName}
                    </p>
                    <p className={`mt-1 text-[12px] font-semibold ${theme.accentText}`}>
                      {thread.serviceLabel}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#4b5563]">
                      {thread.preview}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[#94a3b8]" suppressHydrationWarning>
                      {formatRelativeDate(thread.lastMessageAt)}
                    </p>
                    {thread.unreadCount > 0 ? (
                      <span className={`mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white ${theme.composerButton}`}>
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[12px] text-[#6b7280]">
                  <div className="flex items-center gap-2">
                    <CalendarDays className={`h-4 w-4 ${theme.accentText}`} />
                    <span>{thread.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-4 w-4 ${theme.accentText}`} />
                    <span>{thread.location}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
      ) : null}

      {activeThread ? (
        <section className="rounded-[22px] border border-[#e5e7eb] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <div className="border-b border-[#edf1ef] pb-4">
            <p className="text-[16px] font-black text-[#111827]">
              {activeThread.counterpartName}
            </p>
            <p className={`mt-1 text-[12px] font-semibold ${theme.accentText}`}>
              {activeThread.serviceLabel}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[#6b7280]">
              {activeThread.schedule}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {threadLoading ? (
              <div className="rounded-[16px] bg-[#f8fafc] px-4 py-6 text-center text-[13px] text-[#6b7280]">
                Loading messages...
              </div>
            ) : threadDetail?.messages.length ? (
              threadDetail.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[18px] px-4 py-3 ${
                      message.isOwnMessage
                        ? `${theme.ownBubble} ${theme.ownBubbleText}`
                        : `${theme.otherBubble} ${theme.otherBubbleText}`
                    }`}
                  >
                    <p className="text-[11px] font-bold opacity-80">{message.senderName}</p>
                    {message.messageText ? (
                      <p className="mt-1 text-[13px] leading-6">{message.messageText}</p>
                    ) : null}
                    {message.attachmentDataUrl ? (
                      <div className="mt-3 rounded-[14px] border border-white/20 bg-white/10 p-3">
                        {isPdfAttachment(message.attachmentMimeType, message.attachmentFileName) ? (
                          <a
                            href={message.attachmentDataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-[12px] font-bold underline"
                          >
                            <FileText className="h-4 w-4" />
                            {attachmentLabel(message)}
                          </a>
                        ) : (
                          <a href={message.attachmentDataUrl} target="_blank" rel="noreferrer">
                            <img
                              src={message.attachmentDataUrl}
                              alt={attachmentLabel(message)}
                              className="max-h-52 w-full rounded-[12px] object-cover"
                            />
                          </a>
                        )}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[10px] opacity-70">{formatTimestamp(message.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[16px] border border-dashed border-[#d9e2dd] bg-[#fbfefc] px-4 py-6 text-center text-[13px] text-[#6b7280]">
                No messages in this booking thread yet.
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-[#edf1ef] pt-4">
            {!threadDetail?.canSendMessages ? (
              <p className="mb-3 rounded-[14px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 text-[13px] font-semibold text-[#64748b]">
                Messaging is closed for this booking because the task is completed or closed.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#111827]">
                Send message
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message about this booking..."
                disabled={!threadDetail?.canSendMessages}
                className="min-h-[6rem] w-full rounded-[16px] border border-[#d9e2dd] bg-white px-4 py-3 text-[14px] text-[#111827] outline-none placeholder:text-[#98A2B3]"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#d9e2dd] px-4 text-[13px] font-bold text-[#111827] ${!threadDetail?.canSendMessages ? "pointer-events-none opacity-60" : ""}`}>
                <Paperclip className="h-4 w-4" />
                Attach file
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,application/pdf,image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  disabled={!threadDetail?.canSendMessages}
                  onChange={(event) => void handleAttachmentChange(event)}
                />
              </label>
              {attachmentDataUrl ? (
                <div className="flex min-w-0 items-center gap-2 rounded-[12px] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475569]">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate font-semibold">{attachmentFileName || "Attachment ready"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentDataUrl("");
                      setAttachmentFileName("");
                      setAttachmentMimeType("");
                    }}
                    className="font-bold text-[#dc2626]"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              {hideOpenBookingLink ? (
                <span />
              ) : (
                <Link
                  href={role === "customer" ? `/profile/bookings/${activeThread.bookingId}` : `/provider/bookings/${activeThread.bookingId}`}
                  className={`text-[12px] font-bold ${theme.accentText}`}
                >
                  Open booking details
                </Link>
              )}
              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending || (!draft.trim() && !attachmentDataUrl) || !threadDetail?.canSendMessages}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-[12px] px-4 text-[13px] font-extrabold text-white disabled:opacity-60 ${theme.composerButton}`}
              >
                <SendHorizonal className="h-4 w-4" />
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
