"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

interface UserData {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  walletAddress: string | null;
  subscription: { plan: "FREE" | "PRO" | "ENTERPRISE"; status: string } | null;
  _count: { bots: number; trades: number };
}

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: ["current-user", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<UserData | null> => {
      const res = await fetch("/api/user/me");
      if (!res.ok) throw new Error("Your account could not be loaded.");
      return (await res.json()).user ?? null;
    },
  });

  const userData = query.data ?? null;
  return {
    user: session?.user ?? null,
    userData,
    subscription: userData?.subscription ?? null,
    plan: (userData?.subscription?.plan ?? "FREE") as "FREE" | "PRO" | "ENTERPRISE",
    isLoading: status === "loading" || query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    isAuthenticated: status === "authenticated",
    refetch: () => { void query.refetch(); },
  };
}
