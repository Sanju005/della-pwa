export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/x-tiff",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".jfif",
  ".jif",
  ".jiff",
] as const;

export const CROPPABLE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const CROPPABLE_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".jfif",
  ".jif",
  ".jiff",
] as const;

export const IMAGE_UPLOAD_ACCEPT = [
  ...ACCEPTED_IMAGE_EXTENSIONS,
  ...ACCEPTED_IMAGE_MIME_TYPES,
].join(",");

export function hasAcceptedImageExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();

  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(extension),
  );
}

export function isAcceptedImageMimeType(value: string) {
  return ACCEPTED_IMAGE_MIME_TYPES.includes(
    value.trim().toLowerCase() as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number],
  );
}

export function isAcceptedImageFile(file: Pick<File, "type" | "name">) {
  return isAcceptedImageMimeType(file.type) || hasAcceptedImageExtension(file.name);
}

export function hasCroppableImageExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();

  return CROPPABLE_IMAGE_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(extension),
  );
}

export function isCroppableImageMimeType(value: string) {
  return CROPPABLE_IMAGE_MIME_TYPES.includes(
    value.trim().toLowerCase() as (typeof CROPPABLE_IMAGE_MIME_TYPES)[number],
  );
}

export function isCroppableImageFile(file: Pick<File, "type" | "name">) {
  return isCroppableImageMimeType(file.type) || hasCroppableImageExtension(file.name);
}
