import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PhoneCall,
  Plus,
  Trash2,
  Sparkles,
  Copy,
  Pill,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  History,
  User,
  Phone,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { patientQuery } from "@/lib/queries";
import { formatDateMMDDYYYY, fullName } from "@/lib/format";
import {
  PATIENT_CALL_STATUS_LABEL,
  addManualConcern,
  allItems,
  allUnresolved,
  appendCallLog,
  deriveItems,
  loadRecord,
  pruneResolved,
  removeManualConcern,
  saveRecord,
  toggleResolved,
  type DerivedCallItem,
  type DerivedItems,
  type PatientCallRecord,
  type PatientCallStatus,
} from "@/lib/patient-call-record";

export const Route = createFileRoute("/patients/$id/calls")({
  head: () => ({ meta: [{ title: "Call Assistant · Passenger" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(patientQuery(params.id)),
  component: CallsPage,
});

function CallsPage() {
  const { id } = Route.useParams();
  const { data: patient } = useSuspenseQuery(patientQuery(id));
  const [record, setRecord] = useState<PatientCallRecord | null>(null);
  const [items, setItems] = useState<DerivedItems | null>(null);

  useEffect(() => {
    const r = pruneResolved(id, loadRecord(id));
    saveRecord(id, r);
    setRecord(r);
    setItems(deriveItems(id, r));
  }, [id]);

  const persist = (updater: (r: PatientCallRecord) => PatientCallRecord) =>
    setRecord((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveRecord(id, next);
      setItems(deriveItems(id, next));
      return next;
    });

  // Auto-resolve when all items resolved
  useEffect(() => {
    if (!record || !items) return;
    const unresolved = allUnresolved(items);
    if (
      unresolved.length === 0 &&
      allItems(items).length > 0 &&
      record.status !== "resolved"
    ) {
      persist((r) => ({ ...r, status: "resolved" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (!record || !items) {
    return <div className="p-6 text-sm text-muted-foreground">Loading call record…</div>;
  }
  if (!patient) {
    return <div className="p-6 text-sm text-muted-foreground">Patient not found.</div>;
  }

  const unresolved = allUnresolved(items);

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <PhoneCall className="size-4 text-primary" />
            Call Assistant
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One call record per patient. Discrepancies and interactions flagged for notification are
            consolidated below.
          </p>
        </div>
        <Link
          to="/patients/$id/reconcile"
          params={{ id }}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          <Pill className="size-3" /> Open Medication Assistant
        </Link>
      </header>

      <PatientCallCard
        patient={{
          name: fullName(patient),
          dob: formatDateMMDDYYYY(patient.dob ?? null),
          physician: patient.physician_name ?? null,
          phone: patient.physician_phone ?? null,
        }}
        status={record.status}
        unresolvedCount={unresolved.length}
        totalCount={allItems(items).length}
        onStatus={(status) => persist((r) => ({ ...r, status }))}
      />

      <UnresolvedItems
        items={items}
        onToggle={(item) => persist((r) => toggleResolved(r, item))}
        onAddManual={(text) => {
          persist((r) => addManualConcern(r, text));
          toast.success("Concern added.");
        }}
        onRemoveManual={(id) => persist((r) => removeManualConcern(r, id))}
      />

      <AICallAgent
        patient={{
          name: fullName(patient),
          dob: formatDateMMDDYYYY(patient.dob ?? null),
          physician: patient.physician_name ?? null,
        }}
        unresolved={unresolved}
        onLog={(entry) => {
          persist((r) =>
            appendCallLog({ ...r, status: entry.status }, entry),
          );
          toast.success("Call logged.");
        }}
      />

      <CallHistory logs={record.callLogs} />
    </div>
  );
}

/* ---------- Patient call card ---------- */

interface PatientHeader {
  name: string;
  dob: string;
  physician: string | null;
  phone: string | null;
}

function PatientCallCard({
  patient,
  status,
  unresolvedCount,
  totalCount,
  onStatus,
}: {
  patient: PatientHeader;
  status: PatientCallStatus;
  unresolvedCount: number;
  totalCount: number;
  onStatus: (s: PatientCallStatus) => void;
}) {
  return (
    <section className="surface-card p-4 space-y-3 border-primary/30">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Info icon={<User className="size-3.5" />} label="Patient" value={patient.name} sub={`DOB ${patient.dob}`} />
        <Info icon={<Bot className="size-3.5" />} label="Physician" value={patient.physician || "—"} />
        <Info icon={<Phone className="size-3.5" />} label="Phone" value={patient.phone || "—"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Call Status
          </span>
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as PatientCallStatus)}
            className={cn(
              "h-7 text-xs px-2 rounded border bg-background",
              status === "resolved"
                ? "border-success/40 text-success"
                : status === "completed"
                  ? "border-info/40 text-info"
                  : "border-border",
            )}
          >
            {(Object.keys(PATIENT_CALL_STATUS_LABEL) as PatientCallStatus[]).map((k) => (
              <option key={k} value={k}>
                {PATIENT_CALL_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 text-[11px]">
          <Stat label="Unresolved" count={unresolvedCount} tone={unresolvedCount > 0 ? "warning" : "success"} />
          <Stat label="Total" count={totalCount} />
        </div>
      </div>
    </section>
  );
}

function Info({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Stat({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone?: "warning" | "success";
}) {
  const cls =
    tone === "warning"
      ? "bg-warning/10 text-warning-foreground border-warning/40"
      : tone === "success"
        ? "bg-success/10 text-success border-success/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border", cls)}>
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

/* ---------- Unresolved items ---------- */

function UnresolvedItems({
  items,
  onToggle,
  onAddManual,
  onRemoveManual,
}: {
  items: DerivedItems;
  onToggle: (item: DerivedCallItem) => void;
  onAddManual: (text: string) => void;
  onRemoveManual: (id: string) => void;
}) {
  return (
    <section className="surface-card p-3 space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <ClipboardList className="size-3.5" /> Items to Discuss
      </h3>

      <Group
        title="Medication Discrepancies"
        icon={<AlertTriangle className="size-3 text-warning" />}
        items={items.discrepancies}
        empty="No medication discrepancies detected."
        onToggle={onToggle}
      />
      <Group
        title="Interactions Requiring Notification"
        icon={<Sparkles className="size-3 text-warning" />}
        items={items.interactions}
        empty="No interactions flagged for physician notification."
        onToggle={onToggle}
      />
      <ManualGroup
        items={items.manual}
        onToggle={onToggle}
        onAdd={onAddManual}
        onRemove={onRemoveManual}
      />
    </section>
  );
}

function Group({
  title,
  icon,
  items,
  empty,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  items: DerivedCallItem[];
  empty: string;
  onToggle: (item: DerivedCallItem) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] font-semibold mb-1">
        {icon} {title}
        <span className="text-muted-foreground font-normal">
          ({items.filter((i) => !i.resolved).length} unresolved / {items.length} total)
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground pl-4">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <ItemRow key={i.key} item={i} onToggle={() => onToggle(i)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onRemove,
}: {
  item: DerivedCallItem;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <li
      className={cn(
        "p-2 rounded border bg-background flex items-start gap-2",
        item.resolved ? "border-success/30 bg-success/5" : "border-border",
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 mt-0.5 size-4 rounded border flex items-center justify-center transition-colors",
          item.resolved
            ? "bg-success border-success text-success-foreground"
            : "border-border hover:border-primary",
        )}
        aria-label={item.resolved ? "Mark unresolved" : "Mark resolved"}
      >
        {item.resolved && <CheckCircle2 className="size-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-xs font-medium", item.resolved && "line-through text-muted-foreground")}>
          {item.title}
        </div>
        {item.detail && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</div>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remove"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

function ManualGroup({
  items,
  onToggle,
  onAdd,
  onRemove,
}: {
  items: DerivedCallItem[];
  onToggle: (item: DerivedCallItem) => void;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] font-semibold mb-1">
        <ClipboardList className="size-3 text-muted-foreground" /> Other Clinician Concerns
        <span className="text-muted-foreground font-normal">
          ({items.filter((i) => !i.resolved).length} unresolved / {items.length} total)
        </span>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 mb-2">
          {items.map((i) => (
            <ItemRow
              key={i.key}
              item={i}
              onToggle={() => onToggle(i)}
              onRemove={() => onRemove(i.key.replace(/^manual:/, ""))}
            />
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a physician question or concern…"
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              onAdd(text.trim());
              setText("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1"
          disabled={!text.trim()}
          onClick={() => {
            onAdd(text.trim());
            setText("");
          }}
        >
          <Plus className="size-3" /> Add
        </Button>
      </div>
    </div>
  );
}

/* ---------- AI Call Agent ---------- */

function AICallAgent({
  patient,
  unresolved,
  onLog,
}: {
  patient: { name: string; dob: string; physician: string | null };
  unresolved: DerivedCallItem[];
  onLog: (entry: {
    spokeWith: string;
    outcome: string;
    itemSummaries: string[];
    status: PatientCallStatus;
  }) => void;
}) {
  const [spokeWith, setSpokeWith] = useState("");
  const [outcome, setOutcome] = useState("");
  const [status, setStatus] = useState<PatientCallStatus>("completed");

  const script = useMemo(() => {
    if (unresolved.length === 0) return "All items resolved — no active issues to call about.";
    const greeting = `Hello, this is the home health clinician calling${patient.physician ? ` for ${patient.physician}` : ""} regarding ${patient.name}, DOB ${patient.dob}. I am calling regarding the following:`;
    const bullets = unresolved.map((i) => `  • ${i.title}`).join("\n");
    return `${greeting}\n${bullets}\nPlease advise on appropriate orders or clarification. Thank you.`;
  }, [patient, unresolved]);

  const logCall = () => {
    if (unresolved.length === 0) {
      toast.error("Nothing to call about.");
      return;
    }
    onLog({
      spokeWith,
      outcome,
      itemSummaries: unresolved.map((i) => i.title),
      status,
    });
    setSpokeWith("");
    setOutcome("");
    setStatus("completed");
  };

  return (
    <section className="surface-card p-3 space-y-3 border-primary/30">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Bot className="size-3.5" /> AI Call Agent
      </h3>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Call Script ({unresolved.length} item{unresolved.length === 1 ? "" : "s"})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={() => {
              navigator.clipboard.writeText(script);
              toast.success("Script copied.");
            }}
          >
            <Copy className="size-3" /> Copy
          </Button>
        </div>
        <Textarea
          readOnly
          value={script}
          className="min-h-[100px] text-xs font-mono whitespace-pre-wrap"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FieldBlock label="Spoke with">
          <Input
            value={spokeWith}
            onChange={(e) => setSpokeWith(e.target.value)}
            placeholder="e.g. Mary RN at Dr. Smith's office"
            className="h-8 text-xs"
          />
        </FieldBlock>
        <FieldBlock label="New call status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PatientCallStatus)}
            className="h-8 text-xs px-2 rounded border border-border bg-background w-full"
          >
            {(Object.keys(PATIENT_CALL_STATUS_LABEL) as PatientCallStatus[]).map((k) => (
              <option key={k} value={k}>
                {PATIENT_CALL_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock label="Outcome" className="md:col-span-2">
          <Textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Continue Eliquis. Update medication list. Monitor for bleeding."
            className="min-h-[60px] text-xs"
          />
        </FieldBlock>
      </div>

      <div className="flex justify-end">
        <Button size="sm" className="h-7 text-[11px] gap-1" onClick={logCall}>
          <PhoneCall className="size-3" /> Log Call
        </Button>
      </div>
      <p className="text-[10px] italic text-muted-foreground">
        Mock — no real call placed. Logging creates one consolidated entry covering all unresolved items.
      </p>
    </section>
  );
}

function FieldBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("space-y-1 block", className)}>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---------- Call history ---------- */

function CallHistory({ logs }: { logs: PatientCallRecord["callLogs"] }) {
  return (
    <section className="surface-card p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <History className="size-3.5" /> Call History ({logs.length})
      </h3>
      {logs.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">No previous calls logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {[...logs].reverse().map((log) => {
            const d = new Date(log.date);
            return (
              <li key={log.id} className="p-2 rounded border border-border bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="text-[11px] font-medium">
                    {d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}{" "}
                    at{" "}
                    {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                    {PATIENT_CALL_STATUS_LABEL[log.status]}
                  </span>
                </div>
                {log.itemSummaries.length > 0 && (
                  <div className="text-[11px] mb-1">
                    <span className="text-muted-foreground">Discussed: </span>
                    <ul className="list-disc list-inside ml-1">
                      {log.itemSummaries.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {log.spokeWith && (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Spoke with: </span>
                    {log.spokeWith}
                  </div>
                )}
                {log.outcome && (
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Outcome: </span>
                    {log.outcome}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
