"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PlannerData } from "@/src/domain/planner/model/types";
import type { AccountIdentity } from "@/src/domain/identity/account";
import {
  guestStorageScope,
  type StorageScope,
} from "@/src/application/sync/state-repository";
import { storageRepository } from "@/src/infrastructure/storage/hybrid-state-repository";
import {
  signOutAccount,
  useAccountSession,
} from "@/src/infrastructure/auth/neon-auth-client";

export type SaveStatus = "saving" | "saved" | "error";

export type PlannerUpdate = (
  recipe: (current: PlannerData) => PlannerData,
  message?: string,
) => void;

type PlannerContextValue = {
  data: PlannerData;
  update: PlannerUpdate;
  saveStatus: SaveStatus;
  account: AccountIdentity | null;
  localOnly: boolean;
  toast: string;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const accountSession = useAccountSession();
  const [data, setData] = useState<PlannerData>(() =>
    storageRepository.getCachedState(guestStorageScope),
  );
  const [toast, setToast] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const hydrated = useRef(false);
  const changedDuringLoad = useRef(false);
  const skipNextSave = useRef(false);
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const loadRevision = useRef(0);
  const activeStorageScope = useRef<StorageScope>(guestStorageScope);

  useEffect(() => {
    if (accountSession.status === "loading") return;

    let cancelled = false;
    const revision = ++loadRevision.current;
    const scope: StorageScope =
      accountSession.status === "authenticated"
        ? {
            kind: "account",
            userId: `${accountSession.user.provider}:${accountSession.user.subject}`,
          }
        : guestStorageScope;

    activeStorageScope.current = scope;
    hydrated.current = false;
    changedDuringLoad.current = false;

    void storageRepository.load(scope).then((result) => {
      if (cancelled || revision !== loadRevision.current) return;

      hydrated.current = true;
      setSaveStatus("saved");

      if (changedDuringLoad.current) {
        setData((current) => ({ ...current }));
      } else {
        skipNextSave.current = true;
        setData(result.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    accountSession.status,
    accountSession.user?.provider,
    accountSession.user?.subject,
  ]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const revision = ++saveRevision.current;
    const snapshot = data;
    const scope = activeStorageScope.current;
    storageRepository.cache(scope, snapshot);
    setSaveStatus("saving");

    const timer = window.setTimeout(() => {
      const operation = saveQueue.current
        .catch(() => undefined)
        .then(() => storageRepository.save(scope, snapshot));
      saveQueue.current = operation;

      void operation.then(
        () => {
          if (revision === saveRevision.current) setSaveStatus("saved");
        },
        () => {
          if (revision === saveRevision.current) setSaveStatus("error");
        },
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.dataset.density = data.settings.density;
  }, [data.settings.theme, data.settings.density]);

  const update: PlannerContextValue["update"] = (recipe, message) => {
    if (!hydrated.current) changedDuringLoad.current = true;
    setData((current) => recipe(current));
    if (message) setToast(message);
  };

  const account =
    accountSession.status === "authenticated" ? accountSession.user : null;

  const signOut = async () => {
    const error = await signOutAccount();
    if (error) {
      setToast(error);
      return;
    }
    await accountSession.refresh();
    setToast("Вы вышли из аккаунта");
  };

  return (
    <PlannerContext.Provider
      value={{
        data,
        update,
        saveStatus,
        account,
        localOnly: !account,
        toast,
        signOut,
        refreshSession: accountSession.refresh,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const value = useContext(PlannerContext);
  if (!value) {
    throw new Error("usePlanner must be used inside PlannerProvider");
  }
  return value;
}
