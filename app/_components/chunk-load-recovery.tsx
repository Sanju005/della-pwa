"use client";

import { useEffect } from "react";

const RELOAD_MARKER_KEY = "della-chunk-reload-marker";

function isChunkLoadErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("chunkloaderror") ||
    normalizedMessage.includes("loading chunk") ||
    normalizedMessage.includes("failed to fetch dynamically imported module") ||
    normalizedMessage.includes("importing a module script failed")
  );
}

function isHydrationErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("minified react error #418") ||
    normalizedMessage.includes("hydration failed") ||
    normalizedMessage.includes("text content does not match")
  );
}

function reloadOnceForCurrentLocation() {
  if (typeof window === "undefined") {
    return;
  }

  const currentMarker = `${window.location.pathname}${window.location.search}`;
  const previousMarker = window.sessionStorage.getItem(RELOAD_MARKER_KEY);

  if (previousMarker === currentMarker) {
    return;
  }

  window.sessionStorage.setItem(RELOAD_MARKER_KEY, currentMarker);
  window.location.reload();
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      const message = event.message || "";

      if (isChunkLoadErrorMessage(message) || isHydrationErrorMessage(message)) {
        reloadOnceForCurrentLocation();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "";

      if (isChunkLoadErrorMessage(reason) || isHydrationErrorMessage(reason)) {
        reloadOnceForCurrentLocation();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
