"use client";

import { type ReactNode, useRef, useState } from "react";
import type { AccountIdentity } from "@/src/domain/identity/account";
import type { PlannerData } from "@/src/domain/planner/model/types";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";
import { downloadPlannerBackup } from "@/src/shared/lib/planner-backup";
import { Button } from "@/src/shared/ui/button/button";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import type { ModalState } from "../model/modal-state";
import { Icon, type IconName } from "@/src/shared/ui/icon/icon";

type UpdatePlanner = (
  recipe: (current: PlannerData) => PlannerData,
  message?: string,
) => void;

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div><strong>{label}</strong></div>
      <button
        type="button"
        className={`switch ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
        aria-label={`${label}: ${value ? "включено" : "выключено"}`}
      >
        <span />
      </button>
    </div>
  );
}

function SettingsTitle({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return <h2><Icon name={icon} size={18} />{children}</h2>;
}

export function SettingsPage({
  data,
  update,
  setModal,
  account,
  openAuth,
  signOut,
}: {
  data: PlannerData;
  update: UpdatePlanner;
  setModal: (modal: ModalState) => void;
  account: AccountIdentity | null;
  openAuth: () => void;
  signOut: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const patchSettings = (patch: Partial<PlannerData["settings"]>) =>
    update(
      (current) => ({
        ...current,
        settings: { ...current.settings, ...patch },
      }),
      "Настройки сохранены",
    );

  return (
    <>
      <PageHeader
        title="Настройки"
        eyebrow="Персонализация"
        description="Аккаунт, планирование, внешний вид и управление данными."
      />
      <div className="settings-layout">
        <section className="card settings-section settings-account">
          <SettingsTitle icon="user">Аккаунт</SettingsTitle>
          <div className="setting-row">
            <div>
              <strong>{account?.name || "Гость"}</strong>
              <span>
                {account?.email ||
                  "Данные хранятся только на этом устройстве"}
              </span>
            </div>
            {account ? (
              <Button icon="logout" variant="ghost" onClick={signOut}>Выйти</Button>
            ) : (
              <Button icon="login" variant="secondary" onClick={openAuth}>Войти</Button>
            )}
          </div>
        </section>
        <section className="card settings-section">
          <SettingsTitle icon="calendar">Региональные настройки</SettingsTitle>
          <label className="setting-row">
            <div><strong>Часовой пояс</strong></div>
            <select
              value={data.settings.timezone}
              onChange={(event) =>
                patchSettings({ timezone: event.target.value })
              }
            >
              <option>Europe/Moscow</option>
              <option>Europe/Berlin</option>
              <option>Asia/Tbilisi</option>
            </select>
          </label>
          <div className="setting-row">
            <div><strong>Первый день недели</strong></div>
            <span className="setting-static">Понедельник</span>
          </div>
          <label className="setting-row">
            <div><strong>Формат времени</strong></div>
            <select
              value={data.settings.timeFormat}
              onChange={(event) =>
                patchSettings({
                  timeFormat: event.target.value as "24" | "12",
                })
              }
            >
              <option value="24">24 часа</option>
              <option value="12">12 часов</option>
            </select>
          </label>
        </section>
        <section className="card settings-section">
          <SettingsTitle icon="plans">Планирование</SettingsTitle>
          <label className="setting-row">
            <div><strong>Диапазон графика</strong></div>
            <select
              value={data.settings.scheduleRange}
              onChange={(event) =>
                patchSettings({
                  scheduleRange: Number(event.target.value) as 14 | 21 | 30,
                })
              }
            >
              <option value="14">14 дней</option>
              <option value="21">21 день</option>
              <option value="30">30 дней</option>
            </select>
          </label>
          <ToggleRow
            label="Планирование недели"
            value={data.settings.weekReminder}
            onChange={(value) => patchSettings({ weekReminder: value })}
          />
          <ToggleRow
            label="Планирование месяца"
            value={data.settings.monthReminder}
            onChange={(value) => patchSettings({ monthReminder: value })}
          />
        </section>
        <section className="card settings-section">
          <SettingsTitle icon="spark">Внешний вид</SettingsTitle>
          <label className="setting-row">
            <div><strong>Тема</strong></div>
            <select
              value={data.settings.theme}
              onChange={(event) =>
                patchSettings({
                  theme: event.target.value as PlannerData["settings"]["theme"],
                })
              }
            >
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
              <option value="system">Системная</option>
            </select>
          </label>
          <label className="setting-row">
            <div><strong>Плотность</strong></div>
            <select
              value={data.settings.density}
              onChange={(event) =>
                patchSettings({
                  density: event.target.value as "comfortable" | "compact",
                })
              }
            >
              <option value="comfortable">Удобная</option>
              <option value="compact">Компактная</option>
            </select>
          </label>
        </section>
        <section className="card settings-section data-section">
          <SettingsTitle icon="cloud">Данные</SettingsTitle>
          <div className="data-actions">
            <Button
              icon="download"
              variant="secondary"
              onClick={() => downloadPlannerBackup(data)}
            >
              Экспортировать
            </Button>
            <Button
              icon="upload"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Импортировать
            </Button>
            <Button
              icon="trash"
              variant="danger"
              onClick={() => setModal({ kind: "confirm-reset" })}
            >
              Удалить данные
            </Button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const next = normalizePlannerData(
                    JSON.parse(await file.text()) as unknown,
                  );
                  if (!next) throw new Error();
                  update(() => next, "Данные импортированы");
                  setImportError("");
                } catch {
                  setImportError(
                    "Не удалось импортировать файл. Проверьте, что это резервная копия Cadence в формате JSON.",
                  );
                }
              }}
            />
          </div>
          {importError && (
            <p className="inline-message inline-message-error" role="alert">
              <Icon name="alert" size={16} />
              {importError}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
