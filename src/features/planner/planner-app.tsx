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
  ValueFormat,
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
  pluralize,
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
  archiveDirection,
  deleteDirection,
  directionDeletionImpact,
  isDirectionMetricUsed,
  restoreDirection,
  updateDirection,
} from "@/src/domain/planner/commands/directions";
import {
  recordCompletion,
  saveMonthPlan,
  saveWeekPlan,
} from "@/src/domain/planner/commands/plans";
import {
  PlannerProvider,
  type PlannerUpdate,
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
import { ColorPicker } from "@/src/shared/ui/color-picker/color-picker";
import { NumericInput } from "@/src/shared/ui/numeric-input/numeric-input";
import { SegmentedBar } from "@/src/widgets/schedule/segmented-bar";
import {
  navigate,
  routeFromPathname,
} from "@/src/application/navigation/routes";
import type { ModalState } from "./model/modal-state";
import { PlanRows } from "./widgets/plan-rows";
import { PlanSummary } from "./widgets/plan-summary";
import { TodayPlan } from "./widgets/today-plan";
import { PeriodReview } from "./widgets/period-review";
import { normalizePercentValues } from "@/src/domain/planner/lib/percentages";
import {
  resumePlanItem,
} from "@/src/domain/planner/commands/plan-items";
import { suggestedPlanTarget } from "@/src/domain/planner/lib/plan-targets";
import {
  defaultMetricFormat,
  normalizeDecimalPlaces,
} from "@/src/domain/planner/lib/metric-format";
import {
  defaultPauseTarget,
  pauseMonthDirection,
  pauseWeekDirection,
} from "@/src/domain/planner/commands/pauses";
import { clearWorkPeriod } from "@/src/domain/planner/commands/days";
import { selectPlanCandidates } from "@/src/domain/planner/selectors/planner-selectors";
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
    canUndo,
    undo,
    saveIssue,
    retrySave,
    resolveConflict,
    accountMigration,
    resolveAccountMigration,
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
          {saveIssue && (
            <section
              className={`sync-banner sync-banner-${saveIssue.kind}`}
              role="alert"
            >
              <Icon name="alert" size={18} />
              <div>
                <strong>
                  {saveIssue.kind === "conflict"
                    ? "Данные изменены на другом устройстве"
                    : saveIssue.kind === "local"
                      ? "Не удалось сохранить локальную копию"
                    : "Не удалось сохранить данные в облаке"}
                </strong>
                <span>
                  {saveIssue.kind === "conflict"
                    ? "Выберите, какую версию оставить."
                    : saveIssue.kind === "local"
                      ? "Проверьте доступ к хранилищу браузера и свободное место."
                    : "Локальная резервная копия сохранена на этом устройстве."}
                </span>
              </div>
              <div className="sync-banner-actions">
                {saveIssue.kind === "conflict" ? (
                  <>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => void resolveConflict("remote")}
                    >
                      Загрузить облачную
                    </Button>
                    <Button
                      size="small"
                      onClick={() => void resolveConflict("local")}
                    >
                      Сохранить текущую
                    </Button>
                  </>
                ) : (
                  <Button size="small" onClick={() => void retrySave()}>
                    Повторить
                  </Button>
                )}
              </div>
            </section>
          )}
          {route.page === "overview" && <Overview data={data} setModal={setModal} />}
          {route.page === "today" && <Today data={data} update={update} setModal={setModal} />}
          {route.page === "plans" && <PlansPage data={data} />}
          {route.page === "month" && (
            <MonthPage data={data} monthId={route.id} update={update} setModal={setModal} />
          )}
          {route.page === "week" && (
            <WeekPage data={data} weekId={route.id} update={update} setModal={setModal} />
          )}
          {route.page === "schedule" && (
            <SchedulePage
              data={data}
              update={update}
              setModal={setModal}
              editingDate={modal?.kind === "day" ? modal.date : undefined}
            />
          )}
          {route.page === "directions" && (
            <DirectionsPage data={data} setModal={setModal} update={update} />
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
          localOnly={localOnly}
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
      {accountMigration && (
        <Modal title="Перенести локальные данные?" onClose={() => resolveAccountMigration("account")}>
          <div className="migration-copy">
            <p>
              На этом устройстве есть данные гостя. Выберите, как поступить
              после входа в аккаунт.
            </p>
            <div className="migration-summary">
              <span><strong>{accountMigration.summary.directions}</strong> {pluralize(accountMigration.summary.directions, ["направление", "направления", "направлений"])}</span>
              <span><strong>{accountMigration.summary.months}</strong> {pluralize(accountMigration.summary.months, ["месяц", "месяца", "месяцев"])}</span>
              <span><strong>{accountMigration.summary.weeks}</strong> {pluralize(accountMigration.summary.weeks, ["неделя", "недели", "недель"])}</span>
              <span><strong>{accountMigration.summary.completions}</strong> {pluralize(accountMigration.summary.completions, ["выполнение", "выполнения", "выполнений"])}</span>
            </div>
            <button
              className="migration-option migration-option-primary"
              onClick={() => resolveAccountMigration("merge")}
            >
              <Icon name="cloud" size={20} />
              <span>
                <strong>Объединить данные</strong>
                <small>Сохранить облачные данные и добавить локальные</small>
              </span>
              <Badge tone="green">Рекомендуется</Badge>
            </button>
            <button
              className="migration-option"
              onClick={() => resolveAccountMigration("guest")}
            >
              <Icon name="upload" size={20} />
              <span>
                <strong>Использовать локальные</strong>
                <small>Заменить состояние аккаунта данными этого устройства</small>
              </span>
            </button>
            <button
              className="migration-option"
              onClick={() => resolveAccountMigration("account")}
            >
              <Icon name="download" size={20} />
              <span>
                <strong>Использовать облачные</strong>
                <small>Оставить локальные данные только в гостевом режиме</small>
              </span>
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={16} />
          <span>{toast}</span>
          {canUndo && (
            <button onClick={undo}>Отменить</button>
          )}
        </div>
      )}
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
  ].filter(Boolean) as { text: string; action: () => void }[];

  return (
    <>
      <PageHeader
        title="Обзор"
        eyebrow="Ваш ритм"
        description="Главное на сегодня: график, текущие планы и результаты."
        meta={<span>{dateLabel(currentDate, { weekday: "long", day: "numeric", month: "long" })}</span>}
        actions={<Button icon="plus" onClick={() => setModal({ kind: "fact", weekId })}>Внести прогресс</Button>}
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
                <Button icon="plus" variant="secondary" onClick={() => setModal({ kind: "fact", weekId })}>Внести прогресс</Button>
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

function Today({
  data,
  update,
  setModal,
}: {
  data: PlannerData;
  update: PlannerUpdate;
  setModal: (m: ModalState) => void;
}) {
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
          {day.workStart && day.workEnd && (
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
          )}
        </section>
        <section className="card">
          <div className="section-head"><h2>План недели</h2><span className="muted">{weekLabel(weekId)}</span></div>
          {week ? (
            <>
              <TodayPlan
                data={data}
                weekId={weekId}
                update={update}
                setModal={setModal}
              />
              <Button icon="plus" variant="secondary" onClick={() => setModal({ kind: "fact", weekId })}>Внести прогресс</Button>
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
  update,
  setModal,
}: {
  data: PlannerData;
  monthId: string;
  update: PlannerUpdate;
  setModal: (m: ModalState) => void;
}) {
  const month = data.months.find((item) => item.id === monthId);
  const currentWeekId = weekIdFor(new Date());
  const base = parseDate(`${monthId}-01`);
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const first = startOfWeek(addDays(base, index * 7));
    return iso(first);
  }).filter((weekId, index, array) => monthIdForWeek(weekId) === monthId && array.indexOf(weekId) === index);
  const extras = data.extraResults.filter((item) => monthIdForWeek(item.weekId) === monthId);
  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const nextMonthId = iso(next).slice(0, 7);
  return (
    <>
      <PageHeader
        title={monthName(monthId)}
        breadcrumbs={[
          { label: "Планы", onClick: () => navigate({ page: "plans" }) },
          { label: monthName(monthId) },
        ]}
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
          return (
            <button
              key={id}
              className={`${exists ? "planned" : ""} ${id === currentWeekId ? "current-week" : ""}`}
              onClick={() => navigate({ page: "week", id })}
            >
              {weekLabel(id)}
              {exists && <i />}
            </button>
          );
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
      {month && (
        <PeriodReview
          data={data}
          scope="month"
          periodId={monthId}
          items={month.items}
          status={periodStatus(monthId, "month")}
          update={update}
          canPlanNext={!data.months.some((item) => item.id === nextMonthId)}
          onPlanNext={() => setModal({ kind: "month-plan", monthId: nextMonthId })}
        />
      )}
      <section className="card extras-card">
        <div className="section-head"><h2>Дополнительные результаты</h2><Badge>{extras.length}</Badge></div>
        {extras.length ? (
          <div className="extras-list">
            {extras.map((item) => (
              <div key={item.id}>
                <span className="result-check"><Icon name="check" size={14} /></span>
                <div><strong>{item.title}</strong><span>{dateLabel(item.date)} · {weekLabel(item.weekId)}</span></div>
                <strong>{formatValue(item.value, item.metric, item.unit)}</strong>
                <IconButton
                  icon="edit"
                  size="small"
                  label={`Изменить результат: ${item.title}`}
                  onClick={() =>
                    setModal({
                      kind: "extra",
                      weekId: item.weekId,
                      resultId: item.id,
                    })
                  }
                />
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
  update,
  setModal,
}: {
  data: PlannerData;
  weekId: string;
  update: PlannerUpdate;
  setModal: (m: ModalState) => void;
}) {
  const week = data.weeks.find((item) => item.id === weekId);
  const monthId = monthIdForWeek(weekId);
  const nextWeekId = iso(addDays(parseDate(weekId), 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = iso(addDays(parseDate(weekId), index));
    return data.days.find((item) => item.date === date) ?? { date, segments: [], breaks: [] };
  });
  return (
    <>
      <PageHeader
        title={weekLabel(weekId)}
        breadcrumbs={[
          { label: "Планы", onClick: () => navigate({ page: "plans" }) },
          {
            label: monthName(monthId),
            onClick: () => navigate({ page: "month", id: monthId }),
          },
          { label: weekLabel(weekId) },
        ]}
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
              <Button onClick={() => setModal({ kind: "fact", weekId })}>Внести прогресс</Button>
            </div>
          </>
        ) : (
          <EmptyState icon="today" title="Неделя ещё не запланирована" text="Распределите месячные направления на эту неделю." action="Запланировать неделю" onAction={() => setModal({ kind: "week-plan", weekId })} />
        )}
      </section>
      {week && (
        <PeriodReview
          data={data}
          scope="week"
          periodId={weekId}
          weekId={weekId}
          items={week.items}
          status={periodStatus(weekId, "week")}
          update={update}
          canPlanNext={!data.weeks.some((item) => item.id === nextWeekId)}
          onPlanNext={() =>
            setModal({ kind: "week-plan", weekId: nextWeekId })
          }
        />
      )}
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
            <div key={item.id}>
              <span className="result-check"><Icon name="check" size={14} /></span>
              <div><strong>{item.title}</strong><span>{dateLabel(item.date)}</span></div>
              <strong>{formatValue(item.value, item.metric, item.unit)}</strong>
              <IconButton
                icon="edit"
                size="small"
                label={`Изменить результат: ${item.title}`}
                onClick={() =>
                  setModal({ kind: "extra", weekId, resultId: item.id })
                }
              />
            </div>
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
  localOnly,
}: {
  modal: Exclude<ModalState, null>;
  data: PlannerData;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
  localOnly: boolean;
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
    return <DirectionForm data={data} direction={modal.direction} close={directionClose} update={update} setModal={setModal} />;
  }
  if (modal.kind === "activity") return <ActivityForm activity={modal.activity} close={close} update={update} />;
  if (modal.kind === "day") return <DayForm data={data} date={modal.date} close={close} update={update} />;
  if (modal.kind === "work") return <WorkForm data={data} date={modal.date} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "fact") return <FactForm data={data} weekId={modal.weekId} directionId={modal.directionId} completionId={modal.completionId} close={close} update={update} setModal={setModal} />;
  if (modal.kind === "extra") return <ExtraForm data={data} weekId={modal.weekId} resultId={modal.resultId} close={close} update={update} setModal={setModal} />;
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
    return <Details data={data} {...modal} close={nestedClose} setModal={setModal} />;
  }
  if (modal.kind === "confirm") {
    const cancel = () => modal.returnTo ? setModal(modal.returnTo) : close();
    return (
      <Modal title={modal.title} onClose={cancel}>
        <div className="confirm-dialog-copy">
          <span className={modal.tone === "danger" ? "danger" : ""}>
            <Icon name="alert" size={22} />
          </span>
          <p>{modal.message}</p>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={cancel}>Отмена</Button>
          <Button
            variant={modal.tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              modal.onConfirm();
              close();
            }}
          >
            {modal.confirmLabel}
          </Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Удалить данные?" onClose={close}>
      <p className="confirm-copy">
        {localOnly
          ? "Все данные будут удалены из локального хранилища этого браузера."
          : "Все данные будут удалены из облачного хранилища и локальной резервной копии."}
      </p>
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
  data,
  direction,
  close,
  update,
  setModal,
}: {
  data: PlannerData;
  direction?: Direction;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (m: ModalState) => void;
}) {
  const normalizeUnit = (nextMetric: MetricType, nextUnit: string) => {
    if (nextMetric === "checkbox" || nextMetric === "percent") return "";
    if (nextMetric === "duration") return nextUnit === "мин." || nextUnit === "ч." ? nextUnit : "ч.";
    return nextUnit.trim() || "раз";
  };
  const [name, setName] = useState(direction?.name ?? "");
  const [description, setDescription] = useState(direction?.description ?? "");
  const [metric, setMetric] = useState<MetricType>(direction?.metric ?? "count");
  const [unit, setUnit] = useState(
    normalizeUnit(direction?.metric ?? "count", direction?.unit ?? "раз"),
  );
  const initialFormat = defaultMetricFormat(
    direction?.metric ?? "count",
    direction?.unit ?? "раз",
  );
  const [valueFormat, setValueFormat] = useState<ValueFormat>(
    direction?.valueFormat ?? initialFormat.valueFormat,
  );
  const [decimalPlaces, setDecimalPlaces] = useState(
    direction?.decimalPlaces ?? initialFormat.decimalPlaces,
  );
  const [color, setColor] = useState(direction?.color ?? "#5278d9");
  const [availability, setAvailability] = useState(direction?.availability ?? "active");
  const savedUnit = normalizeUnit(metric, unit);
  const metricUsed = direction
    ? isDirectionMetricUsed(data, direction.id)
    : false;
  const metricDefaults = defaultMetricFormat(metric, savedUnit);
  const savedValueFormat =
    metric === "count" ? valueFormat : metricDefaults.valueFormat;
  const savedDecimalPlaces = normalizeDecimalPlaces(
    savedValueFormat,
    metric === "count" ? decimalPlaces : metricDefaults.decimalPlaces,
  );
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
          description: description.trim() || undefined,
          metric: metricUsed ? nextDirection.metric : metric,
          unit: metricUsed ? nextDirection.unit : savedUnit,
          valueFormat: metricUsed
            ? nextDirection.valueFormat
            : savedValueFormat,
          decimalPlaces: metricUsed
            ? nextDirection.decimalPlaces
            : savedDecimalPlaces,
          color,
          availability,
          metricHistory:
            !metricUsed &&
            (metric !== nextDirection.metric ||
              savedUnit !== nextDirection.unit ||
              savedValueFormat !== nextDirection.valueFormat ||
              savedDecimalPlaces !== nextDirection.decimalPlaces)
            ? [
                ...nextDirection.metricHistory,
                {
                  metric,
                  unit: savedUnit,
                  valueFormat: savedValueFormat,
                  decimalPlaces: savedDecimalPlaces,
                  since: iso(new Date()).slice(0, 7),
                },
              ]
            : nextDirection.metricHistory,
        });
      }
      return addDirection(current, {
        id: uid("direction"),
        name: name.trim(),
        description: description.trim() || undefined,
        metric,
        unit: savedUnit,
        valueFormat: savedValueFormat,
        decimalPlaces: savedDecimalPlaces,
        color,
        availability: "active",
        metricHistory: [
          {
            metric,
            unit: savedUnit,
            valueFormat: savedValueFormat,
            decimalPlaces: savedDecimalPlaces,
            since: iso(new Date()).slice(0, 7),
          },
        ],
      });
    }, direction ? "Направление обновлено" : "Направление создано");
    close();
  };
  const archive = () => {
    if (!direction) return;
    update(
      (current) => archiveDirection(current, direction.id),
      "Направление архивировано",
    );
    close();
    if (routeFromPathname(window.location.pathname).page === "direction") {
      navigate({ page: "directions" });
    }
  };
  const remove = () => {
    if (!direction || direction.availability !== "archived") return;
    const impact = directionDeletionImpact(data, direction.id);
    setModal({
      kind: "confirm",
      title: "Удалить направление навсегда?",
      message:
        `Действие необратимо и изменит историю. Будут удалены направление, ${impact.months} мес. планов, ${impact.weeks} нед. планов и ${impact.completions} записей прогресса вместе с приостановками и корректировками.`,
      confirmLabel: "Удалить навсегда",
      tone: "danger",
      returnTo: { kind: "direction", direction },
      onConfirm: () => {
        update(
          (current) => deleteDirection(current, direction.id),
          "Направление удалено навсегда",
        );
        if (routeFromPathname(window.location.pathname).page === "direction") {
          navigate({ page: "directions" });
        }
      },
    });
  };
  const restore = () => {
    if (!direction) return;
    update(
      (current) => restoreDirection(current, direction.id),
      "Направление восстановлено",
    );
    close();
  };
  return (
    <Modal title={direction ? "Изменить направление" : "Новое направление"} onClose={close}>
      <form onSubmit={submit} className="form-grid">
        <label className="field field-full"><span>Название</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field field-full">
          <span>Описание</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
        <label className="field"><span>Метрика</span><select disabled={metricUsed} value={metric} onChange={(e) => {
          const nextMetric = e.target.value as MetricType;
          setMetric(nextMetric);
          const nextUnit = normalizeUnit(
            nextMetric,
            nextMetric === direction?.metric ? direction.unit : nextMetric === "count" ? "раз" : "",
          );
          setUnit(nextUnit);
          const nextFormat = defaultMetricFormat(nextMetric, nextUnit);
          setValueFormat(nextFormat.valueFormat);
          setDecimalPlaces(nextFormat.decimalPlaces);
        }}>{Object.entries(metricName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {metric === "count" && <label className="field"><span>Единица</span><input disabled={metricUsed} value={unit} onChange={(e) => setUnit(e.target.value)} required /></label>}
        {metric === "duration" && <label className="field"><span>Единица</span><select disabled={metricUsed} value={savedUnit} onChange={(e) => {
          const nextUnit = e.target.value;
          setUnit(nextUnit);
          const nextFormat = defaultMetricFormat(metric, nextUnit);
          setValueFormat(nextFormat.valueFormat);
          setDecimalPlaces(nextFormat.decimalPlaces);
        }}><option value="ч.">ч.</option><option value="мин.">мин.</option></select></label>}
        {metric === "count" && (
          <label className="field">
            <span>Формат значения</span>
            <select
              disabled={metricUsed}
              value={valueFormat}
              onChange={(event) => {
                const next = event.target.value as ValueFormat;
                setValueFormat(next);
                setDecimalPlaces(next === "decimal" ? 1 : 0);
              }}
            >
              <option value="integer">Целое</option>
              <option value="decimal">Дробное</option>
            </select>
          </label>
        )}
        {savedValueFormat === "decimal" && metric === "count" && (
          <label className="field">
            <span>Знаков после запятой</span>
            <select
              disabled={metricUsed}
              value={savedDecimalPlaces}
              onChange={(event) =>
                setDecimalPlaces(Number(event.target.value))
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        )}
        {metricUsed && (
          <p className="inline-message field-full">
            Метрику нельзя изменить, потому что она уже используется в планах или результатах
          </p>
        )}
        <ColorPicker value={color} onChange={setColor} />
        {direction && direction.availability !== "archived" && <label className="field"><span>Доступность</span><select value={availability} onChange={(e) => setAvailability(e.target.value as Direction["availability"])}><option value="active">Активно</option><option value="paused">Приостановлено</option></select></label>}
        <div className="modal-actions field-full">
          {direction?.availability === "archived" ? (
            <>
              <Button variant="danger" type="button" onClick={remove}>Удалить навсегда</Button>
              <Button icon="upload" variant="secondary" type="button" onClick={restore}>Восстановить</Button>
            </>
          ) : direction ? (
            <Button variant="secondary" type="button" onClick={archive}>Архивировать</Button>
          ) : null}
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
  return (
    <Modal title={activity ? "Изменить тип деятельности" : "Новый тип деятельности"} onClose={close}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        update((current) => ({
          ...current,
          activityTypes: activity
            ? current.activityTypes.map((item) => item.id === activity.id ? { ...item, name: name.trim(), color } : item)
            : [...current.activityTypes, { id: uid("activity"), name: name.trim(), color, icon: "circle", order: current.activityTypes.length + 1, archived: false }],
        }), activity ? "Тип обновлён" : "Тип создан");
        close();
      }}>
        <label className="field field-full"><span>Название</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <ColorPicker value={color} onChange={setColor} />
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
  const totalIsValid = Math.abs(total - 100) < 0.001;
  const activeTypes = data.activityTypes.filter((item) => !item.archived);
  const hasDuplicates =
    new Set(segments.map((item) => item.activityId)).size !== segments.length;
  const unusedType = activeTypes.find(
    (item) => !segments.some((segment) => segment.activityId === item.id),
  );
  if (!activeTypes.length && !current?.segments.length) {
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
        if (
          !totalIsValid ||
          hasDuplicates ||
          segments.some((item) => item.percent <= 0)
        ) return;
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
                {data.activityTypes
                  .filter(
                    (item) =>
                      !item.archived || item.id === segment.activityId,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.archived ? " — архив" : ""}
                    </option>
                  ))}
              </select>
              <div className="percent-input">
                <NumericInput
                  aria-label="Доля типа деятельности"
                  min={0}
                  max={100}
                  required
                  value={segment.percent}
                  onValueChange={(value) =>
                    setSegments((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, percent: value }
                          : item,
                      ),
                    )
                  }
                />
                <span>%</span>
              </div>
              <IconButton type="button" icon="x" label="Удалить сегмент" disabled={segments.length === 1} onClick={() => setSegments((items) => items.filter((_, itemIndex) => itemIndex !== index))} />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="add-line"
          disabled={!unusedType}
          onClick={() =>
            unusedType &&
            setSegments((items) => [
              ...items,
              { activityId: unusedType.id, percent: 0 },
            ])
          }
        >
          <Icon name="plus" size={15} />Добавить сегмент
        </button>
        <div className={`sum-line ${totalIsValid ? "valid" : "invalid"}`}><span>Сумма</span><strong>{total}%</strong></div>
        {!totalIsValid && (
          <div className="normalize-row">
            <p className="form-error">Сумма должна составлять 100%</p>
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={total <= 0}
              onClick={() => {
                const normalized = normalizePercentValues(
                  segments.map((item) => item.percent),
                );
                setSegments((items) =>
                  items.map((item, index) => ({
                    ...item,
                    percent: normalized[index],
                  })),
                );
              }}
            >
              Нормализовать до 100%
            </Button>
          </div>
        )}
        {hasDuplicates && <p className="form-error">Каждый тип деятельности можно добавить только один раз</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={close}>Отмена</Button><Button disabled={!totalIsValid || hasDuplicates}>Сохранить</Button></div>
      </form>
    </Modal>
  );
}

function WorkForm({
  data,
  date,
  close,
  update,
  setModal,
}: {
  data: PlannerData;
  date: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (modal: ModalState) => void;
}) {
  const day = data.days.find((item) => item.date === date);
  const [start, setStart] = useState(day?.workStart ?? "12:30");
  const [end, setEnd] = useState(day?.workEnd ?? "22:30");
  const [breaks, setBreaks] = useState(day?.breaks.map((item) => ({ ...item })) ?? []);
  const draft: DayPlan = { date, segments: day?.segments ?? [], workStart: start, workEnd: end, breaks };
  const mins = workMinutes(draft);
  const workStart = toMinutes(start);
  const workEnd = toMinutes(end);
  const orderedBreaks = [...breaks].sort(
    (left, right) => toMinutes(left.start) - toMinutes(right.start),
  );
  const valid =
    workEnd > workStart &&
    orderedBreaks.every((item, index) => {
      const breakStart = toMinutes(item.start);
      const breakEnd = toMinutes(item.end);
      const previous = orderedBreaks[index - 1];
      return (
        breakStart >= workStart &&
        breakEnd <= workEnd &&
        breakEnd > breakStart &&
        (!previous || breakStart >= toMinutes(previous.end))
      );
    }) &&
    mins.net > 0;
  const removeWorkPeriod = () => {
    if (!day?.workStart && !day?.workEnd) return;
    const remove = (clearBreaks: boolean) => {
      update(
        (state) => clearWorkPeriod(state, date, clearBreaks),
        "Рабочий период убран",
      );
      close();
    };
    if (!day.breaks.length) {
      remove(false);
      return;
    }
    setModal({
      kind: "confirm",
      title: "Убрать рабочий период?",
      message:
        `В рабочем периоде ${day.breaks.length} перерывов. Они не могут существовать без рабочего периода и также будут удалены.`,
      confirmLabel: "Убрать период и перерывы",
      tone: "danger",
      returnTo: { kind: "work", date },
      onConfirm: () => remove(true),
    });
  };
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
        <div className="modal-actions">
          {(day?.workStart || day?.workEnd) && (
            <Button variant="danger" type="button" onClick={removeWorkPeriod}>
              Убрать рабочий период
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={close}>Отмена</Button>
          <Button disabled={!valid}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
}

function FactForm({
  data,
  weekId,
  directionId,
  completionId,
  close,
  update,
  setModal,
}: {
  data: PlannerData;
  weekId: string;
  directionId?: string;
  completionId?: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (modal: ModalState) => void;
}) {
  const week = data.weeks.find((item) => item.id === weekId);
  const available = week?.items ?? [];
  const existing = data.completions.find((item) => item.id === completionId);
  const [selectedId, setSelectedId] = useState(
    existing?.directionId ?? directionId ?? available[0]?.directionId ?? "",
  );
  const item = available.find((entry) => entry.directionId === selectedId);
  const selectedDirection = data.directions.find(
    (entry) => entry.id === selectedId,
  );
  const [value, setValue] = useState(existing?.value ?? 1);
  const [date, setDate] = useState(() => {
    if (existing) return existing.date;
    const today = iso(new Date());
    return today >= weekId && today <= iso(addDays(parseDate(weekId), 6)) ? today : weekId;
  });
  return (
    <Modal title={existing ? "Изменить прогресс" : "Внести прогресс"} onClose={close}>
      {!week || !available.length ? (
        <EmptyState
          icon="today"
          title="Нет недельного плана"
          text="Сначала добавьте хотя бы одно направление в план недели."
          action="Закрыть"
          onAction={close}
        />
      ) : (
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          if (!item || value <= 0) return;
          update(
            (current) => {
              const completion = {
                id: existing?.id ?? uid("completion"),
                directionId: selectedId,
                weekId,
                date,
                value: item.metric === "checkbox" ? 1 : value,
              };
              return existing
                ? {
                    ...current,
                    completions: current.completions.map((entry) =>
                      entry.id === existing.id ? completion : entry,
                    ),
                  }
                : recordCompletion(current, completion);
            },
            existing ? "Прогресс обновлён" : "Прогресс добавлен",
          );
          close();
        }}>
          <label className="field field-full"><span>Направление</span><select disabled={Boolean(existing)} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{available.map((entry) => <option key={entry.directionId} value={entry.directionId}>{data.directions.find((item) => item.id === entry.directionId)?.name}</option>)}</select></label>
          {item?.metric === "checkbox" ? (
            <label className="field checkbox-field"><input type="checkbox" checked readOnly /><span>Выполнено</span></label>
          ) : (
            <label className="field">
              <span>{item?.metric === "percent" ? "Текущий процент" : "Добавить"}{item?.unit && `, ${item.unit}`}</span>
              <NumericInput
                min={0.1}
                value={value}
                onValueChange={setValue}
                allowDecimal={selectedDirection?.valueFormat === "decimal"}
                decimalPlaces={selectedDirection?.decimalPlaces ?? 0}
                required
              />
            </label>
          )}
          <label className="field"><span>Дата</span><input type="date" min={weekId} max={iso(addDays(parseDate(weekId), 6))} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <div className="modal-actions field-full">
            {existing && (
              <Button
                variant="danger"
                type="button"
                onClick={() =>
                  setModal({
                    kind: "confirm",
                    title: "Удалить запись выполнения?",
                    message: "Прогресс планов будет пересчитан.",
                    confirmLabel: "Удалить",
                    tone: "danger",
                    returnTo: { kind: "fact", weekId, completionId: existing.id },
                    onConfirm: () =>
                      update(
                        (current) => ({
                          ...current,
                          completions: current.completions.filter(
                            (entry) => entry.id !== existing.id,
                          ),
                        }),
                        "Выполнение удалено",
                      ),
                  })
                }
              >
                Удалить
              </Button>
            )}
            <Button variant="secondary" type="button" onClick={close}>Отмена</Button>
            <Button>{existing ? "Сохранить" : "Добавить"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ExtraForm({
  data,
  weekId,
  resultId,
  close,
  update,
  setModal,
}: {
  data: PlannerData;
  weekId: string;
  resultId?: string;
  close: () => void;
  update: (r: (d: PlannerData) => PlannerData, m?: string) => void;
  setModal: (modal: ModalState) => void;
}) {
  const existing = data.extraResults.find((item) => item.id === resultId);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [metric, setMetric] = useState<MetricType>(existing?.metric ?? "checkbox");
  const [unit, setUnit] = useState(existing?.unit || "раз");
  const [value, setValue] = useState(existing?.value ?? 1);
  const [date, setDate] = useState(existing?.date ?? weekId);
  const extraFormat = defaultMetricFormat(metric, unit);
  return (
    <Modal title={existing ? "Изменить результат" : "Дополнительный результат"} onClose={close}>
      <p className="form-intro">
        Запишите важный результат, который не входил в недельный план.
      </p>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || (metric !== "checkbox" && value <= 0)) return;
        update((current) => {
          const result = { id: existing?.id ?? uid("result"), weekId, title: title.trim(), metric, unit: metric === "checkbox" || metric === "percent" ? "" : unit.trim(), value: metric === "checkbox" ? 1 : value, date };
          return {
            ...current,
            extraResults: existing
              ? current.extraResults.map((item) => item.id === existing.id ? result : item)
              : [...current.extraResults, result],
          };
        }, existing ? "Результат обновлён" : "Результат добавлен");
        close();
      }}>
        <label className="field field-full"><span>Название результата</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="field"><span>Метрика</span><select value={metric} onChange={(e) => setMetric(e.target.value as MetricType)}>{Object.entries(metricName).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {metric !== "checkbox" && metric !== "percent" && <label className="field"><span>Единица</span><input value={unit} onChange={(e) => setUnit(e.target.value)} required /></label>}
        {metric !== "checkbox" && <label className="field"><span>Значение</span><NumericInput min={0.1} value={value} onValueChange={setValue} allowDecimal={extraFormat.valueFormat === "decimal"} decimalPlaces={extraFormat.decimalPlaces} required /></label>}
        <label className="field"><span>Дата</span><input type="date" min={weekId} max={iso(addDays(parseDate(weekId), 6))} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <div className="modal-actions field-full">
          {existing && (
            <Button
              variant="danger"
              type="button"
              onClick={() =>
                setModal({
                  kind: "confirm",
                  title: "Удалить дополнительный результат?",
                  message: "Результат исчезнет из итогов недели и месяца.",
                  confirmLabel: "Удалить",
                  tone: "danger",
                  returnTo: { kind: "extra", weekId, resultId: existing.id },
                  onConfirm: () =>
                    update(
                      (current) => ({
                        ...current,
                        extraResults: current.extraResults.filter(
                          (item) => item.id !== existing.id,
                        ),
                      }),
                      "Результат удалён",
                    ),
                })
              }
            >
              Удалить
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={close}>Отмена</Button>
          <Button>{existing ? "Сохранить" : "Добавить"}</Button>
        </div>
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
  const existing = scope === "month"
    ? data.months.find((item) => item.id === id)
    : data.weeks.find((item) => item.id === id);
  const monthId = scope === "month" ? id : monthIdForWeek(id);
  const month = data.months.find((item) => item.id === monthId);
  const candidates = selectPlanCandidates(data, scope, monthId);
  const metricForDirection = (directionId: string) => {
    const direction = data.directions.find((item) => item.id === directionId);
    return {
      metric: direction?.metric,
      unit: direction?.unit ?? "",
      valueFormat: direction?.valueFormat ?? "integer",
      decimalPlaces: direction?.decimalPlaces ?? 0,
    };
  };
  const previousId =
    scope === "month"
      ? iso(
          new Date(
            parseDate(`${id}-01`).getFullYear(),
            parseDate(`${id}-01`).getMonth() - 1,
            1,
          ),
        ).slice(0, 7)
      : iso(addDays(parseDate(id), -7));
  const previousPlan =
    scope === "month"
      ? data.months.find((item) => item.id === previousId)
      : data.weeks.find((item) => item.id === previousId);
  const suggestedTarget = (directionId: string) => {
    const metric = metricForDirection(directionId).metric;
    const previous = previousPlan?.items.find(
      (item) => item.directionId === directionId,
    );
    const monthItem = month?.items.find(
      (item) => item.directionId === directionId,
    );
    return suggestedPlanTarget({
      metric,
      scope,
      previousTarget: previous?.target,
      monthTarget: monthItem?.target,
    });
  };
  const [rows, setRows] = useState<{ directionId: string; target: number }[]>(
    existing?.items.map((item) => ({
      directionId: item.directionId,
      target: item.target,
    })) ?? [],
  );
  const [step, setStep] = useState<"directions" | "targets" | "review">(
    existing ? "targets" : "directions",
  );
  const canBeZero = (directionId: string) =>
    Boolean(
      existing?.items.find(
        (item) => item.directionId === directionId && item.paused,
      ),
    );
  const invalidTargets = rows.some(
    (row) => row.target < 0 || (row.target === 0 && !canBeZero(row.directionId)),
  );
  const toggleDirection = (directionId: string) => {
    setRows((current) =>
      current.some((item) => item.directionId === directionId)
        ? current.filter((item) => item.directionId !== directionId)
        : [
            ...current,
            { directionId, target: suggestedTarget(directionId) },
          ],
    );
  };
  const copyPrevious = () => {
    if (!previousPlan) return;
    const next = previousPlan.items.flatMap((item) =>
      candidates.some((candidate) => candidate.id === item.directionId)
        ? [{
            directionId: item.directionId,
            target:
              item.target > 0
                ? item.target
                : suggestedTarget(item.directionId),
          }]
        : [],
    );
    setRows(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !rows.length ||
      rows.some(
        (row) =>
          row.target < 0 ||
          (row.target === 0 && !canBeZero(row.directionId)) ||
          !row.directionId,
      )
    ) return;
    const oldItems = existing?.items ?? [];
    const items = rows.map((row) => {
      const old = oldItems.find((item) => item.directionId === row.directionId);
      const direction = data.directions.find((item) => item.id === row.directionId)!;
      const metric = direction.metric;
      const planUnit = metric === "checkbox" || metric === "percent"
        ? ""
        : direction.unit;
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
          <div className="plan-steps" aria-label="Этапы планирования">
            {[
              ["directions", "1", "Направления"],
              ["targets", "2", "Цели"],
              ["review", "3", "Проверка"],
            ].map(([value, number, label]) => (
              <span
                key={value}
                className={
                  step === value ||
                  (value === "directions" && step !== "directions") ||
                  (value === "targets" && step === "review")
                    ? "active"
                    : ""
                }
              >
                <i>{number}</i>{label}
              </span>
            ))}
          </div>
          {step === "directions" && (
            <>
              <div className="plan-wizard-head">
                <div>
                  <h3>Что включить в план?</h3>
                  <p>Выберите только те направления, которыми хотите заниматься в этом периоде.</p>
                </div>
                {previousPlan && (
                  <Button type="button" size="small" variant="secondary" icon="copy" onClick={copyPrevious}>
                    Скопировать предыдущий
                  </Button>
                )}
              </div>
              <div className="direction-picker">
                {candidates.map((direction) => {
                  const selected = rows.some(
                    (item) => item.directionId === direction.id,
                  );
                  const previous = previousPlan?.items.find(
                    (item) => item.directionId === direction.id,
                  );
                  return (
                    <button
                      type="button"
                      key={direction.id}
                      className={selected ? "selected" : ""}
                      onClick={() => toggleDirection(direction.id)}
                      aria-pressed={selected}
                    >
                      <span
                        className="direction-dot"
                        style={{ background: direction.color }}
                      />
                      <span>
                        <strong>{direction.name}</strong>
                        <small>
                          {metricName[direction.metric]}
                          {direction.unit && ` · ${direction.unit}`}
                          {previous && ` · ранее ${formatValue(previous.target, previous.metric, previous.unit)}`}
                        </small>
                      </span>
                      <i>{selected && <Icon name="check" size={14} />}</i>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step === "targets" && (
            <>
              <div className="plan-wizard-head">
                <div>
                  <h3>Задайте ориентиры</h3>
                  <p>Предложения основаны на предыдущем периоде и плане месяца.</p>
                </div>
              </div>
              <div className="plan-editor">
                {rows.map((row, index) => {
                  const direction = data.directions.find(
                    (item) => item.id === row.directionId,
                  );
                  const rowMetric = metricForDirection(row.directionId);
                  return (
                    <div key={`${row.directionId}-${index}`}>
                      <div className="plan-direction-copy">
                        <span
                          className="direction-dot"
                          style={{ background: direction?.color }}
                        />
                        <strong>{direction?.name}</strong>
                      </div>
                      <span className="metric-label">
                        {rowMetric.metric
                          ? `${metricName[rowMetric.metric]}${rowMetric.unit ? ` · ${rowMetric.unit}` : ""}`
                          : ""}
                      </span>
                      {rowMetric.metric === "checkbox" ? (
                        <span className="checkbox-plan-target">Отметка</span>
                      ) : (
                        <NumericInput
                          aria-label={`План: ${direction?.name}`}
                          min={canBeZero(row.directionId) ? 0 : 0.1}
                          allowDecimal={rowMetric.valueFormat === "decimal"}
                          decimalPlaces={rowMetric.decimalPlaces}
                          value={row.target}
                          onValueChange={(value) =>
                            setRows((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, target: value }
                                  : item,
                              ),
                            )
                          }
                        />
                      )}
                      <IconButton type="button" icon="x" label="Убрать направление" onClick={() => setRows((items) => items.filter((_, itemIndex) => itemIndex !== index))} />
                    </div>
                  );
                })}
              </div>
              {invalidTargets && (
                <p className="form-error">
                  Плановое значение должно быть больше нуля
                </p>
              )}
            </>
          )}
          {step === "review" && (
            <div className="plan-review">
              <div className="plan-wizard-head">
                <div>
                  <h3>Проверьте план</h3>
                  <p>
                    {rows.length} {pluralize(rows.length, ["направление", "направления", "направлений"])}. После сохранения значения можно будет изменить.
                  </p>
                </div>
              </div>
              {rows.map((row) => {
                const direction = data.directions.find(
                  (item) => item.id === row.directionId,
                );
                const metric = metricForDirection(row.directionId);
                const previous = existing?.items.find(
                  (item) => item.directionId === row.directionId,
                );
                return (
                  <div key={row.directionId}>
                    <span className="direction-dot" style={{ background: direction?.color }} />
                    <strong>{direction?.name}</strong>
                    <span>
                      {previous && previous.target !== row.target && (
                        <del>{formatValue(previous.target, previous.metric, previous.unit)}</del>
                      )}
                      {formatValue(row.target, metric.metric ?? "count", metric.unit)}
                    </span>
                  </div>
                );
              })}
              {existing && periodStatus(id, scope) !== (scope === "month" ? "Будущий" : "Будущая") && (
                <p className="plan-change-note">
                  <Icon name="alert" size={16} />
                  Прогресс периода будет пересчитан по новым значениям. Изменение можно отменить после сохранения.
                </p>
              )}
            </div>
          )}
          <div className="modal-actions">
            {step === "directions" ? (
              <Button variant="secondary" type="button" onClick={close}>Отмена</Button>
            ) : (
              <Button variant="secondary" type="button" onClick={() => setStep(step === "review" ? "targets" : "directions")}>Назад</Button>
            )}
            {step === "review" ? (
              <Button disabled={!rows.length || invalidTargets}>Сохранить план</Button>
            ) : (
              <Button
                type="button"
                disabled={!rows.length || invalidTargets}
                trailingIcon="arrow-right"
                onClick={() => setStep(step === "directions" ? "targets" : "review")}
              >
                Продолжить
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

function findPlan(data: PlannerData, scope: "month" | "week", planId: string) {
  return scope === "month" ? data.months.find((item) => item.id === planId) : data.weeks.find((item) => item.id === planId);
}

function currentPlanMetric(direction: Direction) {
  return {
    metric: direction.metric,
    unit: direction.metric === "checkbox" || direction.metric === "percent"
      ? ""
      : direction.unit,
    valueFormat: direction.valueFormat,
    decimalPlaces: direction.decimalPlaces,
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
  const planMetric = currentPlanMetric(direction);
  const savedTarget = planMetric.metric === "checkbox" ? 1 : target;
  const replaceItem = (current: PlannerData, nextItems: PlanItem[]) =>
    scope === "month"
      ? {
          ...current,
          months: nextItems.length
            ? current.months.map((entry) =>
                entry.id === planId ? { ...entry, items: nextItems } : entry,
              )
            : current.months.filter((entry) => entry.id !== planId),
        }
      : {
          ...current,
          weeks: nextItems.length
            ? current.weeks.map((entry) =>
                entry.id === planId ? { ...entry, items: nextItems } : entry,
              )
            : current.weeks.filter((entry) => entry.id !== planId),
        };
  return (
    <Modal title={direction.name} onClose={close}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (savedTarget < 0 || (savedTarget === 0 && !item.paused)) return;
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
          <label className="field"><span>План, {planMetric.metric === "percent" ? "%" : planMetric.unit || metricName[planMetric.metric].toLowerCase()}</span><NumericInput min={item.paused ? 0 : 0.1} value={target} onValueChange={setTarget} allowDecimal={planMetric.valueFormat === "decimal"} decimalPlaces={planMetric.decimalPlaces} required /></label>
        )}
        {periodStatus(planId, scope) !== (scope === "month" ? "Будущий" : "Будущая") && (
          <p className="plan-change-note">
            <Icon name="alert" size={16} />
            Прогресс будет пересчитан. После сохранения изменение можно отменить.
          </p>
        )}
        <div className="action-list">
          <button type="button" onClick={() => setModal({ kind: "pause", scope, planId, itemId, returnToEdit: true })}>{item.paused ? "Изменить приостановку" : scope === "month" ? "Приостановить до конца месяца" : "Приостановить на неделю"}<Icon name="arrow-right" size={15} /></button>
          {item.paused && <button type="button" onClick={() => {
            update((current) => {
              const currentPlan = findPlan(current, scope, planId)!;
              return replaceItem(current, currentPlan.items.map((entry) => {
                if (entry.id !== itemId) return entry;
                return resumePlanItem(entry, iso(new Date()));
              }));
            }, "Направление возобновлено");
            close();
          }}>Возобновить<Icon name="arrow-right" size={15} /></button>}
          <button type="button" onClick={() => setModal({ kind: "details", scope, planId, itemId, returnToEdit: true })}>Подробности<Icon name="arrow-right" size={15} /></button>
          {scope === "week" && <button type="button" className="danger-link" onClick={() => {
            setModal({
              kind: "confirm",
              title: "Убрать направление из недели?",
              message:
                "Месячный план и история направления останутся без изменений.",
              confirmLabel: "Убрать из недели",
              tone: "danger",
              returnTo: { kind: "edit-item", scope, planId, itemId },
              onConfirm: () => {
                update((current) => {
                  const currentPlan = findPlan(current, scope, planId)!;
                  return replaceItem(current, currentPlan.items.filter((entry) => entry.id !== itemId));
                }, "Направление удалено из недельного плана");
              },
            });
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
  const [target, setTarget] = useState(
    item?.paused
      ? item.target
      : defaultPauseTarget(data, scope, planId, itemId),
  );
  if (!item) return null;
  const reasons = ["Болезнь", "Отпуск или поездка", "Внешние обстоятельства", "Ожидание другого человека", "Изменение доступности", "Изменение приоритетов", "Другое"];
  return (
    <Modal title={scope === "month" ? "Приостановить до конца месяца" : "Приостановить на неделю"} onClose={close}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        update(
          (current) => {
            const payload = {
              itemId,
              target,
              reason,
              details: reason === "Другое" ? details : undefined,
              date: iso(new Date()),
            };
            return scope === "month"
              ? pauseMonthDirection(current, {
                  ...payload,
                  monthId: planId,
                })
              : pauseWeekDirection(current, {
                  ...payload,
                  weekId: planId,
                });
          },
          "Приостановка сохранена",
        );
        close();
      }}>
        <label className="field field-full"><span>Причина</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label>
        {reason === "Другое" && <label className="field field-full"><span>Уточнение</span><input value={details} onChange={(e) => setDetails(e.target.value)} required /></label>}
        {item.metric === "checkbox" ? (
          <div className="calculation-box field-full">
            <span>Актуальный план <strong>{target > 0 ? "Отметка" : "0"}</strong></span>
          </div>
        ) : (
          <label className="field field-full"><span>Актуальный план</span><NumericInput min={0} max={item.originalTarget} value={target} onValueChange={setTarget} allowDecimal={data.directions.find((direction) => direction.id === item.directionId)?.valueFormat === "decimal"} decimalPlaces={data.directions.find((direction) => direction.id === item.directionId)?.decimalPlaces ?? 0} required /></label>
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
  setModal,
}: {
  data: PlannerData;
  scope: "month" | "week";
  planId: string;
  itemId: string;
  close: () => void;
  setModal: (modal: ModalState) => void;
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
      {entries.length ? (
        <div className="history-list">
          {entries.map((entry) => (
            <div key={entry.id}>
              <span>{dateLabel(entry.date)}</span>
              <strong>{formatValue(entry.value, item.metric, item.unit)}</strong>
              <IconButton
                icon="edit"
                size="small"
                label={`Изменить выполнение за ${dateLabel(entry.date)}`}
                onClick={() =>
                  setModal({
                    kind: "fact",
                    weekId: entry.weekId,
                    completionId: entry.id,
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : <p className="compact-empty">Нет записей выполнения</p>}
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
