"use client";

import { useState } from "react";
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

export function SchedulePage({
  data,
  update,
  setModal,
}: {
  data: PlannerData;
  update: PlannerUpdate;
  setModal: (modal: ModalState) => void;
}) {
  const [mode, setMode] = useState<"calendar" | "types">("calendar");
  const [range, setRange] = useState<14 | 21 | 30>(
    data.settings.scheduleRange,
  );
  const [selected, setSelected] = useState<string[]>([]);
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
        actions={
          <Button
            onClick={() =>
              setModal(
                !data.activityTypes.length || mode === "types"
                  ? { kind: "activity" }
                  : {
                      kind: "day",
                      date: selected[0] ?? iso(new Date()),
                    },
              )
            }
          >
            {!data.activityTypes.length || mode === "types"
              ? "Новый тип"
              : "Изменить день"}
          </Button>
        }
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
          <div className="schedule-toolbar">
            <div className="range-switcher">
              {[14, 21, 30].map((value) => (
                <button
                  key={value}
                  className={range === value ? "active" : ""}
                  onClick={() => setRange(value as 14 | 21 | 30)}
                >
                  {value} дней
                </button>
              ))}
            </div>
            <div className="tool-actions">
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
                Копировать
              </button>
              <button disabled={!copied || !selected.length} onClick={paste}>
                Вставить
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
                Очистить
              </button>
            </div>
          </div>
          <section className="calendar-grid">
            {visibleDays.map((day) => {
              const isSelected = selected.includes(day.date);
              return (
                <button
                  key={day.date}
                  className={`calendar-day card ${isSelected ? "selected" : ""} ${day.date === iso(new Date()) ? "today" : ""}`}
                  onClick={(event) => {
                    if (event.shiftKey) {
                      setSelected((current) =>
                        isSelected
                          ? current.filter((date) => date !== day.date)
                          : [...current, day.date],
                      );
                    } else {
                      setSelected([day.date]);
                    }
                  }}
                  onDoubleClick={() =>
                    setModal({ kind: "day", date: day.date })
                  }
                >
                  <div>
                    <span>
                      {dateLabel(day.date, { weekday: "short" })}
                    </span>
                    <strong>{parseDate(day.date).getDate()}</strong>
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
        <section className="card type-list">
          {[...data.activityTypes]
            .sort((a, b) => a.order - b.order)
            .map((activity) => (
              <div key={activity.id}>
                <span
                  className="type-swatch"
                  style={{ background: activity.color }}
                />
                <div>
                  <strong>{activity.name}</strong>
                  <span>{activity.archived ? "Архивный" : "Активный"}</span>
                </div>
                <button
                  className="text-link"
                  onClick={() => setModal({ kind: "activity", activity })}
                >
                  Изменить
                </button>
              </div>
            ))}
          {!data.activityTypes.length && (
            <EmptyState
              text="Нет типов деятельности"
              action="Создать тип"
              onAction={() => setModal({ kind: "activity" })}
            />
          )}
        </section>
      )}
    </>
  );
}
