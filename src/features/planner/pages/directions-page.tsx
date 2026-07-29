"use client";

import { useEffect, useState } from "react";
import type { PlannerData } from "@/src/domain/planner/model/types";
import { iso } from "@/src/domain/planner/lib/dates";
import { itemFact, itemProgress } from "@/src/domain/planner/lib/progress";
import {
  formatValue,
  metricName,
  monthName,
} from "@/app/lib/data";
import { navigate } from "@/src/application/navigation/routes";
import { Badge } from "@/src/shared/ui/badge/badge";
import { Button } from "@/src/shared/ui/button/button";
import { EmptyState } from "@/src/shared/ui/empty-state/empty-state";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import { ProgressBar } from "@/src/shared/ui/progress-bar/progress-bar";
import { Icon } from "@/src/shared/ui/icon/icon";
import { IconButton } from "@/src/shared/ui/icon-button/icon-button";
import type { ModalState } from "../model/modal-state";
import type { PlannerUpdate } from "@/src/application/planner/planner-provider";
import {
  archiveDirection,
  deleteDirection,
  directionDeletionImpact,
  restoreDirection,
} from "@/src/domain/planner/commands/directions";

export function DirectionsPage({
  data,
  setModal,
  update,
}: {
  data: PlannerData;
  setModal: (modal: ModalState) => void;
  update: PlannerUpdate;
}) {
  const [view, setView] = useState<"active" | "archive">(() => {
    if (typeof window === "undefined") return "active";
    return new URLSearchParams(window.location.search).get("view") === "archive"
      ? "archive"
      : "active";
  });
  const [query, setQuery] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("query") ?? "",
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("query", query);
    else params.delete("query");
    if (view === "archive") params.set("view", view);
    else params.delete("view");
    params.delete("filter");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [query, view]);
  const month = data.months.find(
    (item) => item.id === iso(new Date()).slice(0, 7),
  );
  const filtered = data.directions
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .filter((item) =>
      view === "archive"
        ? item.availability === "archived"
        : item.availability !== "archived",
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <>
      <PageHeader
        title="Направления"
        eyebrow="Система целей"
        description="Все направления, их метрики и состояние текущего месяца."
        actions={
          <Button icon="plus" onClick={() => setModal({ kind: "direction" })}>
            Новое направление
          </Button>
        }
      />
      <div className="direction-view-tabs tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={view === "active"}
          className={view === "active" ? "active" : ""}
          onClick={() => setView("active")}
        >
          Активные
        </button>
        <button
          role="tab"
          aria-selected={view === "archive"}
          className={view === "archive" ? "active" : ""}
          onClick={() => setView("archive")}
        >
          Архив
        </button>
      </div>
      <div className="filter-bar direction-search-bar">
        <div className="search-wrap">
          <Icon name="search" size={18} />
          <input
            className="search-input"
            placeholder="Найти направление"
            aria-label="Поиск направлений"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <section className="card direction-table">
        <div className="table-head">
          <span>Направление</span>
          <span>Метрика</span>
          <span>Доступность</span>
          <span>Текущий месяц</span>
          <span />
        </div>
        {filtered.map((direction) => {
          const item = month?.items.find(
            (plan) => plan.directionId === direction.id,
          );
          const fact = item ? itemFact(data, item) : 0;
          return (
            <div className="table-row" key={direction.id}>
              <button
                className="direction-name"
                onClick={() => {
                  window.sessionStorage.setItem(
                    "cadence:directions:return",
                    `${window.location.pathname}${window.location.search}`,
                  );
                  navigate({ page: "direction", id: direction.id });
                }}
              >
                <span
                  className="direction-dot"
                  style={{ background: direction.color }}
                />
                <strong>{direction.name}</strong>
              </button>
              <span>
                {metricName[direction.metric]}
                {direction.unit && ` · ${direction.unit}`}
              </span>
              <span>
                <Badge
                  tone={
                    direction.availability === "active"
                      ? "green"
                      : direction.availability === "paused"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {direction.availability === "active"
                    ? "Активно"
                    : direction.availability === "paused"
                      ? "Приостановлено"
                      : "Архив"}
                </Badge>
              </span>
              <div className="table-row-progress">
                <span>
                  {item
                    ? `${formatValue(fact, item.metric, item.unit)} / ${formatValue(item.target, item.metric, item.unit)}`
                    : "Не запланировано"}
                </span>
                {item && (
                  <ProgressBar
                    value={itemProgress(fact, item)}
                    color={direction.color}
                  />
                )}
              </div>
              <div className="direction-row-actions">
                {direction.availability === "archived" ? (
                  <>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() =>
                        update(
                          (current) =>
                            restoreDirection(current, direction.id),
                          "Направление восстановлено",
                        )
                      }
                    >
                      Восстановить
                    </Button>
                    <IconButton
                      icon="trash"
                      size="small"
                      label={`Удалить навсегда: ${direction.name}`}
                      onClick={() => {
                        const impact = directionDeletionImpact(
                          data,
                          direction.id,
                        );
                        setModal({
                          kind: "confirm",
                          title: "Удалить направление навсегда?",
                          message:
                            `Действие необратимо и изменит историю. Будут удалены направление, ${impact.months} мес. планов, ${impact.weeks} нед. планов и ${impact.completions} записей прогресса вместе с приостановками и корректировками.`,
                          confirmLabel: "Удалить навсегда",
                          tone: "danger",
                          onConfirm: () =>
                            update(
                              (current) =>
                                deleteDirection(current, direction.id),
                              "Направление удалено навсегда",
                            ),
                        });
                      }}
                    />
                  </>
                ) : (
                  <>
                    <button
                      className="text-link"
                      onClick={() =>
                        setModal({ kind: "direction", direction })
                      }
                    >
                      Изменить
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        update(
                          (current) =>
                            archiveDirection(current, direction.id),
                          "Направление архивировано",
                        )
                      }
                    >
                      Архивировать
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <EmptyState
            icon={query ? "search" : "directions"}
            title={query ? "Ничего не найдено" : view === "archive" ? "Архив пуст" : "Начните с направления"}
            text={
              query
                ? "Направления не найдены"
                : view === "archive"
                  ? "Архивных направлений нет"
                  : "Нет направлений"
            }
            action={view === "archive" ? "К активным" : "Создать направление"}
            onAction={() => {
              if (view === "archive") {
                setView("active");
                setQuery("");
              } else {
                setModal({ kind: "direction" });
              }
            }}
          />
        )}
      </section>
    </>
  );
}

export function DirectionDetailsPage({
  data,
  id,
  setModal,
}: {
  data: PlannerData;
  id: string;
  setModal: (modal: ModalState) => void;
}) {
  const [progressMode, setProgressMode] = useState<"actual" | "original">(
    "actual",
  );
  const direction = data.directions.find((item) => item.id === id);
  if (!direction) {
    return (
      <EmptyState
        icon="directions"
        title="Направление не найдено"
        text="Направление не найдено"
        action="К списку"
        onAction={() => navigate({ page: "directions" })}
      />
    );
  }
  const periods = data.months.flatMap((month) => {
    const item = month.items.find((plan) => plan.directionId === id);
    if (!item) return [];
    const fact = itemFact(data, item);
    return [{
      month,
      item,
      fact,
      pct: itemProgress(fact, item, progressMode),
    }];
  });
  const currentMonthId = iso(new Date()).slice(0, 7);
  const completedPeriods = periods.filter(
    ({ month }) => month.id < currentMonthId,
  );

  return (
    <>
      <PageHeader
        title={direction.name}
        eyebrow="Направление"
        back={() => {
          const returnPath = window.sessionStorage.getItem(
            "cadence:directions:return",
          );
          navigate({ page: "directions" });
          if (returnPath?.startsWith("/directions")) {
            window.history.replaceState({}, "", returnPath);
          }
        }}
        meta={
          <>
            <Badge
              tone={
                direction.availability === "active"
                    ? "green"
                    : direction.availability === "paused"
                      ? "amber"
                      : "neutral"
              }
            >
              {direction.availability === "active"
                ? "Активно"
                : direction.availability === "paused"
                  ? "Приостановлено"
                  : "Архив"}
            </Badge>
            <span>
              {metricName[direction.metric]}
              {direction.unit && ` · ${direction.unit}`}
            </span>
          </>
        }
        actions={
          <Button
            icon="edit"
            variant="secondary"
            onClick={() => setModal({ kind: "direction", direction })}
          >
            Изменить
          </Button>
        }
      />
      {direction.description && (
        <section className="card direction-description">
          <h2>Описание</h2>
          <p>{direction.description}</p>
        </section>
      )}
      <div className="stats-grid">
        <div className="stat-card card">
          <span>Завершённых периодов</span><strong>{completedPeriods.length}</strong>
        </div>
        <div className="stat-card card">
          <span>Выполнено</span>
          <strong>{completedPeriods.filter((item) => item.pct >= 100).length}</strong>
        </div>
        <div className="stat-card card">
          <span>Приостановок</span>
          <strong>
            {completedPeriods.filter((item) => item.item.paused).length}
          </strong>
        </div>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Планы по месяцам</h2>
          <div className="range-switcher" aria-label="Основа расчёта">
            <button
              className={progressMode === "actual" ? "active" : ""}
              onClick={() => setProgressMode("actual")}
            >
              По актуальному плану
            </button>
            <button
              className={progressMode === "original" ? "active" : ""}
              onClick={() => setProgressMode("original")}
            >
              По первоначальному плану
            </button>
          </div>
        </div>
        {periods.length ? (
          <div className="analytics-list">
            {periods.map(({ month, item, fact, pct }) => (
              <button
                key={month.id}
                onClick={() => navigate({ page: "month", id: month.id })}
              >
                <strong>{monthName(month.id)}</strong>
                <ProgressBar value={pct} color={direction.color} />
                <span>
                  {formatValue(fact, item.metric, item.unit)} /{" "}
                  {formatValue(
                    progressMode === "actual"
                      ? item.target
                      : item.originalTarget,
                    item.metric,
                    item.unit,
                  )}
                </span>
                <strong>{pct}%</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="compact-empty">Нет аналитики</p>
        )}
      </section>
      <section className="card">
        <div className="section-head"><h2>История метрики</h2></div>
        <div className="history-list">
          {direction.metricHistory.map((entry, index) => (
            <div key={`${entry.since}-${index}`}>
              <span>{monthName(entry.since)}</span>
              <strong>
                {metricName[entry.metric]}
                {entry.unit && ` · ${entry.unit}`}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
