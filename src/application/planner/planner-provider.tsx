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
  StateConflictError,
  type StorageScope,
} from "@/src/application/sync/state-repository";
import {
  hasPlannerContent,
  mergePlannerData,
  plannerContentSummary,
} from "@/src/domain/planner/lib/state";
import { storageRepository } from "@/src/infrastructure/storage/hybrid-state-repository";
import {
  signOutAccount,
  useAccountSession,
} from "@/src/infrastructure/auth/neon-auth-client";

export type SaveStatus = "saving" | "saved" | "error" | "conflict";

export type AccountMigration = {
  guest: PlannerData;
  account: PlannerData;
  summary: ReturnType<typeof plannerContentSummary>;
};

export type SaveIssue =
  | { kind: "network" }
  | { kind: "local" }
  | { kind: "conflict"; remoteRevision: number }
  | null;

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
  canUndo: boolean;
  undo: () => void;
  saveIssue: SaveIssue;
  retrySave: () => Promise<void>;
  resolveConflict: (choice: "remote" | "local") => Promise<void>;
  accountMigration: AccountMigration | null;
  resolveAccountMigration: (
    choice: "merge" | "guest" | "account",
  ) => void;
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
  const [saveIssue, setSaveIssue] = useState<SaveIssue>(null);
  const [undoState, setUndoState] = useState<PlannerData | null>(null);
  const [accountMigration, setAccountMigration] =
    useState<AccountMigration | null>(null);
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

    const guestSnapshot = storageRepository.getCachedState(guestStorageScope);
    void storageRepository.load(scope).then((result) => {
      if (cancelled || revision !== loadRevision.current) return;

      setSaveStatus("saved");
      setSaveIssue(null);

      if (
        scope.kind === "account" &&
        hasPlannerContent(guestSnapshot) &&
        !window.localStorage.getItem(`cadence-account-migration:${scope.userId}`)
      ) {
        skipNextSave.current = true;
        setData(result.data);
        setAccountMigration({
          guest: guestSnapshot,
          account: result.data,
          summary: plannerContentSummary(guestSnapshot),
        });
        return;
      }

      hydrated.current = true;

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
    try {
      storageRepository.cache(scope, snapshot);
    } catch {
      const errorTimer = window.setTimeout(() => {
        setSaveStatus("error");
        setSaveIssue({ kind: "local" });
      }, 0);
      return () => window.clearTimeout(errorTimer);
    }
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      const operation = saveQueue.current
        .catch(() => undefined)
        .then(() => storageRepository.save(scope, snapshot));
      saveQueue.current = operation;

      void operation.then(
        () => {
          if (revision === saveRevision.current) {
            setSaveStatus("saved");
            setSaveIssue(null);
          }
        },
        (error) => {
          if (revision !== saveRevision.current) return;
          if (error instanceof StateConflictError) {
            setSaveStatus("conflict");
            setSaveIssue({
              kind: "conflict",
              remoteRevision: error.remoteRevision,
            });
          } else {
            setSaveStatus("error");
            setSaveIssue({ kind: "network" });
          }
        },
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast("");
      setUndoState(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.dataset.density = data.settings.density;
  }, [data.settings.theme, data.settings.density]);

  const update: PlannerContextValue["update"] = (recipe, message) => {
    if (!hydrated.current) changedDuringLoad.current = true;
    setData((current) => {
      setUndoState(current);
      return recipe(current);
    });
    if (message) setToast(message);
  };

  const undo = () => {
    if (!undoState) return;
    setData(undoState);
    setUndoState(null);
    setToast("Изменение отменено");
  };

  const retrySave = async () => {
    setSaveStatus("saving");
    try {
      storageRepository.cache(activeStorageScope.current, data);
    } catch {
      setSaveStatus("error");
      setSaveIssue({ kind: "local" });
      return;
    }
    try {
      await storageRepository.save(activeStorageScope.current, data);
      setSaveStatus("saved");
      setSaveIssue(null);
    } catch (error) {
      if (error instanceof StateConflictError) {
        setSaveStatus("conflict");
        setSaveIssue({
          kind: "conflict",
          remoteRevision: error.remoteRevision,
        });
      } else {
        setSaveStatus("error");
        setSaveIssue({ kind: "network" });
      }
    }
  };

  const resolveConflict = async (choice: "remote" | "local") => {
    const issue = saveIssue;
    if (!issue || issue.kind !== "conflict") return;
    setSaveStatus("saving");
    try {
      if (choice === "remote") {
        const result = await storageRepository.load(activeStorageScope.current);
        if (!result.remoteAvailable) throw new Error("Remote unavailable");
        skipNextSave.current = true;
        setData(result.data);
        setToast("Загружена облачная версия");
      } else {
        await storageRepository.save(activeStorageScope.current, data, {
          revision: issue.remoteRevision,
        });
        setToast("Текущая версия сохранена в облаке");
      }
      setSaveStatus("saved");
      setSaveIssue(null);
    } catch {
      setSaveStatus("error");
      setSaveIssue({ kind: "network" });
    }
  };

  const resolveAccountMigration = (
    choice: "merge" | "guest" | "account",
  ) => {
    if (!accountMigration || activeStorageScope.current.kind !== "account") {
      return;
    }
    const next =
      choice === "merge"
        ? mergePlannerData(accountMigration.account, accountMigration.guest)
        : choice === "guest"
          ? accountMigration.guest
          : accountMigration.account;
    window.localStorage.setItem(
      `cadence-account-migration:${activeStorageScope.current.userId}`,
      choice,
    );
    setAccountMigration(null);
    hydrated.current = true;
    skipNextSave.current = false;
    setData(next);
    setToast(
      choice === "account"
        ? "Открыты данные аккаунта"
        : "Локальные данные перенесены в аккаунт",
    );
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
        canUndo: Boolean(undoState),
        undo,
        saveIssue,
        retrySave,
        resolveConflict,
        accountMigration,
        resolveAccountMigration,
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
