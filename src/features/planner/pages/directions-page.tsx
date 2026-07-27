"use client";

import { useEffect, useState } from "react";
import type {
  Direction,
  PlannerData,
} from "@/src/domain/planner/model/types";
import { iso } from "@/src/domain/planner/lib/dates";
import { itemFact, progress } from "@/src/domain/planner/lib/progress";
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

export function DirectionsPage({
  data,
  setModal,
}: {
  data: PlannerData;
  setModal: (modal: ModalState) => void;
}) {
  const [filter, setFilter] = useState<
    "all" | Direction["availability"] | "in-month" | "outside-month" | "trash"
  >(() => {
    if (typeof window === "undefined") return "all";
    const value = new URLSearchParams(window.location.search).get("filter");
    if (
      value === "active" ||
      value === "paused" ||
      value === "archived" ||
      value === "in-month" ||
      value === "outside-month" ||
      value === "trash"
    ) {
      return value;
    }
    return "all";
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
    if (filter !== "all") params.set("filter", filter);
    else params.delete("filter");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [query, filter]);
  const month = data.months.find(
    (item) => item.id === iso(new Date()).slice(0, 7),
  );
  const filtered = data.directions
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => {
      if (filter === "trash") return Boolean(item.deletedAt);
      if (item.deletedAt) return false;
      if (filter === "all") return true;
      if (filter === "in-month") {
        return month?.items.some((plan) => plan.directionId === item.id);
      }
      if (filter === "outside-month") {
        return !month?.items.some((plan) => plan.directionId === item.id);
      }
      return item.availability === filter;
    })
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
      <div className="filter-bar">
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
        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as typeof filter)
          }
        >
          <option value="all">Все направления</option>
          <option value="active">Активные</option>
          <option value="paused">Приостановленные</option>
          <option value="archived">Архивные</option>
          <option value="in-month">В текущем месяце</option>
          <option value="outside-month">Не в текущем месяце</option>
          <option value="trash">Корзина</option>
        </select>
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
                    direction.deletedAt
                      ? "red"
                      : direction.availability === "active"
                      ? "green"
                      : direction.availability === "paused"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {direction.deletedAt
                    ? "Корзина"
                    : direction.availability === "active"
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
                    value={progress(fact, item.target, item.metric)}
                    color={direction.color}
                  />
                )}
              </div>
              <IconButton
                icon="more"
                className="more-button"
                onClick={() => setModal({ kind: "direction", direction })}
                label={`Действия: ${direction.name}`}
              />
            </div>
          );
        })}
        {!filtered.length && (
          <EmptyState
            icon={query || filter !== "all" ? "search" : "directions"}
            title={query || filter !== "all" ? "Ничего не найдено" : "Начните с направления"}
            text={
              query || filter !== "all"
                ? "Направления не найдены"
                : "Нет направлений"
            }
            action={filter === "trash" ? "Показать направления" : "Создать направление"}
            onAction={() => {
              if (filter === "trash") {
                setFilter("all");
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
      pct: progress(fact, item.target, item.metric),
    }];
  });

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
                direction.deletedAt
                  ? "red"
                  : direction.availability === "active"
                    ? "green"
                    : direction.availability === "paused"
                      ? "amber"
                      : "neutral"
              }
            >
              {direction.deletedAt
                ? "Корзина"
                : direction.availability === "active"
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
      <div className="stats-grid">
        <div className="stat-card card">
          <span>Периодов с планом</span><strong>{periods.length}</strong>
        </div>
        <div className="stat-card card">
          <span>Выполнено</span>
          <strong>{periods.filter((item) => item.pct >= 100).length}</strong>
        </div>
        <div className="stat-card card">
          <span>Приостановок</span>
          <strong>
            {periods.filter((item) => item.item.paused).length}
          </strong>
        </div>
      </div>
      <section className="card">
        <div className="section-head"><h2>Планы по месяцам</h2></div>
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
                  {formatValue(item.target, item.metric, item.unit)}
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
