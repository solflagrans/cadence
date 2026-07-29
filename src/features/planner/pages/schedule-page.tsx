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
import {
  archiveActivityType,
  deleteActivityType,
  restoreActivityType,
} from "@/src/domain/planner/commands/activity-types";
import { dateLabel } from "@/app/lib/data";
import type { PlannerUpdate } from "@/src/application/planner/planner-provider";
import { Button } from "@/src/shared/ui/button/button";
import { EmptyState } from "@/src/shared/ui/empty-state/empty-state";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import { SegmentedBar } from "@/src/widgets/schedule/segmented-bar";
import type { ModalState } from "../model/modal-state";
import { Icon } from "@/src/shared/ui/icon/icon";
import { IconButton } from "@/src/shared/ui/icon-button/icon-button";

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(
    new Date(2026, month, 1),
  ),
);

const rangeTitle = (start: Date, end: Date) => {
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(start);
  }
  const includeStartYear = start.getFullYear() !== end.getFullYear();
  return `${dateLabel(iso(start), {
    day: "numeric",
    month: "short",
    ...(includeStartYear ? { year: "numeric" } : {}),
  })} — ${dateLabel(iso(end), {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};

export function SchedulePage({
  data,
  update,
  setModal,
  editingDate,
}: {
  data: PlannerData;
  update: PlannerUpdate;
  setModal: (modal: ModalState) => void;
  editingDate?: string;
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
  const [activityView, setActivityView] = useState<"active" | "archive">(
    "active",
  );
  const [anchor, setAnchor] = useState(() => {
    if (typeof window === "undefined") return new Date();
    const value = new URLSearchParams(window.location.search).get("date");
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseDate(value)
      : new Date();
  });
  const activeActivityTypes = data.activityTypes.filter(
    (activity) => !activity.archived,
  );
  const start = startOfWeek(anchor);
  const end = addDays(start, range - 1);
  const years = Array.from(
    { length: 41 },
    (_, index) => new Date().getFullYear() - 20 + index,
  );
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
    const today = iso(new Date());
    if (iso(anchor) !== today) params.set("date", iso(anchor));
    else params.delete("date");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [mode, range, anchor, data.settings.scheduleRange]);

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
                !activeActivityTypes.length
                  ? { kind: "activity" }
                    : {
                      kind: "day",
                      date: iso(anchor),
                    },
              )
            }
          >
            {!activeActivityTypes.length
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
          <div className="schedule-period-nav">
            <div className="schedule-period-title">
              <IconButton
                icon="chevron-left"
                label="Предыдущий период"
                onClick={() => setAnchor((value) => addDays(value, -range))}
              />
              <strong>{rangeTitle(start, end)}</strong>
              <IconButton
                icon="chevron-right"
                label="Следующий период"
                onClick={() => setAnchor((value) => addDays(value, range))}
              />
            </div>
            <div className="schedule-date-jump">
              <select
                aria-label="Месяц графика"
                value={anchor.getMonth()}
                onChange={(event) =>
                  setAnchor(
                    new Date(
                      anchor.getFullYear(),
                      Number(event.target.value),
                      1,
                    ),
                  )
                }
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                aria-label="Год графика"
                value={anchor.getFullYear()}
                onChange={(event) =>
                  setAnchor(
                    new Date(
                      Number(event.target.value),
                      anchor.getMonth(),
                      1,
                    ),
                  )
                }
              >
                {years.map((year) => <option key={year}>{year}</option>)}
              </select>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setAnchor(new Date())}
              >
                Сегодня
              </Button>
            </div>
          </div>
          {!!activeActivityTypes.length && (
            <div className="schedule-legend" aria-label="Типы деятельности">
              {activeActivityTypes
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
              const isEditing = editingDate === day.date;
              return (
                <button
                  key={day.date}
                  className={`calendar-day card ${isSelected ? "selected" : ""} ${isEditing ? "editing" : ""} ${day.date === iso(new Date()) ? "today" : ""}`}
                  onPointerUp={(event) => event.currentTarget.blur()}
                  onClick={() => {
                    if (!selectionMode) {
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
                    {day.segments.slice(0, 2).map((segment) => {
                      const type = data.activityTypes.find(
                        (item) => item.id === segment.activityId,
                      );
                      return (
                        <span key={segment.activityId}>
                          <i style={{ background: type?.color }} />
                          <span
                            className="calendar-activity-name"
                            title={type?.name}
                          >
                            {type?.name}
                          </span>
                          <strong>{segment.percent}%</strong>
                        </span>
                      );
                    })}
                    {!day.segments.length && (
                      <span className="muted">Не задано</span>
                    )}
                    {day.segments.length > 2 && (
                      <span className="calendar-hidden-count">
                        +{day.segments.length - 2}
                      </span>
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
            <h2>Типы деятельности</h2>
            <Button
              icon="plus"
              size="small"
              onClick={() => setModal({ kind: "activity" })}
            >
              Создать тип
            </Button>
          </div>
          <div className="activity-view-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activityView === "active"}
              className={activityView === "active" ? "active" : ""}
              onClick={() => setActivityView("active")}
            >
              Активные
            </button>
            <button
              role="tab"
              aria-selected={activityView === "archive"}
              className={activityView === "archive" ? "active" : ""}
              onClick={() => setActivityView("archive")}
            >
              Архив
            </button>
          </div>
          <div className="type-list">
            {[...data.activityTypes]
              .filter((activity) =>
                activityView === "archive"
                  ? activity.archived
                  : !activity.archived,
              )
              .sort((a, b) => a.order - b.order)
              .map((activity) => (
                <div className="activity-type-row" key={activity.id}>
                  <span
                    className="type-swatch"
                    style={{ background: activity.color }}
                  />
                  <div>
                    <strong>{activity.name}</strong>
                  </div>
                  <div className="activity-type-actions">
                    {activity.archived ? (
                      <>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() =>
                            update(
                              (current) =>
                                restoreActivityType(current, activity.id),
                              "Тип восстановлен",
                            )
                          }
                        >
                          Восстановить
                        </Button>
                        <IconButton
                          icon="trash"
                          size="small"
                          label={`Удалить навсегда: ${activity.name}`}
                          onClick={() =>
                            setModal({
                              kind: "confirm",
                              title: "Удалить тип деятельности навсегда?",
                              message:
                                "Действие необратимо. Тип будет удалён из всех дней графика, включая историю. Распределение оставшихся типов будет пересчитано до 100%.",
                              confirmLabel: "Удалить навсегда",
                              tone: "danger",
                              onConfirm: () =>
                                update(
                                  (current) =>
                                    deleteActivityType(current, activity.id),
                                  "Тип удалён навсегда",
                                ),
                            })
                          }
                        />
                      </>
                    ) : (
                      <>
                        <button
                          className="text-link"
                          onClick={() =>
                            setModal({ kind: "activity", activity })
                          }
                        >
                          Изменить
                        </button>
                        <button
                          className="text-link"
                          onClick={() =>
                            update(
                              (current) =>
                                archiveActivityType(current, activity.id),
                              "Тип перемещён в архив",
                            )
                          }
                        >
                          В архив
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            {!data.activityTypes.some((activity) =>
              activityView === "archive"
                ? activity.archived
                : !activity.archived,
            ) && (
              <EmptyState
                icon="activity"
                title={activityView === "archive" ? "Архив пуст" : "Пока нет типов деятельности"}
                text={activityView === "archive" ? "Архивных типов нет" : "Создайте первый тип деятельности"}
                action={activityView === "archive" ? "К активным" : "Создать тип"}
                onAction={() =>
                  activityView === "archive"
                    ? setActivityView("active")
                    : setModal({ kind: "activity" })
                }
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
