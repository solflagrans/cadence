"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import type { AccountSession } from "@/src/domain/identity/account";

const neonAuthClient = createAuthClient();

const messageFromError = (error: { message?: string } | null): string | null =>
  error?.message ?? null;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

const thrownAuthMessage = (error: unknown): string => {
  const candidate = record(error);
  const status = candidate?.status;
  const nested = record(candidate?.error) ?? record(candidate?.body);
  const message =
    (typeof nested?.message === "string" && nested.message) ||
    (error instanceof Error && error.message) ||
    (typeof candidate?.message === "string" && candidate.message);

  if (
    status === 403 ||
    (typeof message === "string" &&
      message.toLowerCase().includes("forbidden"))
  ) {
    return "Домен приложения не разрешён в настройках Neon Auth";
  }
  return message || "Не удалось связаться с сервисом авторизации";
};

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
  try {
    const result = await neonAuthClient.signIn.email({ email, password });
    return messageFromError(result.error);
  } catch (error) {
    return thrownAuthMessage(error);
  }
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const result = await neonAuthClient.signUp.email({ name, email, password });
    return messageFromError(result.error);
  } catch (error) {
    return thrownAuthMessage(error);
  }
}

export async function signOutAccount(): Promise<string | null> {
  try {
    const result = await neonAuthClient.signOut();
    return messageFromError(result.error);
  } catch (error) {
    return thrownAuthMessage(error);
  }
}
