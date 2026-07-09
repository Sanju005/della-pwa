"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getFreshSupabaseSession, getSupabaseClient } from "@/lib/supabase";

function isProviderRole(role: string | null | undefined) {
  return role === "provider" || role === "service_provider";
}

export default function AppEntryPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function routeUser() {
      const supabase = getSupabaseClient();

      if (!supabase) {
        router.replace("/login");
        return;
      }

      const session = await getFreshSupabaseSession(supabase);

      if (!active) {
        return;
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (isProviderRole(profile?.role)) {
        router.replace("/provider/dashboard");
        return;
      }

      router.replace("/home");
    }

    void routeUser();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#fbf8ff] px-6">
      <div className="rounded-[24px] bg-white px-6 py-5 text-center shadow-[0_18px_40px_rgba(67,35,104,0.08)] ring-1 ring-[#f0e8fa]">
        <p className="text-[15px] font-semibold text-[#625877]">Opening Swiper...</p>
      </div>
    </main>
  );
}
