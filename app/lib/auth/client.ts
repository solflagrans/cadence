"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import type { AccountSession } from "./types";

const neonAuthClient = createAuthClient();

const messageFromError = (error: { message?: string } | null): string | null =>
  error?.message ?? null;

export function useAccountSession(): AccountSession & {
  refresh: () => Promise<void>;
} {
  const session = neonAuthClient.useSession();

  if (session.isPending) {
    return { status: "loading", user: null, refresh: session.refetch };
  }

  if (!session.data?.user) {
    return { status: "guest", user: null, refresh: session.refetch };
  }

  return {
    status: "authenticated",
    user: {
      provider: "neon",
      subject: session.data.user.id,
      name: session.data.user.name,
      email: session.data.user.email,
      image: session.data.user.image,
    },
    refresh: session.refetch,
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string | null> {
  const result = await neonAuthClient.signIn.email({ email, password });
  return messageFromError(result.error);
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<string | null> {
  const result = await neonAuthClient.signUp.email({ name, email, password });
  return messageFromError(result.error);
}

export async function signOutAccount(): Promise<string | null> {
  const result = await neonAuthClient.signOut();
  return messageFromError(result.error);
}
