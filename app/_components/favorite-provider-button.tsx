"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import {
  isFavoriteSchemaUnavailable,
  loadStoredFavoriteProviderIds,
  saveStoredFavoriteProviderIds,
} from "@/lib/customer-favorites-browser";
import { getSupabaseClient } from "@/lib/supabase";

const FAVORITES_UPDATED_EVENT = "della:favorites-updated";

let favoriteIdsCache: Set<string> | null = null;
let favoriteIdsPromise: Promise<Set<string>> | null = null;

function cloneFavoriteIds(ids: Set<string>) {
  return new Set(ids);
}

async function loadFavoriteIds() {
  if (favoriteIdsCache) {
    return cloneFavoriteIds(favoriteIdsCache);
  }

  if (!favoriteIdsPromise) {
    favoriteIdsPromise = (async () => {
      const client = getSupabaseClient();

      if (!client) {
        const storedIds = loadStoredFavoriteProviderIds();
        favoriteIdsCache = storedIds;
        return cloneFavoriteIds(storedIds);
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session) {
        const storedIds = loadStoredFavoriteProviderIds();
        favoriteIdsCache = storedIds;
        return cloneFavoriteIds(storedIds);
      }

      const response = await fetch("/api/profile/favorites", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => null);

      if (!response) {
        const storedIds = loadStoredFavoriteProviderIds();
        favoriteIdsCache = storedIds;
        return cloneFavoriteIds(storedIds);
      }

      const result = (await response.json().catch(() => ({}))) as {
        favoriteProviders?: Array<{ id: string }>;
        error?: string;
      };

      const ids =
        response.ok && "favoriteProviders" in result
          ? new Set((result.favoriteProviders ?? []).map((provider) => provider.id))
          : loadStoredFavoriteProviderIds();
      favoriteIdsCache = ids;
      saveStoredFavoriteProviderIds(ids);
      return cloneFavoriteIds(ids);
    })().finally(() => {
      favoriteIdsPromise = null;
    });
  }

  return cloneFavoriteIds(await favoriteIdsPromise);
}

function broadcastFavoriteIds(ids: Set<string>) {
  favoriteIdsCache = cloneFavoriteIds(ids);
  saveStoredFavoriteProviderIds(ids);
  window.dispatchEvent(
    new CustomEvent(FAVORITES_UPDATED_EVENT, {
      detail: {
        favoriteIds: [...ids],
      },
    }),
  );
}

export function FavoriteProviderButton({
  providerId,
  serviceKey,
  className,
  activeClassName,
  inactiveClassName,
  iconClassName,
}: {
  providerId: string;
  serviceKey?: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  iconClassName?: string;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    void loadFavoriteIds().then((ids) => {
      if (!active) {
        return;
      }

      setIsFavorite(ids.has(providerId));
      setLoaded(true);
    });

    function handleFavoriteUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ favoriteIds?: string[] }>;
      const nextIds = new Set(customEvent.detail?.favoriteIds ?? []);
      setIsFavorite(nextIds.has(providerId));
      setLoaded(true);
    }

    window.addEventListener(FAVORITES_UPDATED_EVENT, handleFavoriteUpdate);

    return () => {
      active = false;
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleFavoriteUpdate);
    };
  }, [providerId]);

  function handleToggle() {
    startTransition(async () => {
      const client = getSupabaseClient();

      if (!client) {
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const nextFavoriteState = !isFavorite;
      const nextIds = cloneFavoriteIds(favoriteIdsCache ?? new Set<string>());

      if (nextFavoriteState) {
        nextIds.add(providerId);
      } else {
        nextIds.delete(providerId);
      }

      setIsFavorite(nextFavoriteState);
      broadcastFavoriteIds(nextIds);

      const response = await fetch("/api/profile/favorites", {
        method: nextFavoriteState ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          providerId,
          serviceKey,
        }),
      }).catch(() => null);

      const result = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;

      if (!response?.ok && !isFavoriteSchemaUnavailable(result?.error)) {
        const revertedIds = cloneFavoriteIds(nextIds);
        if (nextFavoriteState) {
          revertedIds.delete(providerId);
        } else {
          revertedIds.add(providerId);
        }

        setIsFavorite(!nextFavoriteState);
        broadcastFavoriteIds(revertedIds);
        return;
      }

      router.refresh();
    });
  }

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove provider from favourites" : "Save provider to favourites"}
      aria-pressed={isFavorite}
      onClick={handleToggle}
      disabled={isPending}
      className={[
        className ?? "",
        isFavorite
          ? activeClassName ?? "text-[#E11D48]"
          : inactiveClassName ?? "text-[#667085]",
        isPending || !loaded ? "opacity-80" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Heart className={`${iconClassName ?? "h-5 w-5"} ${isFavorite ? "fill-current" : ""}`} />
    </button>
  );
}
