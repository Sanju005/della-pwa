export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/tiff",
  "image/x-tiff",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".tif",
  ".tiff",
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
