"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { Archive, ArrowLeft, ArrowRight, CalendarDays, ChevronDown, CircleDot, MoreHorizontal, Plus, X } from "lucide-react";
import { metricLabels, priorityNameSchema, type Metric } from "@/src/modules/priorities/domain/priority";
import { monthSchema } from "../domain/monthly-plan";
import { PlanningError, type PlanningCommand, type PlanningResult } from "../application/contracts";
import type { MonthData, PlanningClient, PlanView, PriorityView } from "./client";
import { createDemoClient } from "./demo-client";
import { formatTarget, localMonth, monthTitle, readTarget, shiftMonth } from "./format";
import styles from "./month-screen.module.css";

type Editor = { mode: "add" } | { mode: "target" | "remove"; id: string } | { mode: "rename" | "archive"; id: string };
const titles = { add: "Добавить приоритет", target: "План на месяц", rename: "Название приоритета", archive: "В архив?", remove: "Убрать из месяца?" };
const errors: Record<string, string> = {
  invalid: "Проверьте введённые данные.", conflict: "План изменился. Обновите данные.",
  duplicate: "Приоритет уже добавлен в этот месяц.", archived: "Приоритет в архиве.",
  not_found: "Запись больше недоступна.", metric_mismatch: "Метрика не совпадает с приоритетом.",
  operation_reused: "Не удалось повторить сохранение. Откройте форму заново.",
  has_dependencies: "У плана есть связанные записи. Удаление недоступно.",
};

function subscribeToCalendar(change: () => void) {
  window.addEventListener("focus", change);
  return () => window.removeEventListener("focus", change);
}

export function DemoMonthScreen() {
  const [client] = useState(createDemoClient);
  const month = useSyncExternalStore(subscribeToCalendar, localMonth, () => null);
  return month ? <MonthScreen client={client} initialMonth={month} demo /> : <main className={styles.loading} aria-busy="true">Загрузка…</main>;
}

export function MonthScreen({ client, initialMonth, demo = false }: { client: PlanningClient; initialMonth: string; demo?: boolean }) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<"month" | "archive">("month");
  const [data, setData] = useState<MonthData>({ priorities: [], plans: [] });
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const retry = useRef<{ request: string; id: string } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const ready = loadedMonth === month && !loadError;
  useEffect(() => {
    let cancelled = false;
    client.load(month).then((value) => {
      if (!cancelled) { setData(value); setLoadedMonth(month); setLoadError(""); }
    }).catch(() => { if (!cancelled) setLoadError("Не удалось загрузить план."); });
    return () => { cancelled = true; };
  }, [client, month, revision]);

  function open(value: Editor) { setError(""); retry.current = null; setEditor(value); }
  function refresh() { setLoadError(""); setLoadedMonth(null); setRevision((value) => value + 1); }
  function apply(result: PlanningResult) {
    setData((current) => ({
      priorities: result.priority ? [...current.priorities.filter((p) => p.id !== result.priority!.id), result.priority] : current.priorities,
      plans: result.plan ? [...current.plans.filter((p) => p.id !== result.plan!.id), result.plan]
        : current.plans.filter((p) => p.id !== result.deletedPlanId),
    }));
  }
  async function save(command: PlanningCommand) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    const request = JSON.stringify(command);
    if (retry.current?.request !== request) retry.current = { request, id: crypto.randomUUID() };
    try {
      apply(await client.execute(retry.current.id, command));
      setEditor(null); retry.current = null;
    } catch (cause) {
      setError(cause instanceof PlanningError ? errors[cause.code] : "Не удалось сохранить. Повторите попытку.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  const plan = editor && "id" in editor ? data.plans.find((p) => p.id === editor.id) : undefined;
  const priority = editor && "id" in editor ? data.priorities.find((p) => p.id === (plan?.priorityId ?? editor.id)) : undefined;
  const rows = data.plans.map((plan) => ({ plan, priority: data.priorities.find((p) => p.id === plan.priorityId)! }))
    .filter((row) => row.priority).sort((a, b) => a.priority.name.localeCompare(b.priority.name, "ru"));
  const archived = data.priorities.filter((p) => p.archived).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><CircleDot aria-hidden="true" /> Priority</div>
      <nav aria-label="Разделы" className={styles.nav}>
        <button className={styles.navItem} aria-current={view === "month" ? "page" : undefined} disabled={busy} onClick={() => { setView("month"); setError(""); }}><CalendarDays aria-hidden="true" />Месяц</button>
        <button className={styles.navItem} aria-current={view === "archive" ? "page" : undefined} disabled={busy} onClick={() => { setView("archive"); setError(""); }}><Archive aria-hidden="true" />Архив</button>
      </nav>
      {demo && <p className={styles.demo}>Демо · до перезагрузки</p>}
    </aside>
    <main className={styles.main}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{view === "month" ? "Приоритеты месяца" : "Приоритеты"}</p><h1>{view === "month" ? monthTitle(month) : "Архив"}</h1></div>
        {view === "month" && <button ref={addButton} className={styles.primary} disabled={!ready || busy} onClick={() => open({ mode: "add" })}><Plus aria-hidden="true" />Добавить приоритет</button>}
      </header>
      {view === "month" && <div className={styles.toolbar}>
        <div className={styles.period}>
          <button className={styles.iconButton} aria-label="Предыдущий месяц" disabled={busy || month === "0001-01"} onClick={() => { setLoadError(""); setMonth(shiftMonth(month, -1)); }}><ArrowLeft /></button>
          <label className={styles.monthPicker}><span className={styles.srOnly}>Выбрать месяц</span><input type="month" aria-label="Выбрать месяц" min="0001-01" max="9999-12" value={month} disabled={busy} onChange={(event) => { if (monthSchema.safeParse(event.target.value).success) { setLoadError(""); setMonth(event.target.value); } }} /></label>
          <button className={styles.iconButton} aria-label="Следующий месяц" disabled={busy || month === "9999-12"} onClick={() => { setLoadError(""); setMonth(shiftMonth(month, 1)); }}><ArrowRight /></button>
        </div>
        <button className={styles.textButton} disabled={busy || month === initialMonth} onClick={() => { setLoadError(""); setMonth(initialMonth); }}>Текущий месяц</button>
      </div>}
      {loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondary} onClick={refresh}>Повторить</button></div>
        : !ready ? <p role="status" className={styles.loading}>Загрузка…</p>
        : view === "month" ? rows.length ? <section aria-label="План месяца" className={styles.list}>
          <div className={styles.listHeading}><span>Приоритет</span><span>План</span><span /></div>
          {rows.map(({ priority, plan }) => <div key={plan.id} className={styles.row}>
            <div className={styles.rowTitle}><span className={styles.marker} /><div><h2>{priority.name}</h2><span className={styles.meta}>{metricLabels[priority.metric.kind]}{priority.archived ? " · В архиве" : ""}</span></div></div>
            <button className={styles.target} aria-label={`Изменить план: ${priority.name}`} disabled={busy} onClick={() => open({ mode: "target", id: plan.id })}>{formatTarget(plan.target, priority.metric)}</button>
            <DropdownMenu.Root><DropdownMenu.Trigger className={styles.iconButton} aria-label={`Действия: ${priority.name}`} disabled={busy}><MoreHorizontal /></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => open({ mode: "rename", id: priority.id })}>Переименовать</DropdownMenu.Item>
                {!priority.archived && <DropdownMenu.Item className={styles.menuItem} onSelect={() => open({ mode: "archive", id: priority.id })}>В архив</DropdownMenu.Item>}
                <DropdownMenu.Separator className={styles.separator} />
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => open({ mode: "remove", id: plan.id })}>Убрать из месяца</DropdownMenu.Item>
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>)}
        </section> : <div className={styles.empty}><CalendarDays aria-hidden="true" /><h2>Пока нет приоритетов</h2><button className={styles.textButton} onClick={() => open({ mode: "add" })}>Добавить первый</button></div>
        : archived.length ? <section aria-label="Архив приоритетов" className={styles.list}>{archived.map((priority) => <div className={styles.archiveRow} key={priority.id}><div><h2>{priority.name}</h2><span className={styles.meta}>{metricLabels[priority.metric.kind]}</span></div><button className={styles.secondary} disabled={busy} onClick={() => save({ action: "archive", priorityId: priority.id, expectedVersion: priority.version, archived: false })}>Восстановить</button></div>)}</section> : <div className={styles.empty}><Archive aria-hidden="true" /><h2>Архив пуст</h2></div>}
      {error && !editor && <p role="alert" className={styles.error}>{error} <button className={styles.textButton} onClick={refresh}>Обновить данные</button></p>}
    </main>
    <Dialog.Root open={!!editor} onOpenChange={(open) => { if (!open && !busyRef.current) { setEditor(null); setError(""); } }}>
      <Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); addButton.current?.focus(); }}>
        {editor && <><div className={styles.dialogHeader}><Dialog.Title>{titles[editor.mode]}</Dialog.Title><Dialog.Close className={styles.iconButton} aria-label="Закрыть" disabled={busy}><X /></Dialog.Close></div>
          <PlanForm key={editor.mode + ("id" in editor ? editor.id : month)} editor={editor} month={month} data={data} plan={plan} priority={priority} busy={busy} ready={ready} onSave={save} />
          {error && <div className={styles.error} role="alert">{error}{error === errors.conflict && <button className={styles.textButton} onClick={refresh} disabled={busy}>Обновить данные</button>}</div>}
        </>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </div>;
}

function PlanForm({ editor, month, data, plan, priority, busy, ready, onSave }: {
  editor: Editor; month: string; data: MonthData; plan?: PlanView; priority?: PriorityView; busy: boolean; ready: boolean; onSave: (command: PlanningCommand) => Promise<void>;
}) {
  const nameHintId = useId();
  const [name, setName] = useState(priority?.name ?? "");
  const [kind, setKind] = useState<Metric["kind"]>(priority?.metric.kind ?? "time");
  const [unit, setUnit] = useState("");
  const [selected, setSelected] = useState("");
  const [hours, setHours] = useState(plan?.target.kind === "time" ? String(Math.floor(plan.target.minutes / 60)) : "");
  const [minutes, setMinutes] = useState(plan?.target.kind === "time" ? String(plan.target.minutes % 60) : "");
  const [amount, setAmount] = useState(plan && plan.target.kind !== "time" ? String(plan.target.amount).replace(".", ",") : "");
  const [validation, setValidation] = useState("");
  const existing = data.priorities.find((p) => p.id === selected);
  const actualKind = existing?.metric.kind ?? kind;
  const available = data.priorities.filter((p) => !p.archived && !data.plans.some((plan) => plan.priorityId === p.id));
  async function submit(event: FormEvent) {
    event.preventDefault(); setValidation("");
    try {
      if (editor.mode === "remove" && plan) return await onSave({ action: "remove", planId: plan.id, expectedVersion: plan.version });
      if (editor.mode === "archive" && priority) return await onSave({ action: "archive", priorityId: priority.id, expectedVersion: priority.version, archived: true });
      if (editor.mode === "rename" && priority) {
        const parsed = priorityNameSchema.safeParse(name);
        if (!parsed.success) throw new Error("Укажите название: до 120 символов.");
        return await onSave({ action: "rename", priorityId: priority.id, expectedVersion: priority.version, name: parsed.data });
      }
      const target = readTarget(actualKind, hours, minutes, amount);
      if (editor.mode === "target" && plan) return await onSave({ action: "target", planId: plan.id, expectedVersion: plan.version, target });
      if (editor.mode !== "add") throw new Error("Запись больше недоступна.");
      if (selected) {
        if (!existing || existing.archived) throw new Error("Выберите доступный приоритет.");
        return await onSave({ action: "add", priorityId: selected, month, target });
      }
      const parsed = priorityNameSchema.safeParse(name);
      if (!parsed.success) throw new Error("Укажите название: до 120 символов.");
      if (kind !== "time" && (!unit.trim() || unit.trim().length > 32)) throw new Error("Укажите единицу: до 32 символов.");
      await onSave({ action: "create", month, priority: { name: parsed.data, metric: kind === "time" ? { kind } : { kind, unit: unit.trim() } }, target });
    } catch (cause) { setValidation(cause instanceof Error ? cause.message : "Проверьте данные."); }
  }
  const amountLabel = actualKind === "quantity" ? "Количество" : "Объём";
  const unitLabel = existing?.metric.kind !== "time" && existing?.metric.unit || priority?.metric.kind !== "time" && priority?.metric.unit || unit;
  return <form onSubmit={submit} noValidate className={styles.form}>
    <fieldset disabled={busy}>
      {editor.mode === "add" && available.length > 0 && <label>Приоритет<div className={styles.selectWrap}><select value={selected} onChange={(event) => { setSelected(event.target.value); setHours(""); setMinutes(""); setAmount(""); }}><option value="">Новый приоритет</option>{available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown aria-hidden="true" /></div></label>}
      {(editor.mode === "rename" || editor.mode === "add" && !selected) && <div className={styles.fieldGroup}><label>Название<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" aria-describedby={editor.mode === "rename" ? nameHintId : undefined} /></label>{editor.mode === "rename" && <span id={nameHintId} className={styles.meta}>Во всех месяцах</span>}</div>}
      {editor.mode === "add" && !selected && <><label>Метрика<div className={styles.selectWrap}><select value={kind} onChange={(event) => setKind(event.target.value as Metric["kind"])}>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></div></label>{kind !== "time" && <label>Единица<input value={unit} maxLength={32} onChange={(event) => setUnit(event.target.value)} placeholder={kind === "quantity" ? "занятий" : "км"} /></label>}</>}
      {editor.mode === "target" && <p className={styles.subject}>{priority?.name}</p>}
      {(editor.mode === "add" || editor.mode === "target") && (actualKind === "time" ? <div className={styles.timeFields}><label>Часы<input inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></label><label>Минуты<input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" /></label></div> : <label>{amountLabel}{unitLabel ? `, ${unitLabel}` : ""}<input inputMode={actualKind === "quantity" ? "numeric" : "decimal"} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>)}
      {editor.mode === "archive" && <p>«{priority?.name}». Планы сохранятся.</p>}
      {editor.mode === "remove" && <p>«{priority?.name}» · {monthTitle(month)}</p>}
      {validation && <p className={styles.error} role="alert">{validation}</p>}
      <div className={styles.formActions}><Dialog.Close className={styles.secondary}>Отмена</Dialog.Close><button className={editor.mode === "remove" ? styles.danger : styles.primary} disabled={!ready} type="submit">{busy ? "Сохранение…" : editor.mode === "add" ? "Добавить" : editor.mode === "remove" ? "Убрать" : editor.mode === "archive" ? "В архив" : "Сохранить"}</button></div>
    </fieldset>
  </form>;
}
