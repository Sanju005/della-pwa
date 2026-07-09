export type BookingWorkflowStatus =
  | "pending_provider_response"
  | "declined_by_provider"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "work_finished_by_provider"
  | "work_confirmed_by_user"
  | "final_payment_sent"
  | "cash_paid_by_user"
  | "payment_received_by_provider"
  | "completed"
  | "cancelled";

export function normalizeBookingWorkflowStatus(status: string | null | undefined): BookingWorkflowStatus {
  switch (status) {
    case "pending":
      return "pending_provider_response";
    case "declined":
      return "declined_by_provider";
    case "confirmed":
      return "accepted";
    case "canceled":
      return "cancelled";
    case "accepted":
    case "on_the_way":
    case "arrived":
    case "work_finished_by_provider":
    case "work_confirmed_by_user":
    case "final_payment_sent":
    case "cash_paid_by_user":
    case "payment_received_by_provider":
    case "completed":
    case "cancelled":
      return status;
    case "paid":
    case "review_requested":
    case "reviewed":
      return "completed";
    default:
      return "pending_provider_response";
  }
}

export function isCompletedWorkflowStatus(status: BookingWorkflowStatus) {
  return status === "completed";
}

export function isClosedWorkflowStatus(status: BookingWorkflowStatus) {
  return status === "declined_by_provider" || status === "cancelled" || status === "completed";
}
