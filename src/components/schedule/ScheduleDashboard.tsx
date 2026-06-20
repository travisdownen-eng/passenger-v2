import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileWarning,
  GripVertical,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { patientsQuery } from "@/lib/queries";
import {
  addDays,
  buildSchedule,
  formatDayLong,
  isRecentlyAdded,
  today,
  toISODate,
  type Visit,
  type VisitType,
} from "@/lib/visits";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

/** Sunday-anchored start of the Medicare week containing `d`. */
function startOfMedicareWeek(d: Date): Date {
  const dow = d.getUTCDay(); // 0=Sun
  return addDays(d, -dow);
}

export function ScheduleDashboard() {
  const { data: patients } = useSuspenseQuery(patientsQuery());
  const visits = useMemo(() => buildSchedule(patients), [patients]);

  const t = today();
  const todayISO = toISODate(t);
  const currentWeekStart = startOfMedicareWeek(t);
  const nextWeekStart = addDays(currentWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  const overdue = visits
    .filter((v) => v.status === "documentation_overdue")
    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));

  // Treat "needs_scheduling" visits as plotted scheduled visits in this workflow.
  const dayBuckets = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const v of visits) {
      if (v.status !== "scheduled" && v.status !== "needs_scheduling") continue;
      const arr = map.get(v.date) ?? [];
      arr.push(v);
      map.set(v.date, arr);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.patientName.localeCompare(b.patientName));
      map.set(k, arr);
    }
    return map;
  }, [visits]);

  // Per-day visit order (drag-and-drop personal organization).
  const [order, setOrder] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setOrder((prev) => {
      const next = { ...prev };
      for (const [date, arr] of dayBuckets) {
        if (!next[date]) next[date] = arr.map((v) => v.id);
      }
      return next;
    });
  }, [dayBuckets]);

  // Seen-days tracking for the "new unseen visit" dot indicator.
  const [seenDays, setSeenDays] = useState<Record<string, boolean>>({});
  const markDaySeen = (iso: string) =>
    setSeenDays((prev) => (prev[iso] ? prev : { ...prev, [iso]: true }));

  const orderedDayVisits = (date: string): Visit[] => {
    const arr = dayBuckets.get(date) ?? [];
    const ord = order[date];
    if (!ord) return arr;
    const byId = new Map(arr.map((v) => [v.id, v]));
    const out: Visit[] = [];
    for (const id of ord) {
      const v = byId.get(id);
      if (v) {
        out.push(v);
        byId.delete(id);
      }
    }
    for (const v of byId.values()) out.push(v);
    return out;
  };

  const reorderDay = (date: string, fromId: string, toId: string) => {
    setOrder((prev) => {
      const current = prev[date] ?? (dayBuckets.get(date) ?? []).map((v) => v.id);
      if (fromId === toId) return prev;
      const arr = [...current];
      const from = arr.indexOf(fromId);
      const to = arr.indexOf(toId);
      if (from === -1 || to === -1) return prev;
      arr.splice(from, 1);
      arr.splice(to, 0, fromId);
      return { ...prev, [date]: arr };
    });
  };

  const currentWeekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)).filter(
    (d) => toISODate(d) >= todayISO,
  );
  const nextWeekDays = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));


  return (
    <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      <Header
        todayISO={todayISO}
        dayBuckets={dayBuckets}
        overdueCount={overdue.length}
        currentWeekStart={currentWeekStart}
        nextWeekEnd={nextWeekEnd}
      />

      {overdue.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
        >
          <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-destructive">
              ⚠ {overdue.length} overdue note{overdue.length === 1 ? "" : "s"} require completion
            </div>
            <div className="text-destructive/80 mt-0.5">
              Resolve oldest first to stay compliant with payer documentation windows.
            </div>
          </div>
        </div>
      )}

      <OverdueSection visits={overdue} />

      <WeekSection
        title="Current Week"
        rangeLabel={`${formatRange(t)} – ${formatRange(addDays(currentWeekStart, 6))}`}
        days={currentWeekDays}
        todayISO={todayISO}
        weekTone="current"
        getDayVisits={orderedDayVisits}
        onReorder={reorderDay}
        seenDays={seenDays}
        onMarkSeen={markDaySeen}
      />

      <WeekSection
        title="Next Week"
        rangeLabel={`${formatRange(nextWeekStart)} – ${formatRange(nextWeekEnd)}`}
        days={nextWeekDays}
        todayISO={todayISO}
        weekTone="next"
        getDayVisits={orderedDayVisits}
        onReorder={reorderDay}
        seenDays={seenDays}
        onMarkSeen={markDaySeen}
      />

    </div>
  );
}

function formatRange(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Header({
  todayISO,
  dayBuckets,
  overdueCount,
  currentWeekStart,
  nextWeekEnd,
}: {
  todayISO: string;
  dayBuckets: Map<string, Visit[]>;
  overdueCount: number;
  currentWeekStart: Date;
  nextWeekEnd: Date;
}) {
  const t = today();
  const todayCount = dayBuckets.get(todayISO)?.length ?? 0;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Clinician command center
        </div>
        <h1 className="text-2xl font-display font-semibold tracking-tight mt-1">
          Schedule · {formatDayLong(t)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Medicare week view · {formatRange(currentWeekStart)} – {formatRange(nextWeekEnd)}
        </p>
      </div>
      <div className="flex gap-3">
        <Stat label="Today" value={todayCount} tone="default" />
        <Stat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "danger" : "default"} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 rounded-lg border min-w-[88px]",
        tone === "danger" ? "border-destructive/40 bg-destructive/10" : "border-border bg-card",
      )}
    >
      <div
        className={cn(
          "text-2xl font-display font-semibold",
          tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
  hint,
}: {
  title: string;
  icon: typeof FileWarning;
  count?: number;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-sm tracking-tight">{title}</h2>
          {count != null && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {count}
            </span>
          )}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

function overdueToneClass(days: number): string {
  if (days >= 6) return "bg-destructive/15 text-destructive border-destructive/40";
  if (days >= 3) return "bg-warning/20 text-warning-foreground border-warning/40";
  return "bg-info/15 text-info border-info/30";
}

function VisitTypeChip({ type }: { type: VisitType }) {
  const map: Record<VisitType, { cls: string; label: string }> = {
    SOC: {
      cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40",
      label: "SOC",
    },
    ROC: {
      cls: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/40",
      label: "ROC",
    },
    Reassessment: {
      cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40",
      label: "Reassessment",
    },
    Recert: {
      cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/40",
      label: "Recertification",
    },
    Discharge: {
      cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40",
      label: "Agency Discharge",
    },
    DisciplineDischarge: {
      cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40",
      label: "Discipline Discharge",
    },
    Subsequent: {
      cls: "bg-muted text-muted-foreground border-border",
      label: "Subsequent Visit",
    },
    PRN: {
      cls: "bg-secondary text-secondary-foreground border-border",
      label: "PRN",
    },
  };
  const { cls, label } = map[type];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function ActionIndicator({ status }: { status: Visit["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
        <CheckCircle2 className="size-3.5" />
        Documentation Complete
      </span>
    );
  }
  if (status === "documentation_overdue") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertTriangle className="size-3.5" />
        Documentation Due
      </span>
    );
  }
  if (status === "missed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertTriangle className="size-3.5" />
        Missed Visit
      </span>
    );
  }
  return null;
}

function PatientLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      to="/patients/$id"
      params={{ id }}
      className="font-medium text-foreground hover:text-primary"
    >
      {name}
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function OverdueSection({ visits }: { visits: Visit[] }) {
  return (
    <SectionCard title="Overdue Documentation" icon={FileWarning} count={visits.length}>
      {visits.length === 0 ? (
        <EmptyRow>All clear — no outstanding visit notes.</EmptyRow>
      ) : (
        <div className="divide-y divide-border">
          {visits.map((v) => (
            <div key={v.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-sm">
              <div className="col-span-12 md:col-span-4">
                <PatientLink id={v.patientId} name={v.patientName} />
              </div>
              <div className="col-span-6 md:col-span-2 flex items-center gap-1.5">
                <VisitTypeChip type={v.visitType} />
              </div>
              <div className="col-span-6 md:col-span-3 text-muted-foreground">
                {formatDate(v.date)}
              </div>
              <div className="col-span-12 md:col-span-3 md:text-right">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold",
                    overdueToneClass(v.daysOverdue ?? 0),
                  )}
                >
                  {v.daysOverdue} day{v.daysOverdue === 1 ? "" : "s"} overdue
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const IMPORTANT_TYPES: VisitType[] = ["SOC", "ROC", "Recert", "Reassessment", "Discharge"];

type WeekTone = "current" | "next";

function WeekSection({
  title,
  rangeLabel,
  days,
  todayISO,
  weekTone,
  getDayVisits,
  onReorder,
  seenDays,
  onMarkSeen,
}: {
  title: string;
  rangeLabel: string;
  days: Date[];
  todayISO: string;
  weekTone: WeekTone;
  getDayVisits: (date: string) => Visit[];
  onReorder: (date: string, fromId: string, toId: string) => void;
  seenDays: Record<string, boolean>;
  onMarkSeen: (iso: string) => void;
}) {
  return (
    <SectionCard
      title={title}
      icon={CalendarClock}
      hint={rangeLabel}
    >
      <div className="divide-y divide-border">
        {days.map((d) => {
          const iso = toISODate(d);
          const dayVisits = getDayVisits(iso);
          return (
            <DayRow
              key={iso}
              date={d}
              isToday={iso === todayISO}
              weekTone={weekTone}
              visits={dayVisits}
              seen={!!seenDays[iso]}
              onExpand={() => onMarkSeen(iso)}
              onReorder={(fromId, toId) => onReorder(iso, fromId, toId)}
            />
          );
        })}
      </div>
    </SectionCard>
  );
}

function dayRowToneClass(weekTone: WeekTone, isToday: boolean): string {
  if (isToday) return "bg-primary/10 hover:bg-primary/15";
  if (weekTone === "current") return "bg-accent/30 hover:bg-accent/50";
  return "bg-muted/20 hover:bg-muted/40";
}

function DayRow({
  date,
  isToday,
  weekTone,
  visits,
  seen,
  onExpand,
  onReorder,
}: {
  date: Date;
  isToday: boolean;
  weekTone: WeekTone;
  visits: Visit[];
  seen: boolean;
  onExpand: () => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const [open, setOpen] = useState(isToday);
  useEffect(() => {
    if (isToday) onExpand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  const importantCounts: { type: VisitType; count: number }[] = IMPORTANT_TYPES.map((tp) => ({
    type: tp,
    count: visits.filter((v) => v.visitType === tp).length,
  })).filter((x) => x.count > 0);

  const unseenCount = !seen ? visits.filter((v) => isRecentlyAdded(v)).length : 0;

  const label = isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const sub = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div>
      <button
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) onExpand();
            return next;
          });
        }}
        className={cn(
          "w-full grid grid-cols-12 items-center gap-3 px-5 py-3 text-sm transition-colors text-left",
          dayRowToneClass(weekTone, isToday),
        )}
      >
        <div className="col-span-1">
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="col-span-5 md:col-span-3 flex items-center gap-2">
          <span className={cn("font-semibold", isToday && "text-primary")}>{label}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
          {unseenCount > 0 && (
            <span
              title={`${unseenCount} new unseen visit${unseenCount === 1 ? "" : "s"}`}
              className="inline-block size-2 rounded-full bg-info ring-2 ring-info/30"
            />
          )}
        </div>
        <div className="col-span-3 md:col-span-2 text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{visits.length}</span> visit
          {visits.length === 1 ? "" : "s"}
        </div>
        <div className="col-span-12 md:col-span-6 flex flex-wrap items-center gap-1.5 md:justify-end mt-1 md:mt-0">
          {importantCounts.map((c) => (
            <span
              key={c.type}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold bg-primary/10 text-primary border-primary/30"
            >
              {c.count} {c.type}
            </span>
          ))}
        </div>
      </button>
      {open && (
        <div className="bg-muted/20 border-t border-border">
          {visits.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted-foreground">No visits plotted.</div>
          ) : (
            <ul className="divide-y divide-border">
              {visits.map((v) => (
                <DraggableVisitRow
                  key={v.id}
                  visit={v}
                  showNewBadge={!seen && isRecentlyAdded(v)}
                  onReorder={onReorder}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DraggableVisitRow({
  visit,
  showNewBadge,
  onReorder,
}: {
  visit: Visit;
  showNewBadge: boolean;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", visit.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/plain");
        setDragOver(false);
        if (fromId) onReorder(fromId, visit.id);
      }}
      className={cn(
        "grid grid-cols-12 items-center gap-3 px-5 py-2.5 text-sm cursor-grab active:cursor-grabbing",
        dragOver && "bg-primary/10",
      )}
    >
      <div className="col-span-1 text-muted-foreground">
        <GripVertical className="size-4" />
      </div>
      <div className="col-span-11 md:col-span-5 flex items-center gap-2 flex-wrap">
        <PatientLink id={visit.patientId} name={visit.patientName} />
        {showNewBadge && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30 text-[10px] font-semibold">
            <Sparkles className="size-2.5" /> New
          </span>
        )}
      </div>
      <div className="col-span-6 md:col-span-3 flex items-center gap-2 flex-wrap">
        <VisitTypeChip type={visit.visitType} />
        <VisitDateInfo visit={visit} />
      </div>
      <div className="col-span-6 md:col-span-3 md:text-right flex md:justify-end items-center gap-1.5">
        <ActionIndicator status={visit.status} />
      </div>
    </li>
  );
}

function formatMMDD(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${m.toString().padStart(2, "0")}/${day.toString().padStart(2, "0")}`;
}

function oasisDueDateFor(visit: Visit): string {
  return visit.oasisDueDate ?? toISODate(addDays(new Date(visit.date), 5));
}

function VisitDateInfo({ visit }: { visit: Visit }) {
  let label: string | null = null;
  if (visit.visitType === "SOC" || visit.visitType === "ROC" || visit.visitType === "Reassessment") {
    label = `• Due By ${formatMMDD(oasisDueDateFor(visit))}`;
  } else if (visit.visitType === "Recert") {
    const dueDate = oasisDueDateFor(visit);
    const end = new Date(dueDate);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    label = `• Window ${formatMMDD(start.toISOString().slice(0, 10))}–${formatMMDD(dueDate)}`;
  } else if (visit.visitType === "Discharge") {
    label = `• Episode Ends ${formatMMDD(visit.date)}`;
  }
  if (!label) return null;
  return (
    <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
  );
}


