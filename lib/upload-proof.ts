import {
  hasAcceptedImageExtension,
  isAcceptedImageMimeType,
} from "@/lib/image-upload";

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function isPaymentProofMimeType(value: string) {
  return (
    value === "application/pdf" ||
    isAcceptedImageMimeType(value) ||
    value === "image/webp"
  );
}

export function isPaymentProofFile(file: Pick<File, "type" | "name">) {
  return (
    file.type === "application/pdf" ||
    isPaymentProofMimeType(file.type) ||
    hasAcceptedImageExtension(file.name) ||
    file.name.trim().toLowerCase().endsWith(".pdf")
  );
}

export async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}
