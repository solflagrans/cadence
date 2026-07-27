"use client";

import Image from "next/image";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import type {
  ActivityType,
  DayPlan,
  Direction,
  MetricType,
  PlanItem,
  PlannerData,
  Route,
  WeekPlan,
} from "@/app/lib/types";
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
  startOfWeek,
  uid,
  weekIdFor,
  weekLabel,
} from "@/app/lib/data";
import {
  signInWithEmail,
  signUpWithEmail,
} from "@/app/lib/auth/client";
import type { AccountIdentity } from "@/app/lib/auth/types";
import {
  addDirection,
  deleteDirection,
  updateDirection,
} from "@/src/domain/planner/commands/directions";
import {
  recordCompletion,
  saveMonthPlan,
  saveWeekPlan,
} from "@/src/domain/planner/commands/plans";
import {
  PlannerProvider,
  usePlanner,
} from "@/src/application/planner/planner-provider";
import { Button } from "@/src/shared/ui/button/button";
import { Modal } from "@/src/shared/ui/modal/modal";
import { Badge } from "@/src/shared/ui/badge/badge";
import { EmptyState } from "@/src/shared/ui/empty-state/empty-state";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import { SaveIndicator } from "@/src/widgets/save-indicator/save-indicator";
import { Icon, type IconName } from "@/src/shared/ui/icon/icon";
import { IconButton } from "@/src/shared/ui/icon-button/icon-button";
import { SegmentedBar } from "@/src/widgets/schedule/segmented-bar";
import {
  navigate,
  routeFromPathname,
} from "@/src/application/navigation/routes";
import type { ModalState } from "./model/modal-state";
import { PlanRows } from "./widgets/plan-rows";
import { PlanSummary } from "./widgets/plan-summary";
import { PlansPage } from "./pages/plans-page";
import { SettingsPage } from "./pages/settings-page";
import { SchedulePage } from "./pages/schedule-page";
import {
  DirectionDetailsPage,
  DirectionsPage,
} from "./pages/directions-page";

const NAV: {
  page: Route["page"];
  label: string;
  short: string;
  icon: IconName;
}[] = [
  { page: "overview", label: "Обзор", short: "Обзор", icon: "home" },
  { page: "today", label: "Сегодня", short: "Сегодня", icon: "today" },
  { page: "plans", label: "Планы", short: "Планы", icon: "plans" },
  { page: "schedule", label: "График", short: "График", icon: "schedule" },
  { page: "directions", label: "Направления", short: "Цели", icon: "directions" },
  { page: "settings", label: "Настройки", short: "Ещё", icon: "settings" },
];

export default function PlannerApp({
  initialRoute = { page: "overview" },
}: {
  initialRoute?: Route;
}) {
  return (
    <PlannerProvider>
      <PlannerAppContent initialRoute={initialRoute} />
    </PlannerProvider>
  );
}

function PlannerAppContent({ initialRoute }: { initialRoute: Route }) {
  const {
    data,
    update,
    saveStatus,
    account,
    localOnly,
    toast,
    signOut,
    refreshSession,
  } = usePlanner();
  const [route, setRoute] = useState<Route>(initialRoute);
  const [modal, setModal] = useState<ModalState>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const sync = () => setRoute(routeFromPathname(window.location.pathname));
    const custom = (event: Event) =>
      setRoute((event as CustomEvent<Route>).detail);
    window.addEventListener("popstate", sync);
    window.addEventListener("cadence:navigate", custom);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("cadence:navigate", custom);
    };
  }, []);

  const title = NAV.find((entry) => entry.page === route.page)?.label ?? "Cadence";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate({ page: "overview" })}>
          <span className="brand-mark">
            <Image src="/favicon.png" alt="" width={34} height={34} priority />
          </span>
          <span className="brand-copy">
            <strong>Cadence</strong>
            <small>Персональный ритм</small>
          </span>
        </button>
        <nav className="sidebar-nav" aria-label="Основная навигация">
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
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-status">
          <SaveIndicator status={saveStatus} localOnly={localOnly} />
        </div>
        <div className="sidebar-foot sidebar-account">
          <span className="avatar">
            {account ? accountInitial(account) : <Icon name="user" size={17} />}
          </span>
          <div className="sidebar-account-copy">
            <strong>{account?.name || "Гость"}</strong>
            <span>
              {account
                ? "Синхронизация с аккаунтом"
                : "Данные только на этом устройстве"}
            </span>
          </div>
          {account ? (
            <button className="sidebar-account-action" onClick={() => void signOut()}>
              <Icon name="logout" size={14} /> Выйти
            </button>
          ) : (
            <button className="sidebar-account-action" onClick={() => setAuthOpen(true)}>
              <Icon name="login" size={14} /> Войти
            </button>
          )}
        </div>
      </aside>

      <div className="mobile-topbar">
        <button className="brand" onClick={() => navigate({ page: "overview" })}>
          <span className="brand-mark">
            <Image src="/favicon.png" alt="" width={28} height={28} priority />
          </span>
          <span>Cadence</span>
        </button>
        <div className="mobile-meta">
          <span>{title}</span>
          <SaveIndicator status={saveStatus} localOnly={localOnly} />
        </div>
      </div>

      <main className={`content content-${route.page}`}>
        <div className="content-inner">
          {route.page === "overview" && <Overview data={data} setModal={setModal} />}
          {route.page === "today" && <Today data={data} setModal={setModal} />}
          {route.page === "plans" && <PlansPage data={data} />}
          {route.page === "month" && (
            <MonthPage data={data} monthId={route.id} setModal={setModal} />
          )}
          {route.page === "week" && (
            <WeekPage data={data} weekId={route.id} setModal={setModal} />
          )}
          {route.page === "schedule" && (
            <SchedulePage data={data} update={update} setModal={setModal} />
          )}
          {route.page === "directions" && (
            <DirectionsPage data={data} setModal={setModal} />
          )}
          {route.page === "direction" && (
            <DirectionDetailsPage
              data={data}
              id={route.id}
              setModal={setModal}
            />
          )}
          {route.page === "settings" && (
            <SettingsPage
              data={data}
              update={update}
              setModal={setModal}
              account={account}
              openAuth={() => setAuthOpen(true)}
            signOut={() => void signOut()}
            />
          )}
        </div>
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
            <Icon name={item.icon} size={19} />
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
      {authOpen && (
        <AuthModal
          close={() => setAuthOpen(false)}
          authenticated={async () => {
            await refreshSession();
            setAuthOpen(false);
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

const accountInitial = (account: AccountIdentity): string =>
  (account.name || account.email).trim().charAt(0).toUpperCase() || "А";

function AuthModal({
  close,
  authenticated,
}: {
  close: () => void;
  authenticated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      const message =
        mode === "sign-in"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(name, email, password);
      if (message) {
        setError(message);
        return;
      }
      await authenticated();
    } catch {
      setError("Не удалось связаться с сервисом авторизации");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      title={mode === "sign-in" ? "Вход в Cadence" : "Создание аккаунта"}
      onClose={close}
    >
      <form className="auth-form" onSubmit={submit}>
        <p>
          После входа данные будут сохраняться в вашем аккаунте и станут
          доступны на других устройствах.
        </p>
        {mode === "sign-up" && (
          <label>
            <span>Имя</span>
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          <span>Пароль</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending
            ? "Подождите…"
            : mode === "sign-in"
              ? "Войти"
              : "Создать аккаунт"}
        </Button>
        <button
          className="text-link auth-mode"
          type="button"
          onClick={() => {
            setMode((current) =>
              current === "sign-in" ? "sign-up" : "sign-in",
            );
            setError("");
          }}
        >
          {mode === "sign-in"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </form>
    </Modal>
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
        eyebrow="Ваш ритм"
        description="Главное на сегодня: график, текущие планы и результаты."
        meta={<span>{dateLabel(currentDate, { weekday: "long", day: "numeric", month: "long" })}</span>}
        actions={<Button icon="plus" onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>}
      />
      {attention.length > 0 && (
        <section className="attention-strip">
          <strong><Icon name="alert" size={16} /> Требуется внимание</strong>
          <div>
            {attention.map((item) => (
              <button key={item.text} onClick={item.action}>{item.text}<Icon name="arrow-right" size={14} /></button>
            ))}
          </div>
        </section>
      )}
      <section className="card schedule-card">
        <div className="section-head">
          <h2>Рабочий график</h2>
          <button className="text-link" onClick={() => navigate({ page: "schedule" })}>Открыть график <Icon name="arrow-right" size={15} /></button>
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
            <button className="text-link" onClick={() => navigate({ page: "month", id: monthId })}>Открыть <Icon name="arrow-right" size={15} /></button>
          </div>
          {month ? (
            <>
              <PlanRows data={data} items={month.items.slice(0, 5)} scope="month" planId={month.id} setModal={setModal} />
              <PlanSummary data={data} month={month} />
            </>
          ) : (
            <EmptyState icon="plans" title="Месяц ещё не запланирован" text="Добавьте направления и задайте ориентиры на текущий месяц." action="Запланировать месяц" onAction={() => setModal({ kind: "month-plan", monthId })} />
          )}
        </section>
        <section className="card">
          <div className="section-head">
            <div><span className="eyebrow">Текущая неделя</span><h2>{weekLabel(weekId)}</h2></div>
            <button className="text-link" onClick={() => navigate({ page: "week", id: weekId })}>Открыть <Icon name="arrow-right" size={15} /></button>
          </div>
          {week ? (
            <>
              <PlanRows data={data} items={week.items} scope="week" planId={week.id} weekId={week.id} setModal={setModal} />
              <div className="inline-actions">
                <Button icon="plus" variant="secondary" onClick={() => setModal({ kind: "fact", weekId })}>Добавить выполнение</Button>
                <Button icon="spark" variant="ghost" onClick={() => setModal({ kind: "extra", weekId })}>Добавить результат</Button>
              </div>
            </>
          ) : (
            <EmptyState icon="today" title="Неделя ещё не запланирована" text="Сформируйте недельный план на основе направлений месяца." action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
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
        eyebrow="Фокус дня"
        description="Состав дня, рабочее время и выполнение недельного плана."
        meta={dateLabel(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<Button icon="edit" variant="secondary" onClick={() => setModal({ kind: "day", date: today })}>Изменить состав дня</Button>}
      />
      <section className="today-hero card">
        <SegmentedBar segments={day.segments} data={data} />
        {day.segments.length ? (
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
        ) : (
          <p className="today-empty">Состав дня пока не задан</p>
        )}
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
            <EmptyState icon="schedule" title="Рабочий период не указан" text="Укажите начало, окончание и перерывы рабочего дня." action="Добавить период" onAction={() => setModal({ kind: "work", date: today })} />
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
            <EmptyState icon="today" title="Неделя ещё не запланирована" text="Добавьте направления, чтобы отмечать выполнение сегодня." action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
          )}
        </section>
      </div>
      <ExtrasBlock data={data} weekId={weekId} setModal={setModal} />
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
        eyebrow="Месячный план"
        back={() => navigate({ page: "plans" })}
        meta={<Badge tone={periodStatus(monthId, "month") === "Текущий" ? "blue" : "neutral"}>{periodStatus(monthId, "month")}</Badge>}
        actions={
          <div className="period-switcher">
            <IconButton icon="chevron-left" label="Предыдущий месяц" onClick={() => navigate({ page: "month", id: iso(prev).slice(0, 7) })} />
            <IconButton icon="chevron-right" label="Следующий месяц" onClick={() => navigate({ page: "month", id: iso(next).slice(0, 7) })} />
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
          <EmptyState icon="plans" title="Месяц ещё не запланирован" text="Выберите активные направления и задайте плановые значения." action="Запланировать месяц" onAction={() => setModal({ kind: "month-plan", monthId })} />
        )}
      </section>
      <section className="card extras-card">
        <div className="section-head"><h2>Дополнительные результаты</h2><Badge>{extras.length}</Badge></div>
        {extras.length ? (
          <div className="extras-list">
            {extras.map((item) => (
              <div key={item.id}>
                <span className="result-check"><Icon name="check" size={14} /></span>
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
        eyebrow="Недельный план"
        back={() => navigate({ page: "month", id: monthId })}
        meta={<><button className="crumb-link" onClick={() => navigate({ page: "month", id: monthId })}>{monthName(monthId)}</button><Badge tone={periodStatus(weekId, "week") === "Текущая" ? "blue" : "neutral"}>{periodStatus(weekId, "week")}</Badge></>}
        actions={
          <div className="period-switcher">
            <IconButton icon="chevron-left" label="Предыдущая неделя" onClick={() => navigate({ page: "week", id: iso(addDays(parseDate(weekId), -7)) })} />
            <IconButton icon="chevron-right" label="Следующая неделя" onClick={() => navigate({ page: "week", id: iso(addDays(parseDate(weekId), 7)) })} />
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
          <EmptyState icon="today" title="Неделя ещё не запланирована" text="Распределите месячные направления на эту неделю." action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
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
      <div className="section-head"><h2>Дополнительные результаты</h2><Button icon="plus" variant="ghost" onClick={() => setModal({ kind: "extra", weekId })}>Добавить результат</Button></div>
      {extras.length ? (
        <div className="extras-list">
          {extras.map((item) => (
            <div key={item.id}><span className="result-check"><Icon name="check" size={14} /></span><div><strong>{item.title}</strong><span>{dateLabel(item.date)}</span></div><strong>{formatValue(item.value, item.metric, item.unit)}</strong></div>
          ))}
        </div>
      ) : <p className="compact-empty">Нет дополнительных результатов</p>}
    </section>
  );
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
  if (modal.kind === "direction") {
    const returnToPlan = modal.returnToPlan;
    const directionClose = returnToPlan
      ? () => setModal(
          returnToPlan.scope === "month"
            ? { kind: "month-plan", monthId: returnToPlan.id }
            : { kind: "week-plan", weekId: returnToPlan.id },
        )
      : close;
    return <DirectionForm direction={modal.direction} close={directionClose} update={update} />;
  }
  if (modal.kind === "activity") return <ActivityForm activity={modal.activity} close={close} update={update} />;
  if (modal.kind === "day") return <DayForm data={data} date={modal.date} close={close} update={update} />;
  if (modal.kind === "work") return <WorkForm data={data} date={modal.date} close={close} update={update} />;
  if (modal.kind === "fact") return <FactForm data={data} weekId={modal.weekId} directionId={modal.directionId} close={close} update={update} />;
  if (modal.kind === "extra") return <ExtraForm weekId={modal.weekId} close={close} update={update} />;
  if (modal.kind === "month-plan") return <PlanForm data={data} scope="month" id={modal.monthId} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "week-plan") return <PlanForm data={data} scope="week" id={modal.weekId} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "edit-item") return <EditItemForm data={data} {...modal} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "pause") {
    const nestedClose = modal.returnToEdit
      ? () => setModal({ kind: "edit-item", scope: modal.scope, planId: modal.planId, itemId: modal.itemId })
      : close;
    return <PauseForm data={data} {...modal} close={nestedClose} update={update} />;
  }
  if (modal.kind === "details") {
    const nestedClose = modal.returnToEdit
      ? () => setModal({ kind: "edit-item", scope: modal.scope, planId: modal.planId, itemId: modal.itemId })
      : close;
    return <Details data={data} {...modal} close={nestedClose} />;
  }
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
  const normalizeUnit = (nextMetric: MetricType, nextUnit: string) => {
    if (nextMetric === "checkbox" || nextMetric === "percent") return "";
    if (nextMetric === "duration") return nextUnit === "мин." || nextUnit === "ч." ? nextUnit : "ч.";
    return nextUnit.trim() || "раз";
  };
  const [name, setName] = useState(direction?.name ?? "");
  const [metric, setMetric] = useState<MetricType>(direction?.metric ?? "count");
  const [unit, setUnit] = useState(
    normalizeUnit(direction?.metric ?? "count", direction?.unit ?? "раз"),
  );
  const [color, setColor] = useState(direction?.color ?? "#5278d9");
  const [availability, setAvailability] = useState(direction?.availability ?? "active");
  const savedUnit = normalizeUnit(metric, unit);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    update((current) => {
      if (direction) {
        const nextDirection = current.directions.find(
          (item) => item.id === direction.id,
        );
        if (!nextDirection) return current;
        return updateDirection(current, {
          ...nextDirection,
          name: name.trim(),
          metric,
          unit: savedUnit,
          color,
          availability,
          metricHistory: metric !== nextDirection.metric || savedUnit !== nextDirection.unit
            ? [...nextDirection.metricHistory, { metric, unit: savedUnit, since: iso(new Date()).slice(0, 7) }]
            : nextDirection.metricHistory,
        });
      }
      return addDirection(current, {
        id: uid("direction"),
        name: name.trim(),
        metric,
        unit: savedUnit,
        color,
        availability: "active",
        metricHistory: [{ metric, unit: savedUnit, since: iso(new Date()).slice(0, 7) }],
      });
    }, direction ? "Направление обновлено" : "Направление создано");
    close();
  };
  const remove = () => {
    if (!direction) return;
    if (!window.confirm(
      "Удалить направление? Оно также будет удалено из всех планов вместе с записями выполнения.",
    )) return;

    update(
      (current) => deleteDirection(current, direction.id),
      "Направление удалено",
    );
    close();
    if (routeFromPathname(window.location.pathname).page === "direction") {
      navigate({ page: "directions" });
    }
  };
  return (
    <Modal title={direction ? "Изменить направление" : "Новое направление"} onClose={close}>
      <form onSubmit={submit} className="form-grid">
        <label className="field field-full"><span>Название</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>Метрика</span><select value={metric} onChange={(e) => {
          const nextMetric = e.target.value as MetricType;
          setMetric(nextMetric);
          setUnit(normalizeUnit(
            nextMetric,
            nextMetric === direction?.metric ? direction.unit : nextMetric === "count" ? "раз" : "",
          ));
        }}>{Object.entries(metricName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {metric === "count" && <label className="field"><span>Единица</span><input value={unit} onChange={(e) => setUnit(e.target.value)} required /></label>}
        {metric === "duration" && <label className="field"><span>Единица</span><select value={savedUnit} onChange={(e) => setUnit(e.target.value)}><option value="ч.">ч.</option><option value="мин.">мин.</option></select></label>}
        <label className="field"><span>Цвет</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        {direction && <label className="field"><span>Доступность</span><select value={availability} onChange={(e) => setAvailability(e.target.value as Direction["availability"])}><option value="active">Активно</option><option value="paused">Приостановлено</option><option value="archived">Архив</option></select></label>}
        <div className="modal-actions field-full">
          {direction && <Button variant="danger" type="button" onClick={remove}>Удалить</Button>}
          <Button variant="secondary" type="button" onClick={close}>Отмена</Button>
          <Button type="submit">Сохранить</Button>
        </div>
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
        <EmptyState icon="activity" title="Нет типов деятельности" text="Сначала создайте тип деятельности в разделе «График»." action="Закрыть" onAction={close} />
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
              <IconButton type="button" icon="x" label="Удалить сегмент" disabled={segments.length === 1} onClick={() => setSegments((items) => items.filter((_, itemIndex) => itemIndex !== index))} />
            </div>
          ))}
        </div>
        <button type="button" className="add-line" onClick={() => setSegments((items) => [...items, { activityId: activeTypes.find((item) => !items.some((segment) => segment.activityId === item.id))?.id ?? activeTypes[0].id, percent: 0 }])}><Icon name="plus" size={15} />Добавить сегмент</button>
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
              <IconButton type="button" icon="x" label="Удалить перерыв" onClick={() => setBreaks((items) => items.filter((_, i) => i !== index))} />
            </div>
          ))}
        </div>
        <button type="button" className="add-line" onClick={() => setBreaks((items) => [...items, { id: uid("break"), start: "17:00", end: "17:30" }])}><Icon name="plus" size={15} />Добавить перерыв</button>
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
          update(
            (current) => recordCompletion(current, {
              id: uid("completion"),
              directionId: selectedId,
              weekId,
              date,
              value: item.metric === "checkbox" ? 1 : value,
            }),
            "Выполнение добавлено",
          );
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
  setModal,
}: {
  data: PlannerData;
  scope: "month" | "week";
  id: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  const existing = scope === "month" ? data.months.find((item) => item.id === id) : data.weeks.find((item) => item.id === id);
  const monthId = scope === "month" ? id : monthIdForWeek(id);
  const month = data.months.find((item) => item.id === monthId);
  const candidates = scope === "month"
    ? data.directions.filter((item) => item.availability === "active")
    : data.directions.filter((direction) => month?.items.some((item) => item.directionId === direction.id && !item.paused) && direction.availability === "active");
  const metricForDirection = (directionId: string) => {
    const direction = data.directions.find((item) => item.id === directionId);
    const monthItem = scope === "week"
      ? month?.items.find((item) => item.directionId === directionId)
      : undefined;
    return {
      metric: monthItem?.metric ?? direction?.metric,
      unit: monthItem?.unit ?? direction?.unit ?? "",
    };
  };
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
      const metric = metricSource?.metric ?? direction.metric;
      const planUnit = metric === "checkbox" || metric === "percent"
        ? ""
        : metricSource?.unit ?? direction.unit;
      const target = metric === "checkbox" ? 1 : row.target;
      if (old) return {
        ...old,
        target,
        metric,
        unit: planUnit,
        history: old.target !== target ? [...old.history, { date: iso(new Date()), from: old.target, to: target, reason: "Изменение плана" }] : old.history,
      };
      return {
        id: uid("plan"),
        directionId: row.directionId,
        originalTarget: target,
        target,
        metric,
        unit: planUnit,
        history: [],
      };
    });
    update(
      (current) => scope === "month"
        ? saveMonthPlan(current, { id, month: id, items })
        : saveWeekPlan(current, { id, start: id, monthId, items }),
      "План сохранён",
    );
    close();
  };
  return (
    <Modal title={`${existing ? "Изменить" : "Запланировать"} ${scope === "month" ? "месяц" : "неделю"}`} onClose={close} wide>
      {!data.directions.length ? (
        <EmptyState
          text="Сначала создайте хотя бы одно направление"
          action="Создать направление"
          onAction={() => setModal({
            kind: "direction",
            returnToPlan: { scope, id },
          })}
        />
      ) : scope === "week" && !month ? (
        <div className="empty-state"><p>Сначала запланируйте месяц</p><Button onClick={() => { close(); navigate({ page: "month", id: monthId }); }}>Открыть месяц</Button></div>
      ) : !candidates.length ? (
        <EmptyState
          text={scope === "month"
            ? "Нет активных направлений для планирования"
            : "В месячном плане нет доступных направлений"}
          action={scope === "month" ? "Создать направление" : "Открыть месяц"}
          onAction={() => {
            if (scope === "month") {
              setModal({
                kind: "direction",
                returnToPlan: { scope, id },
              });
            } else {
              close();
              navigate({ page: "month", id: monthId });
            }
          }}
        />
      ) : (
        <form onSubmit={submit}>
          <div className="plan-editor">
            {rows.map((row, index) => {
              const direction = data.directions.find((item) => item.id === row.directionId);
              const rowMetric = metricForDirection(row.directionId);
              return (
                <div key={`${row.directionId}-${index}`}>
                  <select value={row.directionId} onChange={(e) => {
                    const nextMetric = metricForDirection(e.target.value).metric;
                    setRows((items) => items.map((item, i) => i === index
                      ? { ...item, directionId: e.target.value, target: nextMetric === "checkbox" ? 1 : item.target }
                      : item));
                  }}>
                    {candidates.filter((item) => item.id === row.directionId || !rows.some((rowItem) => rowItem.directionId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <span className="metric-label">{direction && rowMetric.metric ? `${metricName[rowMetric.metric]}${rowMetric.unit ? ` · ${rowMetric.unit}` : ""}` : ""}</span>
                  {rowMetric.metric === "checkbox" ? (
                    <span className="checkbox-plan-target">Отметка</span>
                  ) : (
                    <input type="number" min="0" step="0.1" value={row.target} onChange={(e) => setRows((items) => items.map((item, i) => i === index ? { ...item, target: Number(e.target.value) } : item))} />
                  )}
                  <IconButton type="button" icon="x" label="Удалить направление" onClick={() => setRows((items) => items.filter((_, i) => i !== index))} />
                </div>
              );
            })}
          </div>
          {candidates.some((candidate) => !rows.some((row) => row.directionId === candidate.id)) && (
            <button type="button" className="add-line" onClick={() => {
              const candidate = candidates.find((item) => !rows.some((row) => row.directionId === item.id));
              if (candidate) setRows((items) => [...items, { directionId: candidate.id, target: 1 }]);
            }}><Icon name="plus" size={15} />Добавить направление</button>
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

function currentPlanMetric(
  data: PlannerData,
  scope: "month" | "week",
  planId: string,
  direction: Direction,
) {
  if (direction.metric === "checkbox") return { metric: direction.metric, unit: "" };
  if (scope === "month") {
    return {
      metric: direction.metric,
      unit: direction.metric === "percent" ? "" : direction.unit,
    };
  }
  const week = data.weeks.find((item) => item.id === planId);
  const monthItem = data.months
    .find((item) => item.id === week?.monthId)
    ?.items.find((item) => item.directionId === direction.id);
  const metric = monthItem?.metric ?? direction.metric;
  return {
    metric,
    unit: metric === "checkbox" || metric === "percent"
      ? ""
      : monthItem?.unit ?? direction.unit,
  };
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
  const planMetric = currentPlanMetric(data, scope, planId, direction);
  const savedTarget = planMetric.metric === "checkbox" ? 1 : target;
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
          return replaceItem(current, currentPlan.items.map((entry) => entry.id === itemId ? {
            ...entry,
            target: savedTarget,
            metric: planMetric.metric,
            unit: planMetric.unit,
            history: entry.target !== savedTarget
              ? [...entry.history, { date: iso(new Date()), from: entry.target, to: savedTarget, reason: "Изменение плана" }]
              : entry.history,
          } : entry));
        }, "План изменён");
        close();
      }}>
        {planMetric.metric === "checkbox" ? (
          <div className="calculation-box"><span>План <strong>Отметка</strong></span></div>
        ) : (
          <label className="field"><span>План, {planMetric.metric === "percent" ? "%" : planMetric.unit || metricName[planMetric.metric].toLowerCase()}</span><input type="number" min="0" step="0.1" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
        )}
        <div className="action-list">
          <button type="button" onClick={() => setModal({ kind: "pause", scope, planId, itemId, returnToEdit: true })}>{item.paused ? "Изменить приостановку" : scope === "month" ? "Приостановить до конца месяца" : "Приостановить на неделю"}<Icon name="arrow-right" size={15} /></button>
          {item.paused && <button type="button" onClick={() => {
            update((current) => {
              const currentPlan = findPlan(current, scope, planId)!;
              return replaceItem(current, currentPlan.items.map((entry) => entry.id === itemId ? { ...entry, paused: undefined } : entry));
            }, "Направление возобновлено");
            close();
          }}>Возобновить<Icon name="arrow-right" size={15} /></button>}
          <button type="button" onClick={() => setModal({ kind: "details", scope, planId, itemId, returnToEdit: true })}>Подробности<Icon name="arrow-right" size={15} /></button>
          {scope === "week" && <button type="button" className="danger-link" onClick={() => {
            if (!window.confirm("Удалить направление из недельного плана?")) return;
            update((current) => {
              const currentPlan = findPlan(current, scope, planId)!;
              return replaceItem(current, currentPlan.items.filter((entry) => entry.id !== itemId));
            }, "Направление удалено из плана");
            close();
          }}>Удалить из плана<Icon name="trash" size={15} /></button>}
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
        {item.metric === "checkbox" ? (
          <div className="calculation-box field-full"><span>План <strong>Отметка</strong></span></div>
        ) : (
          <label className="field field-full"><span>Актуальный план</span><input type="number" min="0" max={item.originalTarget} step="0.1" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
        )}
        {item.metric !== "checkbox" && (
          <div className="calculation-box field-full"><span>Первоначальный план <strong>{formatValue(item.originalTarget, item.metric, item.unit)}</strong></span><span>Исключено <strong>{formatValue(Math.max(0, item.originalTarget - target), item.metric, item.unit)}</strong></span><span>Актуальный план <strong>{formatValue(target, item.metric, item.unit)}</strong></span></div>
        )}
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
