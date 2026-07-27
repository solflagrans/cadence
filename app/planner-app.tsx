"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ActivityType,
  DayPlan,
  Direction,
  MetricType,
  MonthPlan,
  PlanItem,
  PlannerData,
  Route,
  WeekPlan,
} from "./lib/types";
import {
  addDays,
  createInitialData,
  dateLabel,
  formatValue,
  iso,
  itemFact,
  metricName,
  monthIdForWeek,
  monthName,
  parseDate,
  progress,
  startOfWeek,
  uid,
  weekIdFor,
  weekLabel,
} from "./lib/data";
import {
  downloadPlannerBackup,
  isPlannerData,
  storageRepository,
} from "./lib/storage";

type SaveStatus = "saving" | "saved" | "error";

const NAV: { page: Route["page"]; label: string; short: string }[] = [
  { page: "overview", label: "Обзор", short: "Обзор" },
  { page: "today", label: "Сегодня", short: "Сегодня" },
  { page: "plans", label: "Планы", short: "Планы" },
  { page: "schedule", label: "График", short: "График" },
  { page: "directions", label: "Направления", short: "Цели" },
  { page: "settings", label: "Настройки", short: "Ещё" },
];

type ModalState =
  | { kind: "direction"; direction?: Direction }
  | { kind: "activity"; activity?: ActivityType }
  | { kind: "day"; date: string }
  | { kind: "work"; date: string }
  | { kind: "fact"; weekId: string; directionId?: string }
  | { kind: "extra"; weekId: string }
  | { kind: "month-plan"; monthId: string }
  | { kind: "week-plan"; weekId: string }
  | { kind: "edit-item"; scope: "month" | "week"; planId: string; itemId: string }
  | { kind: "pause"; scope: "month" | "week"; planId: string; itemId: string }
  | { kind: "details"; scope: "month" | "week"; planId: string; itemId: string }
  | { kind: "confirm-reset" }
  | null;

const routeFromHash = (): Route => {
  if (typeof window === "undefined") return { page: "overview" };
  const [page = "overview", id] = window.location.hash.replace(/^#\/?/, "").split("/");
  if (page === "month" && id) return { page: "month", id };
  if (page === "week" && id) return { page: "week", id };
  if (page === "direction" && id) return { page: "direction", id };
  if (["overview", "today", "plans", "schedule", "directions", "settings"].includes(page)) {
    return { page } as Route;
  }
  return { page: "overview" };
};

function navigate(route: Route) {
  const hash =
    "id" in route ? `#/${route.page}/${route.id}` : `#/${route.page}`;
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash;
  }
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant}`} {...props}>
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "blue" | "amber" | "red";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = {
    saving: "Сохранение…",
    saved: "Сохранено",
    error: "Ошибка сохранения",
  }[status];

  return (
    <span className={`save-indicator save-indicator-${status}`} role="status" aria-live="polite">
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function SegmentedBar({
  segments,
  data,
  compact = false,
}: {
  segments: DayPlan["segments"];
  data: PlannerData;
  compact?: boolean;
}) {
  return (
    <div className={`segment-bar ${compact ? "segment-bar-compact" : ""}`}>
      {segments.map((segment, index) => {
        const activity = data.activityTypes.find((item) => item.id === segment.activityId);
        return (
          <span
            key={`${segment.activityId}-${index}`}
            style={{ width: `${segment.percent}%`, background: activity?.color ?? "#d6d3cc" }}
            title={`${activity?.name ?? "Без типа"} — ${segment.percent}%`}
          />
        );
      })}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track" aria-label={`Выполнено ${value}%`}>
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function EmptyState({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">○</span>
      <p>{text}</p>
      <Button onClick={onAction}>{action}</Button>
    </div>
  );
}

function PageHeader({
  title,
  meta,
  actions,
  back,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: () => void;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {back && <button className="back-button" onClick={back} aria-label="Назад">←</button>}
        <div>
          <h1>{title}</h1>
          {meta && <div className="page-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function PlanRows({
  data,
  items,
  scope,
  planId,
  weekId,
  setModal,
}: {
  data: PlannerData;
  items: PlanItem[];
  scope: "month" | "week";
  planId: string;
  weekId?: string;
  setModal: (modal: ModalState) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="plan-list">
      {items.map((item) => {
        const direction = data.directions.find((entry) => entry.id === item.directionId);
        if (!direction) return null;
        const fact = itemFact(data, item, weekId);
        const percent = progress(fact, item.target, item.metric);
        return (
          <article className="plan-row" key={item.id}>
            <button
              className="row-main"
              onClick={() => setModal({ kind: "details", scope, planId, itemId: item.id })}
            >
              <span className="direction-dot" style={{ background: direction.color }} />
              <span className="row-copy">
                <span className="row-title-line">
                  <strong>{direction.name}</strong>
                  {item.paused && <Badge tone="amber">{item.paused.reason}</Badge>}
                </span>
                <span className="row-progress">
                  <ProgressBar value={percent} color={direction.color} />
                </span>
              </span>
              <span className="row-value">
                <strong>{formatValue(fact, item.metric, item.unit)}</strong>
                <span>из {formatValue(item.target, item.metric, item.unit)}</span>
              </span>
            </button>
            <div className="row-actions">
              {scope === "week" && (
                <button
                  className="small-action"
                  onClick={() => setModal({ kind: "fact", weekId: planId, directionId: item.directionId })}
                >
                  + Факт
                </button>
              )}
              <button
                className="more-button"
                onClick={() => setModal({ kind: "edit-item", scope, planId, itemId: item.id })}
                aria-label={`Изменить ${direction.name}`}
              >
                ···
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function PlannerApp() {
  const [data, setData] = useState<PlannerData>(() => storageRepository.getCachedState());
  const [route, setRoute] = useState<Route>({ page: "overview" });
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const hydrated = useRef(false);
  const changedDuringLoad = useRef(false);
  const skipNextSave = useRef(false);
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const sync = () => setRoute(routeFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storageRepository.load().then((result) => {
      if (cancelled) return;

      hydrated.current = true;
      // A failed initial read still leaves a valid local backup available.
      // Reserve the error indicator for an actual failed save attempt.
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
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const revision = ++saveRevision.current;
    const snapshot = data;
    storageRepository.cache(snapshot);
    setSaveStatus("saving");

    const timer = window.setTimeout(() => {
      const operation = saveQueue.current
        .catch(() => undefined)
        .then(() => storageRepository.save(snapshot));
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

  const update = (recipe: (current: PlannerData) => PlannerData, message?: string) => {
    if (!hydrated.current) changedDuringLoad.current = true;
    setData((current) => recipe(current));
    if (message) setToast(message);
  };

  const title = NAV.find((entry) => entry.page === route.page)?.label ?? "Cadence";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate({ page: "overview" })}>
          <span className="brand-mark">C</span>
          <span>Cadence</span>
        </button>
        <nav className="sidebar-nav" aria-label="Основная навигация">
          {NAV.map((item, index) => (
            <button
              key={item.page}
              className={
                route.page === item.page ||
                (item.page === "plans" && ["month", "week"].includes(route.page)) ||
                (item.page === "directions" && route.page === "direction")
                  ? "active"
                  : ""
              }
              onClick={() => navigate({ page: item.page } as Route)}
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-status"><SaveIndicator status={saveStatus} /></div>
        <div className="sidebar-foot">
          <span className="avatar">Г</span>
          <div><strong>Гость</strong><span>Синхронизация включена</span></div>
        </div>
      </aside>

      <div className="mobile-topbar">
        <button className="brand" onClick={() => navigate({ page: "overview" })}>
          <span className="brand-mark">C</span><span>Cadence</span>
        </button>
        <div className="mobile-meta"><span>{title}</span><SaveIndicator status={saveStatus} /></div>
      </div>

      <main className="content">
        {route.page === "overview" && <Overview data={data} setModal={setModal} />}
        {route.page === "today" && <Today data={data} setModal={setModal} />}
        {route.page === "plans" && <Plans data={data} />}
        {route.page === "month" && (
          <MonthPage data={data} monthId={route.id} setModal={setModal} />
        )}
        {route.page === "week" && (
          <WeekPage data={data} weekId={route.id} setModal={setModal} />
        )}
        {route.page === "schedule" && (
          <Schedule data={data} update={update} setModal={setModal} />
        )}
        {route.page === "directions" && (
          <Directions data={data} setModal={setModal} />
        )}
        {route.page === "direction" && (
          <DirectionPage data={data} id={route.id} setModal={setModal} />
        )}
        {route.page === "settings" && (
          <Settings data={data} update={update} setModal={setModal} />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Основная навигация">
        {NAV.map((item) => (
          <button
            key={item.page}
            className={
              route.page === item.page ||
              (item.page === "plans" && ["month", "week"].includes(route.page)) ||
              (item.page === "directions" && route.page === "direction")
                ? "active"
                : ""
            }
            onClick={() => navigate({ page: item.page } as Route)}
          >
            <span>{item.short}</span>
          </button>
        ))}
      </nav>

      {modal && (
        <ModalHost
          modal={modal}
          data={data}
          close={() => setModal(null)}
          update={update}
          setModal={setModal}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Overview({ data, setModal }: { data: PlannerData; setModal: (m: ModalState) => void }) {
  const today = new Date();
  const currentDate = iso(today);
  const weekId = weekIdFor(today);
  const monthId = currentDate.slice(0, 7);
  const week = data.weeks.find((item) => item.id === weekId);
  const month = data.months.find((item) => item.id === monthId);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = iso(addDays(startOfWeek(today), index));
    return data.days.find((day) => day.date === date) ?? { date, segments: [], breaks: [] };
  });
  const [selected, setSelected] = useState(currentDate);
  const selectedDay = days.find((day) => day.date === selected) ?? days[0];
  const attention = [
    !month && { text: "Текущий месяц не запланирован", action: () => navigate({ page: "month", id: monthId }) },
    !week && { text: "Текущая неделя не запланирована", action: () => navigate({ page: "week", id: weekId }) },
    selectedDay?.segments.some((segment) => segment.activityId === "projects") &&
      !selectedDay.workStart && { text: "Не указан рабочий период", action: () => setModal({ kind: "work", date: selectedDay.date }) },
  ].filter(Boolean) as { text: string; action: () => void }[];

  return (
    <>
      <PageHeader
        title="Обзор"
        meta={<span>{dateLabel(currentDate, { weekday: "long", day: "numeric", month: "long" })}</span>}
        actions={<Button onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>}
      />
      {attention.length > 0 && (
        <section className="attention-strip">
          <strong>Требуется внимание</strong>
          <div>
            {attention.map((item) => (
              <button key={item.text} onClick={item.action}>{item.text}<span>→</span></button>
            ))}
          </div>
        </section>
      )}
      <section className="card schedule-card">
        <div className="section-head">
          <h2>Рабочий график</h2>
          <button className="text-link" onClick={() => navigate({ page: "schedule" })}>Открыть график →</button>
        </div>
        <div className="week-strip">
          {days.map((day) => (
            <button
              key={day.date}
              className={`${day.date === selected ? "selected" : ""} ${day.date === currentDate ? "today" : ""}`}
              onClick={() => setSelected(day.date)}
            >
              <span>{dateLabel(day.date, { weekday: "short" })}</span>
              <strong>{parseDate(day.date).getDate()}</strong>
              <SegmentedBar segments={day.segments} data={data} compact />
            </button>
          ))}
        </div>
        {selectedDay && <DaySummary day={selectedDay} data={data} onEdit={() => setModal({ kind: "day", date: selectedDay.date })} />}
      </section>
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-head">
            <div><span className="eyebrow">Текущий месяц</span><h2>{monthName(monthId)}</h2></div>
            <button className="text-link" onClick={() => navigate({ page: "month", id: monthId })}>Открыть →</button>
          </div>
          {month ? (
            <>
              <PlanRows data={data} items={month.items.slice(0, 5)} scope="month" planId={month.id} setModal={setModal} />
              <PlanSummary data={data} month={month} />
            </>
          ) : (
            <EmptyState text="На этот месяц пока нет плана" action="Запланировать месяц" onAction={() => setModal({ kind: "month-plan", monthId })} />
          )}
        </section>
        <section className="card">
          <div className="section-head">
            <div><span className="eyebrow">Текущая неделя</span><h2>{weekLabel(weekId)}</h2></div>
            <button className="text-link" onClick={() => navigate({ page: "week", id: weekId })}>Открыть →</button>
          </div>
          {week ? (
            <>
              <PlanRows data={data} items={week.items} scope="week" planId={week.id} weekId={week.id} setModal={setModal} />
              <div className="inline-actions">
                <Button variant="secondary" onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>
                <Button variant="ghost" onClick={() => setModal({ kind: "extra", weekId })}>Добавить результат</Button>
              </div>
            </>
          ) : (
            <EmptyState text="Эта неделя ещё не запланирована" action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
          )}
        </section>
      </div>
    </>
  );
}

function DaySummary({ day, data, onEdit }: { day: DayPlan; data: PlannerData; onEdit: () => void }) {
  const minutes = workMinutes(day);
  return (
    <div className="day-summary">
      <div>
        <strong>{dateLabel(day.date, { weekday: "long", day: "numeric", month: "long" })}</strong>
        <span>
          {day.segments.map((segment) => {
            const type = data.activityTypes.find((item) => item.id === segment.activityId);
            return `${type?.name ?? "Без типа"} ${segment.percent}%`;
          }).join(" · ") || "Состав не задан"}
        </span>
      </div>
      {day.workStart && day.workEnd && (
        <div className="day-time">
          <strong>{day.workStart}–{day.workEnd}</strong>
          <span>{formatMinutes(minutes.net)}</span>
        </div>
      )}
      <Button variant="ghost" onClick={onEdit}>Изменить</Button>
    </div>
  );
}

function PlanSummary({ data, month }: { data: PlannerData; month: MonthPlan }) {
  const counts = month.items.reduce(
    (acc, item) => {
      if (item.paused) acc.paused += 1;
      else {
        const fact = itemFact(data, item);
        const pct = progress(fact, item.target, item.metric);
        if (pct >= 100) acc.done += 1;
        else if (pct > 0) acc.partial += 1;
        else acc.empty += 1;
      }
      return acc;
    },
    { done: 0, partial: 0, empty: 0, paused: 0 },
  );
  const extras = data.extraResults.filter((item) => monthIdForWeek(item.weekId) === month.id).length;
  return (
    <div className="summary-pills">
      <span><strong>{counts.done}</strong> выполнено</span>
      <span><strong>{counts.partial}</strong> частично</span>
      <span><strong>{counts.empty}</strong> не начато</span>
      {counts.paused > 0 && <span><strong>{counts.paused}</strong> приостановлено</span>}
      <span><strong>{extras}</strong> дополнительных</span>
    </div>
  );
}

function Today({ data, setModal }: { data: PlannerData; setModal: (m: ModalState) => void }) {
  const today = iso(new Date());
  const weekId = weekIdFor(new Date());
  const day = data.days.find((item) => item.date === today) ?? { date: today, segments: [], breaks: [] };
  const week = data.weeks.find((item) => item.id === weekId);
  const minutes = workMinutes(day);
  return (
    <>
      <PageHeader
        title="Сегодня"
        meta={dateLabel(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<Button variant="secondary" onClick={() => setModal({ kind: "day", date: today })}>Изменить состав дня</Button>}
      />
      <section className="today-hero card">
        <SegmentedBar segments={day.segments} data={data} />
        <div className="today-composition">
          {day.segments.map((segment) => {
            const activity = data.activityTypes.find((item) => item.id === segment.activityId);
            return (
              <div key={segment.activityId}>
                <span className="legend-dot" style={{ background: activity?.color }} />
                <span>{activity?.name}</span>
                <strong>{segment.percent}%</strong>
              </div>
            );
          })}
        </div>
      </section>
      <div className="dashboard-grid today-grid">
        <section className="card">
          <div className="section-head">
            <h2>Рабочий период</h2>
            <button className="text-link" onClick={() => setModal({ kind: "work", date: today })}>
              {day.workStart ? "Изменить" : "Добавить"}
            </button>
          </div>
          {day.workStart && day.workEnd ? (
            <>
              <div className="time-range">
                <strong>{day.workStart}</strong><span>—</span><strong>{day.workEnd}</strong>
                <Badge tone="blue">{formatMinutes(minutes.total)}</Badge>
              </div>
              <div className="break-list">
                {day.breaks.map((item) => (
                  <div key={item.id}><span>Перерыв</span><strong>{item.start}–{item.end}</strong></div>
                ))}
              </div>
              <div className="time-total">
                <span>Перерывы <strong>{formatMinutes(minutes.breaks)}</strong></span>
                <span>Итого <strong>{formatMinutes(minutes.net)}</strong></span>
              </div>
            </>
          ) : (
            <EmptyState text="Рабочий период не указан" action="Добавить период" onAction={() => setModal({ kind: "work", date: today })} />
          )}
        </section>
        <section className="card">
          <div className="section-head"><h2>План недели</h2><span className="muted">{weekLabel(weekId)}</span></div>
          {week ? (
            <>
              <PlanRows data={data} items={week.items} scope="week" planId={week.id} weekId={week.id} setModal={setModal} />
              <Button variant="secondary" onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>
            </>
          ) : (
            <EmptyState text="Эта неделя ещё не запланирована" action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
          )}
        </section>
      </div>
      <ExtrasBlock data={data} weekId={weekId} setModal={setModal} />
    </>
  );
}

function Plans({ data }: { data: PlannerData }) {
  const [year, setYear] = useState(2026);
  const currentMonth = iso(new Date()).slice(0, 7);
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  return (
    <>
      <PageHeader
        title="Планы"
        actions={
          <div className="year-switcher">
            <button onClick={() => setYear((value) => value - 1)}>←</button>
            <strong>{year}</strong>
            <button onClick={() => setYear((value) => value + 1)}>→</button>
          </div>
        }
      />
      <section className="month-grid">
        {months.map((id) => {
          const month = data.months.find((entry) => entry.id === id);
          const extras = data.extraResults.filter((entry) => monthIdForWeek(entry.weekId) === id).length;
          return (
            <button
              key={id}
              className={`month-card card ${id === currentMonth ? "current" : ""}`}
              onClick={() => navigate({ page: "month", id })}
            >
              <div className="month-card-head">
                <h2>{dateLabel(`${id}-01`, { month: "long" })}</h2>
                {id === currentMonth && <Badge tone="blue">Текущий</Badge>}
              </div>
              {month ? (
                <>
                  <strong className="month-count">{month.items.length}</strong>
                  <span>направлений</span>
                  <PlanSummary data={data} month={month} />
                  {extras > 0 && <span className="month-extra">+{extras} результата</span>}
                </>
              ) : (
                <span className="month-empty">Нет плана</span>
              )}
            </button>
          );
        })}
      </section>
    </>
  );
}

function periodStatus(id: string, type: "month" | "week") {
  const now = iso(new Date());
  if (type === "month") {
    const current = now.slice(0, 7);
    return id === current ? "Текущий" : id > current ? "Будущий" : "Прошедший";
  }
  const end = iso(addDays(parseDate(id), 6));
  return now >= id && now <= end ? "Текущая" : id > now ? "Будущая" : "Прошедшая";
}

function MonthPage({
  data,
  monthId,
  setModal,
}: {
  data: PlannerData;
  monthId: string;
  setModal: (m: ModalState) => void;
}) {
  const month = data.months.find((item) => item.id === monthId);
  const base = parseDate(`${monthId}-01`);
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const first = startOfWeek(addDays(base, index * 7));
    return iso(first);
  }).filter((weekId, index, array) => monthIdForWeek(weekId) === monthId && array.indexOf(weekId) === index);
  const extras = data.extraResults.filter((item) => monthIdForWeek(item.weekId) === monthId);
  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return (
    <>
      <PageHeader
        title={monthName(monthId)}
        back={() => navigate({ page: "plans" })}
        meta={<Badge tone={periodStatus(monthId, "month") === "Текущий" ? "blue" : "neutral"}>{periodStatus(monthId, "month")}</Badge>}
        actions={
          <div className="period-switcher">
            <button onClick={() => navigate({ page: "month", id: iso(prev).slice(0, 7) })}>←</button>
            <button onClick={() => navigate({ page: "month", id: iso(next).slice(0, 7) })}>→</button>
          </div>
        }
      />
      <div className="week-tabs">
        {weeks.map((id) => {
          const exists = data.weeks.some((week) => week.id === id);
          return <button key={id} className={exists ? "planned" : ""} onClick={() => navigate({ page: "week", id })}>{weekLabel(id)}{exists && <i />}</button>;
        })}
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Направления</h2>
          {month && <Button variant="secondary" onClick={() => setModal({ kind: "month-plan", monthId })}>Изменить план</Button>}
        </div>
        {month ? (
          <>
            <PlanRows data={data} items={month.items} scope="month" planId={month.id} setModal={setModal} />
            <PlanSummary data={data} month={month} />
          </>
        ) : (
          <EmptyState text="На этот месяц пока нет плана" action="Запланировать месяц" onAction={() => setModal({ kind: "month-plan", monthId })} />
        )}
      </section>
      <section className="card extras-card">
        <div className="section-head"><h2>Дополнительные результаты</h2><Badge>{extras.length}</Badge></div>
        {extras.length ? (
          <div className="extras-list">
            {extras.map((item) => (
              <div key={item.id}>
                <span className="result-check">✓</span>
                <div><strong>{item.title}</strong><span>{dateLabel(item.date)} · {weekLabel(item.weekId)}</span></div>
                <strong>{formatValue(item.value, item.metric, item.unit)}</strong>
              </div>
            ))}
          </div>
        ) : <p className="compact-empty">Нет дополнительных результатов</p>}
      </section>
    </>
  );
}

function WeekPage({
  data,
  weekId,
  setModal,
}: {
  data: PlannerData;
  weekId: string;
  setModal: (m: ModalState) => void;
}) {
  const week = data.weeks.find((item) => item.id === weekId);
  const monthId = monthIdForWeek(weekId);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = iso(addDays(parseDate(weekId), index));
    return data.days.find((item) => item.date === date) ?? { date, segments: [], breaks: [] };
  });
  return (
    <>
      <PageHeader
        title={weekLabel(weekId)}
        back={() => navigate({ page: "month", id: monthId })}
        meta={<><button className="crumb-link" onClick={() => navigate({ page: "month", id: monthId })}>{monthName(monthId)}</button><Badge tone={periodStatus(weekId, "week") === "Текущая" ? "blue" : "neutral"}>{periodStatus(weekId, "week")}</Badge></>}
        actions={
          <div className="period-switcher">
            <button onClick={() => navigate({ page: "week", id: iso(addDays(parseDate(weekId), -7)) })}>←</button>
            <button onClick={() => navigate({ page: "week", id: iso(addDays(parseDate(weekId), 7)) })}>→</button>
          </div>
        }
      />
      <div className="mini-week card">
        {days.map((day) => <div key={day.date}><span>{dateLabel(day.date, { weekday: "short" })}</span><strong>{parseDate(day.date).getDate()}</strong><SegmentedBar segments={day.segments} data={data} compact /></div>)}
      </div>
      <section className="card">
        <div className="section-head">
          <h2>План недели</h2>
          {week && <Button variant="secondary" onClick={() => setModal({ kind: "week-plan", weekId })}>Изменить план</Button>}
        </div>
        {week ? (
          <>
            <PlanRows data={data} items={week.items} scope="week" planId={week.id} weekId={week.id} setModal={setModal} />
            <div className="inline-actions">
              <Button onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>
              <Button variant="secondary" onClick={() => setModal({ kind: "extra", weekId })}>Добавить результат</Button>
            </div>
          </>
        ) : (
          <EmptyState text="Эта неделя ещё не запланирована" action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
        )}
      </section>
      <ExtrasBlock data={data} weekId={weekId} setModal={setModal} />
    </>
  );
}

function ExtrasBlock({ data, weekId, setModal }: { data: PlannerData; weekId: string; setModal: (m: ModalState) => void }) {
  const extras = data.extraResults.filter((item) => item.weekId === weekId);
  return (
    <section className="card extras-card">
      <div className="section-head"><h2>Дополнительные результаты</h2><Button variant="ghost" onClick={() => setModal({ kind: "extra", weekId })}>+ Добавить результат</Button></div>
      {extras.length ? (
        <div className="extras-list">
          {extras.map((item) => (
            <div key={item.id}><span className="result-check">✓</span><div><strong>{item.title}</strong><span>{dateLabel(item.date)}</span></div><strong>{formatValue(item.value, item.metric, item.unit)}</strong></div>
          ))}
        </div>
      ) : <p className="compact-empty">Нет дополнительных результатов</p>}
    </section>
  );
}

function Schedule({
  data,
  update,
  setModal,
}: {
  data: PlannerData;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  const [mode, setMode] = useState<"calendar" | "types">("calendar");
  const [range, setRange] = useState<14 | 21 | 30>(data.settings.scheduleRange);
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState<DayPlan["segments"] | null>(null);
  const start = startOfWeek(new Date());
  const visibleDays = Array.from({ length: range }, (_, index) => {
    const date = iso(addDays(start, index));
    return data.days.find((item) => item.date === date) ?? { date, segments: [], breaks: [] };
  });
  const paste = () => {
    if (!copied || !selected.length) return;
    update((current) => ({
      ...current,
      days: selected.reduce((days, date) => {
        const existing = days.find((item) => item.date === date);
        if (existing) return days.map((item) => item.date === date ? { ...item, segments: copied.map((segment) => ({ ...segment })) } : item);
        return [...days, { date, segments: copied.map((segment) => ({ ...segment })), breaks: [] }];
      }, current.days),
    }), "Состав вставлен");
  };
  return (
    <>
      <PageHeader
        title="График"
        actions={
          <Button onClick={() => {
            if (!data.activityTypes.length || mode === "types") {
              setModal({ kind: "activity" });
            } else {
              setModal({ kind: "day", date: selected[0] ?? iso(new Date()) });
            }
          }}>
            {!data.activityTypes.length || mode === "types" ? "Новый тип" : "Изменить день"}
          </Button>
        }
      />
      <div className="tab-bar">
        <button className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}>Календарь</button>
        <button className={mode === "types" ? "active" : ""} onClick={() => setMode("types")}>Типы деятельности</button>
      </div>
      {mode === "calendar" ? (
        <>
          <div className="schedule-toolbar">
            <div className="range-switcher">
              {[14, 21, 30].map((value) => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value as 14 | 21 | 30)}>{value} дней</button>)}
            </div>
            <div className="tool-actions">
              <button disabled={selected.length !== 1} onClick={() => {
                const day = data.days.find((item) => item.date === selected[0]);
                if (day) setCopied(day.segments.map((segment) => ({ ...segment })));
              }}>Копировать</button>
              <button disabled={!copied || !selected.length} onClick={paste}>Вставить</button>
              <button disabled={!selected.length} onClick={() => update((current) => ({ ...current, days: current.days.map((day) => selected.includes(day.date) ? { ...day, segments: [] } : day) }), "Диапазон очищен")}>Очистить</button>
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
                    if (event.shiftKey) setSelected((current) => isSelected ? current.filter((date) => date !== day.date) : [...current, day.date]);
                    else setSelected([day.date]);
                  }}
                  onDoubleClick={() => setModal({ kind: "day", date: day.date })}
                >
                  <div><span>{dateLabel(day.date, { weekday: "short" })}</span><strong>{parseDate(day.date).getDate()}</strong></div>
                  <SegmentedBar segments={day.segments} data={data} />
                  <div className="calendar-legend">
                    {day.segments.map((segment) => {
                      const type = data.activityTypes.find((item) => item.id === segment.activityId);
                      return <span key={segment.activityId}><i style={{ background: type?.color }} />{type?.name}<strong>{segment.percent}%</strong></span>;
                    })}
                    {!day.segments.length && <span className="muted">Не задано</span>}
                  </div>
                </button>
              );
            })}
          </section>
        </>
      ) : (
        <section className="card type-list">
          {[...data.activityTypes].sort((a, b) => a.order - b.order).map((activity) => (
            <div key={activity.id}>
              <span className="type-swatch" style={{ background: activity.color }} />
              <div><strong>{activity.name}</strong><span>{activity.archived ? "Архивный" : "Активный"}</span></div>
              <button className="text-link" onClick={() => setModal({ kind: "activity", activity })}>Изменить</button>
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

function Directions({ data, setModal }: { data: PlannerData; setModal: (m: ModalState) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Direction["availability"] | "in-month" | "outside-month">("all");
  const month = data.months.find((item) => item.id === iso(new Date()).slice(0, 7));
  const filtered = data.directions
    .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => {
      if (filter === "all") return true;
      if (filter === "in-month") return month?.items.some((plan) => plan.directionId === item.id);
      if (filter === "outside-month") return !month?.items.some((plan) => plan.directionId === item.id);
      return item.availability === filter;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return (
    <>
      <PageHeader title="Направления" actions={<Button onClick={() => setModal({ kind: "direction" })}>Новое направление</Button>} />
      <div className="filter-bar">
        <input className="search-input" placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">Все направления</option>
          <option value="active">Активные</option>
          <option value="paused">Приостановленные</option>
          <option value="archived">Архивные</option>
          <option value="in-month">В текущем месяце</option>
          <option value="outside-month">Не в текущем месяце</option>
        </select>
      </div>
      <section className="card direction-table">
        <div className="table-head"><span>Направление</span><span>Метрика</span><span>Доступность</span><span>Текущий месяц</span><span /></div>
        {filtered.map((direction) => {
          const item = month?.items.find((plan) => plan.directionId === direction.id);
          const fact = item ? itemFact(data, item) : 0;
          return (
            <div className="table-row" key={direction.id}>
              <button className="direction-name" onClick={() => navigate({ page: "direction", id: direction.id })}>
                <span className="direction-dot" style={{ background: direction.color }} /><strong>{direction.name}</strong>
              </button>
              <span>{metricName[direction.metric]}{direction.unit && ` · ${direction.unit}`}</span>
              <span><Badge tone={direction.availability === "active" ? "green" : direction.availability === "paused" ? "amber" : "neutral"}>{direction.availability === "active" ? "Активно" : direction.availability === "paused" ? "Приостановлено" : "Архив"}</Badge></span>
              <span>{item ? `${formatValue(fact, item.metric, item.unit)} / ${formatValue(item.target, item.metric, item.unit)}` : "—"}</span>
              <button className="more-button" onClick={() => setModal({ kind: "direction", direction })}>···</button>
            </div>
          );
        })}
        {!filtered.length && (
          <EmptyState
            text={query || filter !== "all" ? "Направления не найдены" : "Нет направлений"}
            action="Создать направление"
            onAction={() => setModal({ kind: "direction" })}
          />
        )}
      </section>
    </>
  );
}

function DirectionPage({ data, id, setModal }: { data: PlannerData; id: string; setModal: (m: ModalState) => void }) {
  const direction = data.directions.find((item) => item.id === id);
  if (!direction) return <EmptyState text="Направление не найдено" action="К списку" onAction={() => navigate({ page: "directions" })} />;
  const periods = data.months.flatMap((month) => {
    const item = month.items.find((plan) => plan.directionId === id);
    if (!item) return [];
    const fact = itemFact(data, item);
    return [{ month, item, fact, pct: progress(fact, item.target, item.metric) }];
  });
  return (
    <>
      <PageHeader
        title={direction.name}
        back={() => navigate({ page: "directions" })}
        meta={<><Badge tone={direction.availability === "active" ? "green" : "amber"}>{direction.availability === "active" ? "Активно" : "Приостановлено"}</Badge><span>{metricName[direction.metric]}{direction.unit && ` · ${direction.unit}`}</span></>}
        actions={<Button variant="secondary" onClick={() => setModal({ kind: "direction", direction })}>Изменить</Button>}
      />
      <div className="stats-grid">
        <div className="stat-card card"><span>Периодов с планом</span><strong>{periods.length}</strong></div>
        <div className="stat-card card"><span>Выполнено</span><strong>{periods.filter((item) => item.pct >= 100).length}</strong></div>
        <div className="stat-card card"><span>Приостановок</span><strong>{periods.filter((item) => item.item.paused).length}</strong></div>
      </div>
      <section className="card">
        <div className="section-head"><h2>Планы по месяцам</h2></div>
        {periods.length ? (
          <div className="analytics-list">
            {periods.map(({ month, item, fact, pct }) => (
              <button key={month.id} onClick={() => navigate({ page: "month", id: month.id })}>
                <strong>{monthName(month.id)}</strong>
                <ProgressBar value={pct} color={direction.color} />
                <span>{formatValue(fact, item.metric, item.unit)} / {formatValue(item.target, item.metric, item.unit)}</span>
                <strong>{pct}%</strong>
              </button>
            ))}
          </div>
        ) : <p className="compact-empty">Нет аналитики</p>}
      </section>
      <section className="card">
        <div className="section-head"><h2>История метрики</h2></div>
        <div className="history-list">
          {direction.metricHistory.map((entry, index) => <div key={`${entry.since}-${index}`}><span>{monthName(entry.since)}</span><strong>{metricName[entry.metric]}{entry.unit && ` · ${entry.unit}`}</strong></div>)}
        </div>
      </section>
    </>
  );
}

function Settings({
  data,
  update,
  setModal,
}: {
  data: PlannerData;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const patchSettings = (patch: Partial<PlannerData["settings"]>) =>
    update((current) => ({ ...current, settings: { ...current.settings, ...patch } }), "Настройки сохранены");
  return (
    <>
      <PageHeader title="Настройки" />
      <div className="settings-layout">
        <section className="card settings-section">
          <h2>Аккаунт и синхронизация</h2>
          <div className="setting-row"><div><strong>Гость</strong><span>Облачное пространство</span></div><Button variant="secondary" disabled>Подключить аккаунт</Button></div>
          <div className="setting-row"><div><strong>Облачная синхронизация</strong><span>Cloudflare D1</span></div><span className="switch on disabled"><span /></span></div>
          <div className="setting-row"><div><strong>Выход со всех устройств</strong></div><Button variant="ghost" disabled>Выйти</Button></div>
        </section>
        <section className="card settings-section">
          <h2>Региональные настройки</h2>
          <label className="setting-row"><div><strong>Часовой пояс</strong></div><select value={data.settings.timezone} onChange={(e) => patchSettings({ timezone: e.target.value })}><option>Europe/Moscow</option><option>Europe/Berlin</option><option>Asia/Tbilisi</option></select></label>
          <label className="setting-row"><div><strong>Первый день недели</strong></div><select defaultValue="monday"><option value="monday">Понедельник</option></select></label>
          <label className="setting-row"><div><strong>Формат времени</strong></div><select value={data.settings.timeFormat} onChange={(e) => patchSettings({ timeFormat: e.target.value as "24" | "12" })}><option value="24">24 часа</option><option value="12">12 часов</option></select></label>
        </section>
        <section className="card settings-section">
          <h2>Планирование</h2>
          <label className="setting-row"><div><strong>Диапазон графика</strong></div><select value={data.settings.scheduleRange} onChange={(e) => patchSettings({ scheduleRange: Number(e.target.value) as 14 | 21 | 30 })}><option value="14">14 дней</option><option value="21">21 день</option><option value="30">30 дней</option></select></label>
          <ToggleRow label="Планирование недели" value={data.settings.weekReminder} onChange={(value) => patchSettings({ weekReminder: value })} />
          <ToggleRow label="Планирование месяца" value={data.settings.monthReminder} onChange={(value) => patchSettings({ monthReminder: value })} />
        </section>
        <section className="card settings-section">
          <h2>Внешний вид</h2>
          <label className="setting-row"><div><strong>Тема</strong></div><select value={data.settings.theme} onChange={(e) => patchSettings({ theme: e.target.value as PlannerData["settings"]["theme"] })}><option value="light">Светлая</option><option value="dark">Тёмная</option><option value="system">Системная</option></select></label>
          <label className="setting-row"><div><strong>Плотность</strong></div><select value={data.settings.density} onChange={(e) => patchSettings({ density: e.target.value as "comfortable" | "compact" })}><option value="comfortable">Удобная</option><option value="compact">Компактная</option></select></label>
        </section>
        <section className="card settings-section data-section">
          <h2>Данные</h2>
          <div className="data-actions">
            <Button variant="secondary" onClick={() => downloadPlannerBackup(data)}>Экспортировать</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Импортировать</Button>
            <Button variant="danger" onClick={() => setModal({ kind: "confirm-reset" })}>Удалить данные</Button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const next: unknown = JSON.parse(await file.text());
                  if (!isPlannerData(next)) throw new Error();
                  update(() => next, "Данные импортированы");
                } catch {
                  window.alert("Не удалось импортировать файл");
                }
              }}
            />
          </div>
        </section>
      </div>
    </>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <div className="setting-row"><div><strong>{label}</strong></div><button className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-pressed={value}><span /></button></div>;
}

function ModalHost({
  modal,
  data,
  close,
  update,
  setModal,
}: {
  modal: Exclude<ModalState, null>;
  data: PlannerData;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  if (modal.kind === "direction") return <DirectionForm direction={modal.direction} close={close} update={update} />;
  if (modal.kind === "activity") return <ActivityForm activity={modal.activity} close={close} update={update} />;
  if (modal.kind === "day") return <DayForm data={data} date={modal.date} close={close} update={update} />;
  if (modal.kind === "work") return <WorkForm data={data} date={modal.date} close={close} update={update} />;
  if (modal.kind === "fact") return <FactForm data={data} weekId={modal.weekId} directionId={modal.directionId} close={close} update={update} />;
  if (modal.kind === "extra") return <ExtraForm weekId={modal.weekId} close={close} update={update} />;
  if (modal.kind === "month-plan") return <PlanForm data={data} scope="month" id={modal.monthId} close={close} update={update} />;
  if (modal.kind === "week-plan") return <PlanForm data={data} scope="week" id={modal.weekId} close={close} update={update} />;
  if (modal.kind === "edit-item") return <EditItemForm data={data} {...modal} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "pause") return <PauseForm data={data} {...modal} close={close} update={update} />;
  if (modal.kind === "details") return <Details data={data} {...modal} close={close} />;
  return (
    <Modal title="Удалить данные?" onClose={close}>
      <p className="confirm-copy">Все данные будут удалены из облачного хранилища и локальной резервной копии.</p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={close}>Отмена</Button>
        <Button variant="danger" onClick={() => {
          update(() => createInitialData(), "Данные удалены");
          close();
        }}>Удалить</Button>
      </div>
    </Modal>
  );
}

function DirectionForm({
  direction,
  close,
  update,
}: {
  direction?: Direction;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const [name, setName] = useState(direction?.name ?? "");
  const [metric, setMetric] = useState<MetricType>(direction?.metric ?? "count");
  const [unit, setUnit] = useState(direction?.unit ?? "раз");
  const [color, setColor] = useState(direction?.color ?? "#5278d9");
  const [availability, setAvailability] = useState(direction?.availability ?? "active");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    update((current) => {
      if (direction) {
        return {
          ...current,
          directions: current.directions.map((item) => item.id === direction.id ? {
            ...item,
            name: name.trim(),
            metric,
            unit: metric === "checkbox" ? "" : unit.trim(),
            color,
            availability,
            metricHistory: metric !== item.metric || unit !== item.unit
              ? [...item.metricHistory, { metric, unit: metric === "checkbox" ? "" : unit.trim(), since: iso(new Date()).slice(0, 7) }]
              : item.metricHistory,
          } : item),
        };
      }
      return {
        ...current,
        directions: [...current.directions, {
          id: uid("direction"),
          name: name.trim(),
          metric,
          unit: metric === "checkbox" ? "" : unit.trim(),
          color,
          availability: "active",
          metricHistory: [{ metric, unit: metric === "checkbox" ? "" : unit.trim(), since: iso(new Date()).slice(0, 7) }],
        }],
      };
    }, direction ? "Направление обновлено" : "Направление создано");
    close();
  };
  return (
    <Modal title={direction ? "Изменить направление" : "Новое направление"} onClose={close}>
      <form onSubmit={submit} className="form-grid">
        <label className="field field-full"><span>Название</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>Метрика</span><select value={metric} onChange={(e) => setMetric(e.target.value as MetricType)}>{Object.entries(metricName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {metric !== "checkbox" && <label className="field"><span>Единица</span><input value={unit} onChange={(e) => setUnit(e.target.value)} required /></label>}
        <label className="field"><span>Цвет</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        {direction && <label className="field"><span>Доступность</span><select value={availability} onChange={(e) => setAvailability(e.target.value as Direction["availability"])}><option value="active">Активно</option><option value="paused">Приостановлено</option><option value="archived">Архив</option></select></label>}
        <div className="modal-actions field-full"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button type="submit">Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function ActivityForm({
  activity,
  close,
  update,
}: {
  activity?: ActivityType;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const [name, setName] = useState(activity?.name ?? "");
  const [color, setColor] = useState(activity?.color ?? "#4f7bd8");
  const [archived, setArchived] = useState(activity?.archived ?? false);
  return (
    <Modal title={activity ? "Изменить тип деятельности" : "Новый тип деятельности"} onClose={close}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        update((current) => ({
          ...current,
          activityTypes: activity
            ? current.activityTypes.map((item) => item.id === activity.id ? { ...item, name: name.trim(), color, archived } : item)
            : [...current.activityTypes, { id: uid("activity"), name: name.trim(), color, icon: "circle", order: current.activityTypes.length + 1, archived: false }],
        }), activity ? "Тип обновлён" : "Тип создан");
        close();
      }}>
        <label className="field field-full"><span>Название</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Цвет</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        {activity && <label className="field checkbox-field"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /><span>В архиве</span></label>}
        <div className="modal-actions field-full"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button>Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function DayForm({
  data,
  date,
  close,
  update,
}: {
  data: PlannerData;
  date: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const current = data.days.find((item) => item.date === date);
  const [segments, setSegments] = useState<DayPlan["segments"]>(
    current?.segments.length ? current.segments.map((item) => ({ ...item })) : [{ activityId: data.activityTypes.find((item) => !item.archived)?.id ?? "", percent: 100 }],
  );
  const total = segments.reduce((sum, item) => sum + item.percent, 0);
  const activeTypes = data.activityTypes.filter((item) => !item.archived);
  if (!activeTypes.length) {
    return (
      <Modal title={dateLabel(date, { weekday: "long", day: "numeric", month: "long" })} onClose={close}>
        <EmptyState text="Нет типов деятельности" action="Закрыть" onAction={close} />
      </Modal>
    );
  }
  return (
    <Modal title={dateLabel(date, { weekday: "long", day: "numeric", month: "long" })} onClose={close}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (total !== 100 || segments.some((item) => item.percent <= 0)) return;
        update((state) => {
          const exists = state.days.some((item) => item.date === date);
          return {
            ...state,
            days: exists
              ? state.days.map((item) => item.date === date ? { ...item, segments } : item)
              : [...state.days, { date, segments, breaks: [] }],
          };
        }, "Состав дня сохранён");
        close();
      }}>
        <SegmentedBar segments={segments} data={data} />
        <div className="segment-editor">
          {segments.map((segment, index) => (
            <div key={index}>
              <select value={segment.activityId} onChange={(e) => setSegments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, activityId: e.target.value } : item))}>
                {activeTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="percent-input"><input type="number" min="1" max="100" value={segment.percent} onChange={(e) => setSegments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, percent: Number(e.target.value) } : item))} /><span>%</span></div>
              <button type="button" className="icon-button" disabled={segments.length === 1} onClick={() => setSegments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="add-line" onClick={() => setSegments((items) => [...items, { activityId: activeTypes.find((item) => !items.some((segment) => segment.activityId === item.id))?.id ?? activeTypes[0].id, percent: 0 }])}>+ Добавить сегмент</button>
        <div className={`sum-line ${total === 100 ? "valid" : "invalid"}`}><span>Сумма</span><strong>{total}%</strong></div>
        {total !== 100 && <p className="form-error">Сумма должна составлять 100%</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button disabled={total !== 100}>Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function WorkForm({
  data,
  date,
  close,
  update,
}: {
  data: PlannerData;
  date: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const day = data.days.find((item) => item.date === date);
  const [start, setStart] = useState(day?.workStart ?? "12:30");
  const [end, setEnd] = useState(day?.workEnd ?? "22:30");
  const [breaks, setBreaks] = useState(day?.breaks.map((item) => ({ ...item })) ?? []);
  const draft: DayPlan = { date, segments: day?.segments ?? [], workStart: start, workEnd: end, breaks };
  const mins = workMinutes(draft);
  const valid = mins.total > 0 && breaks.every((item) => toMinutes(item.end) > toMinutes(item.start));
  return (
    <Modal title="Рабочий период" onClose={close}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        update((state) => {
          const exists = state.days.some((item) => item.date === date);
          return { ...state, days: exists ? state.days.map((item) => item.date === date ? { ...item, workStart: start, workEnd: end, breaks } : item) : [...state.days, draft] };
        }, "Рабочий период сохранён");
        close();
      }}>
        <div className="form-grid">
          <label className="field"><span>Начало</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span>Окончание</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <h3 className="form-section-title">Перерывы</h3>
        <div className="break-editor">
          {breaks.map((item, index) => (
            <div key={item.id}>
              <input type="time" value={item.start} onChange={(e) => setBreaks((items) => items.map((entry, i) => i === index ? { ...entry, start: e.target.value } : entry))} />
              <span>—</span>
              <input type="time" value={item.end} onChange={(e) => setBreaks((items) => items.map((entry, i) => i === index ? { ...entry, end: e.target.value } : entry))} />
              <button type="button" className="icon-button" onClick={() => setBreaks((items) => items.filter((_, i) => i !== index))}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="add-line" onClick={() => setBreaks((items) => [...items, { id: uid("break"), start: "17:00", end: "17:30" }])}>+ Добавить перерыв</button>
        <div className="calculation-box">
          <span>Период <strong>{formatMinutes(mins.total)}</strong></span>
          <span>Перерывы <strong>{formatMinutes(mins.breaks)}</strong></span>
          <span>Итого <strong>{formatMinutes(mins.net)}</strong></span>
        </div>
        {!valid && <p className="form-error">Проверьте время начала и окончания</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button disabled={!valid}>Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function FactForm({
  data,
  weekId,
  directionId,
  close,
  update,
}: {
  data: PlannerData;
  weekId: string;
  directionId?: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const week = data.weeks.find((item) => item.id === weekId);
  const available = week?.items ?? [];
  const [selectedId, setSelectedId] = useState(directionId ?? available[0]?.directionId ?? "");
  const item = available.find((entry) => entry.directionId === selectedId);
  const [value, setValue] = useState(1);
  const [date, setDate] = useState(() => {
    const today = iso(new Date());
    return today >= weekId && today <= iso(addDays(parseDate(weekId), 6)) ? today : weekId;
  });
  return (
    <Modal title="Добавить выполнение" onClose={close}>
      {!week ? <p className="compact-empty">Сначала запланируйте неделю</p> : (
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          if (!item || value < 0) return;
          update((current) => ({ ...current, completions: [...current.completions, { id: uid("completion"), directionId: selectedId, weekId, date, value: item.metric === "checkbox" ? 1 : value }] }), "Выполнение добавлено");
          close();
        }}>
          <label className="field field-full"><span>Направление</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{available.map((entry) => <option key={entry.directionId} value={entry.directionId}>{data.directions.find((item) => item.id === entry.directionId)?.name}</option>)}</select></label>
          {item?.metric === "checkbox" ? (
            <label className="field checkbox-field"><input type="checkbox" checked readOnly /><span>Выполнено</span></label>
          ) : (
            <label className="field"><span>Значение{item?.unit && `, ${item.unit}`}</span><input type="number" min="0" step="0.1" value={value} onChange={(e) => setValue(Number(e.target.value))} required /></label>
          )}
          <label className="field"><span>Дата</span><input type="date" min={weekId} max={iso(addDays(parseDate(weekId), 6))} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <div className="modal-actions field-full"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button>Добавить</Button></div>
        </form>
      )}
    </Modal>
  );
}

function ExtraForm({
  weekId,
  close,
  update,
}: {
  weekId: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<MetricType>("checkbox");
  const [unit, setUnit] = useState("раз");
  const [value, setValue] = useState(1);
  const [date, setDate] = useState(weekId);
  return (
    <Modal title="Дополнительный результат" onClose={close}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        update((current) => ({ ...current, extraResults: [...current.extraResults, { id: uid("result"), weekId, title: title.trim(), metric, unit: metric === "checkbox" ? "" : unit.trim(), value: metric === "checkbox" ? 1 : value, date }] }), "Результат добавлен");
        close();
      }}>
        <label className="field field-full"><span>Название</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="field"><span>Метрика</span><select value={metric} onChange={(e) => setMetric(e.target.value as MetricType)}>{Object.entries(metricName).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {metric !== "checkbox" && <label className="field"><span>Единица</span><input value={unit} onChange={(e) => setUnit(e.target.value)} required /></label>}
        {metric !== "checkbox" && <label className="field"><span>Значение</span><input type="number" min="0" step="0.1" value={value} onChange={(e) => setValue(Number(e.target.value))} /></label>}
        <label className="field"><span>Дата</span><input type="date" min={weekId} max={iso(addDays(parseDate(weekId), 6))} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <div className="modal-actions field-full"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button>Добавить</Button></div>
      </form>
    </Modal>
  );
}

function PlanForm({
  data,
  scope,
  id,
  close,
  update,
}: {
  data: PlannerData;
  scope: "month" | "week";
  id: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const existing = scope === "month" ? data.months.find((item) => item.id === id) : data.weeks.find((item) => item.id === id);
  const monthId = scope === "month" ? id : monthIdForWeek(id);
  const month = data.months.find((item) => item.id === monthId);
  const candidates = scope === "month"
    ? data.directions.filter((item) => item.availability === "active")
    : data.directions.filter((direction) => month?.items.some((item) => item.directionId === direction.id && !item.paused) && direction.availability === "active");
  const [rows, setRows] = useState<{ directionId: string; target: number }[]>(
    existing?.items.map((item) => ({ directionId: item.directionId, target: item.target })) ?? candidates.slice(0, scope === "month" ? 4 : 3).map((item) => ({ directionId: item.id, target: 1 })),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!rows.length || rows.some((row) => row.target < 0 || !row.directionId)) return;
    if (existing && periodStatus(id, scope) !== (scope === "month" ? "Будущий" : "Будущая")) {
      if (!window.confirm("Изменить план? Статистика периода будет пересчитана")) return;
    }
    const oldItems = existing?.items ?? [];
    const items = rows.map((row) => {
      const old = oldItems.find((item) => item.directionId === row.directionId);
      const direction = data.directions.find((item) => item.id === row.directionId)!;
      const metricSource = scope === "week" ? month?.items.find((item) => item.directionId === row.directionId) : undefined;
      if (old) return { ...old, target: row.target, history: old.target !== row.target ? [...old.history, { date: iso(new Date()), from: old.target, to: row.target, reason: "Изменение плана" }] : old.history };
      return {
        id: uid("plan"),
        directionId: row.directionId,
        originalTarget: row.target,
        target: row.target,
        metric: metricSource?.metric ?? direction.metric,
        unit: metricSource?.unit ?? direction.unit,
        history: [],
      };
    });
    update((current) => scope === "month"
      ? { ...current, months: existing ? current.months.map((item) => item.id === id ? { ...item, items } : item) : [...current.months, { id, month: id, items }] }
      : { ...current, weeks: existing ? current.weeks.map((item) => item.id === id ? { ...item, items } : item) : [...current.weeks, { id, start: id, monthId, items }] },
    "План сохранён");
    close();
  };
  return (
    <Modal title={`${existing ? "Изменить" : "Запланировать"} ${scope === "month" ? "месяц" : "неделю"}`} onClose={close} wide>
      {scope === "week" && !month ? (
        <div className="empty-state"><p>Сначала запланируйте месяц</p><Button onClick={() => { close(); navigate({ page: "month", id: monthId }); }}>Открыть месяц</Button></div>
      ) : (
        <form onSubmit={submit}>
          <div className="plan-editor">
            {rows.map((row, index) => {
              const direction = data.directions.find((item) => item.id === row.directionId);
              return (
                <div key={`${row.directionId}-${index}`}>
                  <select value={row.directionId} onChange={(e) => setRows((items) => items.map((item, i) => i === index ? { ...item, directionId: e.target.value } : item))}>
                    {candidates.filter((item) => item.id === row.directionId || !rows.some((rowItem) => rowItem.directionId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <span className="metric-label">{direction ? `${metricName[direction.metric]}${direction.unit ? ` · ${direction.unit}` : ""}` : ""}</span>
                  <input type="number" min="0" step="0.1" value={row.target} onChange={(e) => setRows((items) => items.map((item, i) => i === index ? { ...item, target: Number(e.target.value) } : item))} />
                  <button type="button" className="icon-button" onClick={() => setRows((items) => items.filter((_, i) => i !== index))}>×</button>
                </div>
              );
            })}
          </div>
          {candidates.some((candidate) => !rows.some((row) => row.directionId === candidate.id)) && (
            <button type="button" className="add-line" onClick={() => {
              const candidate = candidates.find((item) => !rows.some((row) => row.directionId === item.id));
              if (candidate) setRows((items) => [...items, { directionId: candidate.id, target: 1 }]);
            }}>+ Добавить направление</button>
          )}
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button disabled={!rows.length}>Сохранить план</Button></div>
        </form>
      )}
    </Modal>
  );
}

function findPlan(data: PlannerData, scope: "month" | "week", planId: string) {
  return scope === "month" ? data.months.find((item) => item.id === planId) : data.weeks.find((item) => item.id === planId);
}

function EditItemForm({
  data,
  scope,
  planId,
  itemId,
  close,
  update,
  setModal,
}: {
  data: PlannerData;
  scope: "month" | "week";
  planId: string;
  itemId: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  const plan = findPlan(data, scope, planId);
  const item = plan?.items.find((entry) => entry.id === itemId);
  const direction = data.directions.find((entry) => entry.id === item?.directionId);
  const [target, setTarget] = useState(item?.target ?? 0);
  if (!item || !direction) return null;
  const replaceItem = (current: PlannerData, nextItems: PlanItem[]) => scope === "month"
    ? { ...current, months: current.months.map((entry) => entry.id === planId ? { ...entry, items: nextItems } : entry) }
    : { ...current, weeks: current.weeks.map((entry) => entry.id === planId ? { ...entry, items: nextItems } : entry) };
  return (
    <Modal title={direction.name} onClose={close}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (periodStatus(planId, scope) !== (scope === "month" ? "Будущий" : "Будущая") && !window.confirm("Изменить план? Статистика периода будет пересчитана")) return;
        update((current) => {
          const currentPlan = findPlan(current, scope, planId)!;
          return replaceItem(current, currentPlan.items.map((entry) => entry.id === itemId ? { ...entry, target, history: [...entry.history, { date: iso(new Date()), from: entry.target, to: target, reason: "Изменение плана" }] } : entry));
        }, "План изменён");
        close();
      }}>
        <label className="field"><span>План, {item.unit || metricName[item.metric].toLowerCase()}</span><input type="number" min="0" step="0.1" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
        <div className="action-list">
          <button type="button" onClick={() => setModal({ kind: "pause", scope, planId, itemId })}>{item.paused ? "Изменить приостановку" : scope === "month" ? "Приостановить до конца месяца" : "Приостановить на неделю"}<span>→</span></button>
          {item.paused && <button type="button" onClick={() => {
            update((current) => {
              const currentPlan = findPlan(current, scope, planId)!;
              return replaceItem(current, currentPlan.items.map((entry) => entry.id === itemId ? { ...entry, paused: undefined } : entry));
            }, "Направление возобновлено");
            close();
          }}>Возобновить<span>→</span></button>}
          <button type="button" onClick={() => setModal({ kind: "details", scope, planId, itemId })}>Подробности<span>→</span></button>
          {scope === "week" && <button type="button" className="danger-link" onClick={() => {
            if (!window.confirm("Удалить направление из недельного плана?")) return;
            update((current) => {
              const currentPlan = findPlan(current, scope, planId)!;
              return replaceItem(current, currentPlan.items.filter((entry) => entry.id !== itemId));
            }, "Направление удалено из плана");
            close();
          }}>Удалить из плана<span>×</span></button>}
        </div>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button>Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function PauseForm({
  data,
  scope,
  planId,
  itemId,
  close,
  update,
}: {
  data: PlannerData;
  scope: "month" | "week";
  planId: string;
  itemId: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
}) {
  const plan = findPlan(data, scope, planId);
  const item = plan?.items.find((entry) => entry.id === itemId);
  const [reason, setReason] = useState(item?.paused?.reason ?? "Болезнь");
  const [details, setDetails] = useState(item?.paused?.details ?? "");
  const [target, setTarget] = useState(item?.target ?? 0);
  if (!item) return null;
  const reasons = ["Болезнь", "Отпуск или поездка", "Внешние обстоятельства", "Ожидание другого человека", "Изменение доступности", "Изменение приоритетов", "Другое"];
  return (
    <Modal title={scope === "month" ? "Приостановить до конца месяца" : "Приостановить на неделю"} onClose={close}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        update((current) => {
          const currentPlan = findPlan(current, scope, planId)!;
          const nextItems = currentPlan.items.map((entry) => entry.id === itemId ? {
            ...entry,
            target,
            paused: { reason, details: reason === "Другое" ? details : undefined, date: iso(new Date()), excluded: Math.max(0, entry.originalTarget - target) },
            history: entry.target !== target ? [...entry.history, { date: iso(new Date()), from: entry.target, to: target, reason }] : entry.history,
          } : entry);
          return scope === "month"
            ? { ...current, months: current.months.map((entry) => entry.id === planId ? { ...entry, items: nextItems } : entry) }
            : { ...current, weeks: current.weeks.map((entry) => entry.id === planId ? { ...entry, items: nextItems } : entry), months: current.months.map((month) => month.id === (currentPlan as WeekPlan).monthId ? { ...month, items: month.items.map((monthItem) => monthItem.directionId === item.directionId && target < item.target ? { ...monthItem, target: Math.max(0, monthItem.target - (item.target - target)), history: [...monthItem.history, { date: iso(new Date()), from: monthItem.target, to: Math.max(0, monthItem.target - (item.target - target)), reason }] } : monthItem) } : month) };
        }, "Приостановка сохранена");
        close();
      }}>
        <label className="field field-full"><span>Причина</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label>
        {reason === "Другое" && <label className="field field-full"><span>Уточнение</span><input value={details} onChange={(e) => setDetails(e.target.value)} required /></label>}
        <label className="field field-full"><span>Актуальный план</span><input type="number" min="0" max={item.originalTarget} step="0.1" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
        <div className="calculation-box field-full"><span>Первоначальный план <strong>{formatValue(item.originalTarget, item.metric, item.unit)}</strong></span><span>Исключено <strong>{formatValue(Math.max(0, item.originalTarget - target), item.metric, item.unit)}</strong></span><span>Актуальный план <strong>{formatValue(target, item.metric, item.unit)}</strong></span></div>
        <div className="modal-actions field-full"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button>Приостановить</Button></div>
      </form>
    </Modal>
  );
}

function Details({
  data,
  scope,
  planId,
  itemId,
  close,
}: {
  data: PlannerData;
  scope: "month" | "week";
  planId: string;
  itemId: string;
  close: () => void;
}) {
  const plan = findPlan(data, scope, planId);
  const item = plan?.items.find((entry) => entry.id === itemId);
  const direction = data.directions.find((entry) => entry.id === item?.directionId);
  if (!item || !direction) return null;
  const entries = data.completions.filter((entry) => entry.directionId === item.directionId && (scope === "week" ? entry.weekId === planId : monthIdForWeek(entry.weekId) === planId));
  const fact = itemFact(data, item, scope === "week" ? planId : undefined);
  return (
    <Modal title="Подробности" onClose={close}>
      <div className="details-head"><span className="direction-dot" style={{ background: direction.color }} /><div><h3>{direction.name}</h3><span>{metricName[item.metric]}{item.unit && ` · ${item.unit}`}</span></div></div>
      <div className="detail-numbers">
        <div><span>Первоначальный план</span><strong>{formatValue(item.originalTarget, item.metric, item.unit)}</strong></div>
        <div><span>Актуальный план</span><strong>{formatValue(item.target, item.metric, item.unit)}</strong></div>
        <div><span>Факт</span><strong>{formatValue(fact, item.metric, item.unit)}</strong></div>
        {item.paused && <div><span>Исключено</span><strong>{formatValue(item.paused.excluded, item.metric, item.unit)}</strong></div>}
      </div>
      {item.paused && <div className="pause-note"><Badge tone="amber">{item.paused.reason}</Badge><span>{dateLabel(item.paused.date)}</span>{item.paused.details && <p>{item.paused.details}</p>}</div>}
      <h3 className="form-section-title">Записи выполнения</h3>
      {entries.length ? <div className="history-list">{entries.map((entry) => <div key={entry.id}><span>{dateLabel(entry.date)}</span><strong>{formatValue(entry.value, item.metric, item.unit)}</strong></div>)}</div> : <p className="compact-empty">Нет записей выполнения</p>}
      {item.history.length > 0 && <><h3 className="form-section-title">История изменений</h3><div className="history-list">{item.history.map((entry, index) => <div key={`${entry.date}-${index}`}><span>{dateLabel(entry.date)} · {entry.reason}</span><strong>{formatValue(entry.from, item.metric, item.unit)} → {formatValue(entry.to, item.metric, item.unit)}</strong></div>)}</div></>}
    </Modal>
  );
}

function toMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function workMinutes(day: DayPlan) {
  const total = Math.max(0, toMinutes(day.workEnd) - toMinutes(day.workStart));
  const breaks = day.breaks.reduce((sum, item) => sum + Math.max(0, toMinutes(item.end) - toMinutes(item.start)), 0);
  return { total, breaks, net: Math.max(0, total - breaks) };
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours ? `${hours} ч` : ""}${hours && minutes ? " " : ""}${minutes ? `${minutes} мин` : hours ? "" : "0 мин"}`;
}
