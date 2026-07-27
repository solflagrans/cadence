"use client";

import { useEffect, useState } from "react";
import type {
  DayPlan,
  PlannerData,
} from "@/src/domain/planner/model/types";
import {
  addDays,
  iso,
  parseDate,
  startOfWeek,
} from "@/src/domain/planner/lib/dates";
import { dateLabel } from "@/app/lib/data";
import type { PlannerUpdate } from "@/src/application/planner/planner-provider";
import { Button } from "@/src/shared/ui/button/button";
import { EmptyState } from "@/src/shared/ui/empty-state/empty-state";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import { SegmentedBar } from "@/src/widgets/schedule/segmented-bar";
import type { ModalState } from "../model/modal-state";
import { Icon } from "@/src/shared/ui/icon/icon";

export function SchedulePage({
  data,
  update,
  setModal,
}: {
  data: PlannerData;
  update: PlannerUpdate;
  setModal: (modal: ModalState) => void;
}) {
  const [mode, setMode] = useState<"calendar" | "types">(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("view") === "types"
      ? "types"
      : "calendar",
  );
  const [range, setRange] = useState<14 | 21 | 30>(
    () => {
      if (typeof window === "undefined") return data.settings.scheduleRange;
      const value = Number(
        new URLSearchParams(window.location.search).get("range"),
      );
      return value === 14 || value === 21 || value === 30
        ? value
        : data.settings.scheduleRange;
    },
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [copied, setCopied] = useState<DayPlan["segments"] | null>(null);
  const start = startOfWeek(new Date());
  const visibleDays = Array.from({ length: range }, (_, index) => {
    const date = iso(addDays(start, index));
    return data.days.find((item) => item.date === date) ?? {
      date,
      segments: [],
      breaks: [],
    };
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (mode === "types") params.set("view", "types");
    else params.delete("view");
    if (range !== data.settings.scheduleRange) {
      params.set("range", String(range));
    } else {
      params.delete("range");
    }
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [mode, range, data.settings.scheduleRange]);

  const changeRange = (value: 14 | 21 | 30) => {
    setRange(value);
    update((current) => ({
      ...current,
      settings: { ...current.settings, scheduleRange: value },
    }));
  };

  const paste = () => {
    if (!copied || !selected.length) return;
    update((current) => ({
      ...current,
      days: selected.reduce((days, date) => {
        const existing = days.find((item) => item.date === date);
        const segments = copied.map((segment) => ({ ...segment }));
        if (existing) {
          return days.map((item) =>
            item.date === date ? { ...item, segments } : item,
          );
        }
        return [...days, { date, segments, breaks: [] }];
      }, current.days),
    }), "Состав вставлен");
  };

  return (
    <>
      <PageHeader
        title="График"
        eyebrow="Распределение времени"
        description="Настройте состав дней и поддерживайте устойчивый ритм деятельности."
        actions={mode === "calendar" ? (
          <Button
            icon="plus"
            onClick={() =>
              setModal(
                !data.activityTypes.length
                  ? { kind: "activity" }
                  : {
                      kind: "day",
                      date: selected[0] ?? iso(new Date()),
                    },
              )
            }
          >
            {!data.activityTypes.length
              ? "Новый тип"
              : "Изменить день"}
          </Button>
        ) : undefined}
      />
      <div className="tab-bar">
        <button
          className={mode === "calendar" ? "active" : ""}
          onClick={() => setMode("calendar")}
        >
          Календарь
        </button>
        <button
          className={mode === "types" ? "active" : ""}
          onClick={() => setMode("types")}
        >
          Типы деятельности
        </button>
      </div>
      {mode === "calendar" ? (
        <>
          {!!data.activityTypes.length && (
            <div className="schedule-legend" aria-label="Типы деятельности">
              {data.activityTypes
                .filter((item) => !item.archived)
                .sort((a, b) => a.order - b.order)
                .map((activity) => (
                  <span key={activity.id}>
                    <i style={{ background: activity.color }} />
                    {activity.name}
                  </span>
                ))}
            </div>
          )}
          <div className="schedule-toolbar">
            <div className="range-switcher" aria-label="Диапазон графика">
              {[14, 21, 30].map((value) => (
                <button
                  key={value}
                  className={range === value ? "active" : ""}
                  onClick={() => changeRange(value as 14 | 21 | 30)}
                >
                  {value} дней
                </button>
              ))}
            </div>
            <div className="tool-actions">
              <button
                className={selectionMode ? "active" : ""}
                onClick={() => {
                  setSelectionMode((current) => !current);
                  setSelected([]);
                }}
              >
                <Icon name="check" size={15} />
                {selectionMode ? "Готово" : "Выбрать дни"}
              </button>
              {selectionMode && (
                <>
              {selected.length > 0 && (
                <span className="selection-count">
                  Выбрано: {selected.length}
                </span>
              )}
              <button
                disabled={selected.length !== 1}
                onClick={() => {
                  const day = data.days.find(
                    (item) => item.date === selected[0],
                  );
                  if (day) {
                    setCopied(day.segments.map((segment) => ({ ...segment })));
                  }
                }}
              >
                <Icon name="copy" size={15} /> Копировать
              </button>
              <button disabled={!copied || !selected.length} onClick={paste}>
                <Icon name="paste" size={15} /> Вставить
              </button>
              <button
                disabled={!selected.length}
                onClick={() =>
                  update(
                    (current) => ({
                      ...current,
                      days: current.days.map((day) =>
                        selected.includes(day.date)
                          ? { ...day, segments: [] }
                          : day,
                      ),
                    }),
                    "Диапазон очищен",
                  )
                }
              >
                <Icon name="trash" size={15} /> Очистить
              </button>
                </>
              )}
            </div>
          </div>
          <section className="calendar-grid">
            {visibleDays.map((day) => {
              const isSelected = selected.includes(day.date);
              return (
                <button
                  key={day.date}
                  className={`calendar-day card ${isSelected ? "selected" : ""} ${day.date === iso(new Date()) ? "today" : ""}`}
                  onPointerUp={(event) => event.currentTarget.blur()}
                  onClick={() => {
                    if (!selectionMode) {
                      setSelected([day.date]);
                      setModal({ kind: "day", date: day.date });
                      return;
                    }
                    setSelected((current) =>
                      isSelected
                        ? current.filter((date) => date !== day.date)
                        : [...current, day.date],
                    );
                  }}
                >
                  <div>
                    <span>
                      {dateLabel(day.date, { weekday: "short" })}
                    </span>
                    <strong>{parseDate(day.date).getDate()}</strong>
                    {selectionMode && (
                      <i className="day-select-mark">
                        {isSelected && <Icon name="check" size={12} />}
                      </i>
                    )}
                  </div>
                  <SegmentedBar segments={day.segments} data={data} />
                  <div className="calendar-legend">
                    {day.segments.map((segment) => {
                      const type = data.activityTypes.find(
                        (item) => item.id === segment.activityId,
                      );
                      return (
                        <span key={segment.activityId}>
                          <i style={{ background: type?.color }} />
                          {type?.name}
                          <strong>{segment.percent}%</strong>
                        </span>
                      );
                    })}
                    {!day.segments.length && (
                      <span className="muted">Не задано</span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        </>
      ) : (
        <section className="card activity-types-panel">
          <div className="activity-types-head">
            <div>
              <h2>Типы деятельности</h2>
              <p>Категории, из которых складывается состав дня в графике.</p>
            </div>
            <Button
              icon="plus"
              size="small"
              onClick={() => setModal({ kind: "activity" })}
            >
              Создать тип
            </Button>
          </div>
          <div className="type-list">
            {[...data.activityTypes]
              .sort((a, b) => a.order - b.order)
              .map((activity) => (
                <div className="activity-type-row" key={activity.id}>
                  <span
                    className="type-swatch"
                    style={{ background: activity.color }}
                  />
                  <div>
                    <strong>{activity.name}</strong>
                    <span>{activity.archived ? "В архиве" : "Активный тип"}</span>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setModal({ kind: "activity", activity })}
                  >
                    <Icon name="edit" size={15} /> Изменить
                  </button>
                </div>
              ))}
            {!data.activityTypes.length && (
              <EmptyState
                icon="activity"
                title="Пока нет типов деятельности"
                text="Создайте первую категорию, чтобы распределять время между занятиями."
                action="Создать тип"
                onAction={() => setModal({ kind: "activity" })}
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
