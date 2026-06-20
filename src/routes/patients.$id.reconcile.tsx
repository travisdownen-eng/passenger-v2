import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Pill,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  ShieldAlert,
  Send,
  CheckCircle2,
  GraduationCap,
  Bell,
  PhoneCall,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  computeDiscrepancies,
  computeInteractions,
  emptyHighRiskEducation,
  emptyInteractionDoc,
  fmt,
  highRiskCategory,
  loadRecon,
  mockExtract,
  newMed,
  saveRecon,
  type Discrepancy,
  type HighRiskEducation,
  type Interaction,
  type InteractionDoc,
  type MedEntry,
  type NotifyPriority,
  type NotifyStatus,
  type PhysicianNotification,
  type ReconState,
} from "@/lib/med-reconciliation";

export const Route = createFileRoute("/patients/$id/reconcile")({
  head: () => ({ meta: [{ title: "Medication Assistant · Passenger" }] }),
  component: ReconcilePage,
});

function ReconcilePage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<ReconState | null>(null);

  useEffect(() => setState(loadRecon(id)), [id]);

  const persist = (updater: (s: ReconState) => ReconState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      next.discrepancies = mergeDiscrepancies(
        computeDiscrepancies(next.referral, next.patient),
        next.discrepancies,
      );
      next.interactions = computeInteractions([...next.referral, ...next.patient]);
      saveRecon(id, next);
      return next;
    });
  };

  const highRisk = useMemo(() => {
    if (!state) return [];
    return uniqueByName([...state.referral, ...state.patient])
      .map((m) => ({ med: m, cat: highRiskCategory(m.name) }))
      .filter((x): x is { med: MedEntry; cat: NonNullable<ReturnType<typeof highRiskCategory>> } => !!x.cat);
  }, [state]);

  if (!state) {
    return <div className="p-6 text-sm text-muted-foreground">Loading reconciliation…</div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Pill className="size-4 text-primary" />
            Medication Assistant
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare the source list against what the patient is actually taking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] items-center">
          <Stat label="Source" count={state.referral.length} />
          <Stat label="Patient" count={state.patient.length} />
          <Stat label="Discrepancies" count={state.discrepancies.length} tone="warning" />
          <Stat label="Interactions" count={state.interactions.length} tone="danger" />
          <Stat label="High-risk" count={highRisk.length} tone="danger" />
          <Link
            to="/patients/$id/calls"
            params={{ id }}
            className="ml-1 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10"
          >
            <PhoneCall className="size-3" /> Call Assistant
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <MedColumn
          title="Source Medication List"
          subtitle="From AI-extracted documentation"
          tone="muted"
          meds={state.referral}
          onChange={(meds) => persist((s) => ({ ...s, referral: meds }))}
          showExtract={false}
        />
        <MedColumn
          title="Patient Taking Medication List"
          subtitle="What the patient reports taking now"
          tone="primary"
          meds={state.patient}
          onChange={(meds) => persist((s) => ({ ...s, patient: meds }))}
          showExtract
          onExtract={(kind) => {
            const extracted = mockExtract(kind);
            persist((s) => ({ ...s, patient: [...s.patient, ...extracted] }));
            toast.success(`AI extracted ${extracted.length} medication${extracted.length === 1 ? "" : "s"}`);
          }}
        />
      </div>

      {/* Discrepancies (unchanged layout) */}
      <Section title="Discrepancies" icon={<AlertTriangle className="size-3.5" />} tone="warning">
        {state.discrepancies.length === 0 ? (
          <Empty>No discrepancies detected.</Empty>
        ) : (
          <div className="space-y-1.5">
            {state.discrepancies.map((d) => (
              <DiscrepancyRow
                key={d.id}
                d={d}
                onNotes={(notes) =>
                  persist((s) => ({
                    ...s,
                    discrepancies: s.discrepancies.map((x) => (x.id === d.id ? { ...x, notes } : x)),
                  }))
                }
                onQueue={() =>
                  persist((s) => ({
                    ...s,
                    notifications: [...s.notifications, notificationFromDiscrepancy(d)],
                  }))
                }
              />
            ))}
          </div>
        )}
      </Section>

      {/* Interactions (existing card + new documentation block) */}
      <Section title="Interactions" icon={<Sparkles className="size-3.5" />} tone="danger">
        {state.interactions.length === 0 ? (
          <Empty>No interactions flagged (mock check).</Empty>
        ) : (
          <div className="space-y-2">
            {state.interactions.map((i) => {
              const doc = state.interaction_docs[i.id] ?? emptyInteractionDoc(i);
              return (
                <InteractionRow
                  key={i.id}
                  i={i}
                  doc={doc}
                  onDoc={(patch) =>
                    persist((s) => {
                      const prev = s.interaction_docs[i.id] ?? emptyInteractionDoc(i);
                      const next = { ...prev, ...patch };
                      // Auto-queue on notify_needed = yes (idempotent by issue text)
                      let notifications = s.notifications;
                      if (
                        patch.notify_needed === "yes" &&
                        !s.notifications.some((n) => n.source === "interaction" && n.issue.includes(`${i.med_a} × ${i.med_b}`))
                      ) {
                        const symptomatic = next.symptoms_state === "present";
                        notifications = [...s.notifications, notificationFromInteraction(i, symptomatic)];
                        toast.success("Added to Physician Notification queue");
                      }
                      return {
                        ...s,
                        interaction_docs: { ...s.interaction_docs, [i.id]: next },
                        notifications,
                      };
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </Section>


      {/* High-Risk Medication Education (replaces queue button) */}
      <Section title="High-Risk Medication Education" icon={<ShieldAlert className="size-3.5" />} tone="danger">
        {highRisk.length === 0 ? (
          <Empty>No high-risk classes detected.</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {highRisk.map(({ med, cat }) => {
              const edu = state.highrisk_education[med.id] ?? emptyHighRiskEducation();
              return (
                <HighRiskEducationCard
                  key={med.id}
                  med={med}
                  category={cat}
                  edu={edu}
                  onChange={(patch) =>
                    persist((s) => ({
                      ...s,
                      highrisk_education: {
                        ...s.highrisk_education,
                        [med.id]: { ...edu, ...patch },
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* General Education */}
      <Section title="General Education Documentation" icon={<CheckCircle2 className="size-3.5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(
            [
              ["medication_education", "Medication education provided"],
              ["interaction_education", "Interaction education provided"],
              ["compliance_concerns", "Compliance concerns"],
              ["patient_questions", "Questions from patient/caregiver"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
              <Textarea
                value={state.education[key]}
                onChange={(e) =>
                  persist((s) => ({
                    ...s,
                    education: { ...s.education, [key]: e.target.value },
                  }))
                }
                placeholder="Document here…"
                className="min-h-[60px] text-xs"
              />
            </label>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Physician Notification Queue" icon={<Send className="size-3.5" />}>
        <p className="text-[10px] text-muted-foreground mb-2">
          Auto-eligible: high-severity interactions, symptomatic interactions, and discrepancies.
          High-risk medications document via Education above and are not auto-queued.
        </p>
        {state.notifications.length === 0 ? (
          <Empty>Nothing queued. Use Queue buttons above to add items.</Empty>
        ) : (
          <div className="space-y-1.5">
            {state.notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onStatus={(status) =>
                  persist((s) => ({
                    ...s,
                    notifications: s.notifications.map((x) => (x.id === n.id ? { ...x, status } : x)),
                  }))
                }
                onPriority={(priority) =>
                  persist((s) => ({
                    ...s,
                    notifications: s.notifications.map((x) =>
                      x.id === n.id ? { ...x, priority } : x,
                    ),
                  }))
                }
                onDelete={() =>
                  persist((s) => ({
                    ...s,
                    notifications: s.notifications.filter((x) => x.id !== n.id),
                  }))
                }
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ---------- Medication column / cards ---------- */

function CameraCaptureButton({ onCapture }: { onCapture: (count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadFallbackRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play();
  }, [open, stream]);

  useEffect(() => {
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const stopStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  };

  const startCamera = async () => {
    setPermissionDenied(false);
    setOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionDenied(true);
      return;
    }
    try {
      setStarting(true);
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setStream(cameraStream);
    } catch {
      setPermissionDenied(true);
    } finally {
      setStarting(false);
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPhotos((prev) => [...prev, canvas.toDataURL("image/jpeg", 0.8)]);
  };

  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const closeSession = () => {
    stopStream();
    setOpen(false);
    setPhotos([]);
    setPermissionDenied(false);
  };

  const doneCapturing = () => {
    const count = photos.length;
    closeSession();
    if (count > 0) onCapture(count);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={startCamera} disabled={starting} className="h-6 px-2 text-[10px] gap-1">
        <Camera className="size-3" /> {starting ? "Opening…" : "Take Photo"}
      </Button>
      <input
        ref={uploadFallbackRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Upload existing photo"
        className="sr-only"
        onChange={(e) => {
          const n = e.target.files?.length ?? 0;
          e.target.value = "";
          if (n > 0) {
            closeSession();
            onCapture(n);
          }
        }}
      />
      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              Medication Capture Session
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Photos Captured: {photos.length}
              </span>
            </div>
            <Button type="button" size="icon" variant="outline" className="size-8" onClick={closeSession} aria-label="Cancel capture session">
              <X className="size-4" />
            </Button>
          </div>

          {permissionDenied ? (
            <div className="min-h-0 flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
              <Camera className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">Camera access is required to take photos.</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Enable camera permission in your browser settings, then try again.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Button type="button" onClick={startCamera}>Try Again</Button>
                <Button type="button" variant="outline" onClick={() => uploadFallbackRef.current?.click()}>
                  <Upload className="size-4" /> Upload Existing Photo
                </Button>
              </div>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="min-h-0 flex-1 w-full rounded border border-border bg-muted object-contain" />
          )}

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((src, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={src} alt={`Captured ${i + 1}`} className="h-16 w-16 rounded border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full size-5 flex items-center justify-center text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={snap} disabled={!stream || permissionDenied} className="h-11 flex-1">
              <Camera className="size-4" /> Take Photo
            </Button>
            <Button type="button" variant="outline" onClick={doneCapturing} disabled={photos.length === 0} className="h-11">
              Done Capturing
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function MedColumn({
  title,
  subtitle,
  tone,
  meds,
  onChange,
  showExtract,
  onExtract,
}: {
  title: string;
  subtitle: string;
  tone: "muted" | "primary";
  meds: MedEntry[];
  onChange: (meds: MedEntry[]) => void;
  showExtract: boolean;
  onExtract?: (kind: "camera" | "list_photo" | "bottle_photo") => void;
}) {
  const update = (id: string, patch: Partial<MedEntry>) =>
    onChange(meds.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (id: string) => onChange(meds.filter((m) => m.id !== id));
  const add = () => onChange([...meds, newMed()]);

  return (
    <section className={cn("surface-card p-3 space-y-2", tone === "primary" && "border-primary/30")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
        <Button size="sm" variant="outline" onClick={add} className="h-7 text-[11px]">
          <Plus className="size-3" /> Add
        </Button>
      </header>

      {showExtract && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded border border-dashed border-border bg-muted/30">
          <CameraCaptureButton onCapture={() => onExtract?.("camera")} />

          <div className="relative inline-flex items-center h-6 px-2 text-[10px] gap-1 rounded border border-input bg-background text-foreground hover:bg-accent pointer-events-none">
            <Upload className="size-3" /> Upload Photo
            <input
              type="file"
              accept="image/*"
              aria-label="Upload existing photo"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto"
              onChange={(e) => {
                if (e.target.files?.length && onExtract) onExtract("list_photo");
                e.target.value = "";
              }}
            />
          </div>

          <span className="text-[10px] text-muted-foreground self-center ml-1">
            Mock AI extraction
          </span>
        </div>
      )}

      {meds.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground py-4 text-center">
          No medications yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {meds.map((m) => (
            <MedicationCard
              key={m.id}
              m={m}
              onChange={(patch) => update(m.id, patch)}
              onRemove={() => remove(m.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MedicationCard({
  m,
  onChange,
  onRemove,
}: {
  m: MedEntry;
  onChange: (patch: Partial<MedEntry>) => void;
  onRemove: () => void;
}) {
  const cat = highRiskCategory(m.name);
  return (
    <li className="rounded-md border border-border bg-background p-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <Input
          value={m.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Medication name"
          className="h-7 text-xs font-medium flex-1"
        />
        <div className="flex items-center gap-1 shrink-0">
          {cat && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border border-destructive/40 bg-destructive/10 text-destructive">
              <ShieldAlert className="size-2.5" /> {cat}
            </span>
          )}
          {m.is_new && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-info/40 bg-info/10 text-info">
              NEW
            </span>
          )}
          {m.is_changed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning-foreground">
              CHG
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 text-muted-foreground hover:text-destructive"
            aria-label="Remove"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
        <Field label="Dose">
          <Input value={m.dose} onChange={(e) => onChange({ dose: e.target.value })} placeholder="e.g. 10 mg" className="h-7 text-xs" />
        </Field>
        <Field label="Frequency">
          <Input value={m.frequency} onChange={(e) => onChange({ frequency: e.target.value })} placeholder="e.g. BID" className="h-7 text-xs" />
        </Field>
        <Field label="Route">
          <Input value={m.route} onChange={(e) => onChange({ route: e.target.value })} placeholder="PO" className="h-7 text-xs" />
        </Field>
        <Field label="Classification">
          <Input value={m.classification ?? ""} onChange={(e) => onChange({ classification: e.target.value })} placeholder="e.g. ACE inhibitor" className="h-7 text-xs" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={m.start_date ?? ""} onChange={(e) => onChange({ start_date: e.target.value })} className="h-7 text-xs" />
        </Field>
        <Field label="End date">
          <Input type="date" value={m.end_date ?? ""} onChange={(e) => onChange({ end_date: e.target.value })} className="h-7 text-xs" />
        </Field>
        <Field label="Reason for use" className="col-span-2">
          <Input value={m.reason ?? ""} onChange={(e) => onChange({ reason: e.target.value })} placeholder="Indication" className="h-7 text-xs" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <CheckboxRow
          label="PRN"
          checked={!!m.prn}
          onCheckedChange={(v) => onChange({ prn: v, prn_reason: v ? m.prn_reason : "" })}
        />
        {m.prn && (
          <Input
            value={m.prn_reason ?? ""}
            onChange={(e) => onChange({ prn_reason: e.target.value })}
            placeholder="PRN reason"
            className="h-6 text-xs w-40"
          />
        )}
        <CheckboxRow
          label="New medication"
          checked={!!m.is_new}
          onCheckedChange={(v) => onChange({ is_new: v })}
        />
        <CheckboxRow
          label="Changed medication"
          checked={!!m.is_changed}
          onCheckedChange={(v) => onChange({ is_changed: v })}
        />
      </div>
    </li>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("space-y-0.5 block", className)}>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CheckboxRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="h-3.5 w-3.5" />
      {label}
    </label>
  );
}

/* ---------- High-risk education ---------- */

const HIGH_RISK_BLURBS: Record<string, string> = {
  Anticoagulant:
    "High risk due to increased bleeding risk. Educate patient on signs of bleeding and when to notify a physician.",
  Antiplatelet:
    "High risk due to increased bleeding risk. Educate patient on signs of bleeding and when to notify a physician.",
  Hypoglycemic:
    "High risk due to risk of low blood sugar. Educate patient on symptoms of hypoglycemia and when to seek assistance.",
  Insulin:
    "High risk due to risk of hypoglycemia and dosing errors.",
  Opioid:
    "High risk due to sedation, respiratory depression, and fall risk.",
  Antibiotic:
    "High risk due to potential for resistance, allergic reactions, and adverse effects.",
  Antipsychotic:
    "High risk due to sedation, metabolic effects, and fall risk.",
};

function HighRiskEducationCard({
  med,
  category,
  edu,
  onChange,
}: {
  med: MedEntry;
  category: string;
  edu: HighRiskEducation;
  onChange: (patch: Partial<HighRiskEducation>) => void;
}) {
  const blurb = HIGH_RISK_BLURBS[category] ?? "High-risk medication — patient education required.";
  const v = edu.educated;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">
            {med.name} {med.dose}
          </div>
          <div className="text-[10px] text-destructive font-medium">{category}</div>
        </div>
        <GraduationCap className="size-3.5 text-destructive shrink-0" />
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{blurb}</p>
      <div className="flex items-center justify-between gap-2 text-[11px] px-1.5 py-1 rounded bg-background border border-border">
        <span className="truncate">Patient/Caregiver Educated</span>
        <div className="flex gap-0.5 shrink-0">
          {(["yes", "no"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ educated: v === opt ? "" : opt })}
              className={cn(
                "px-2 py-0.5 rounded border text-[10px] uppercase font-medium",
                v === opt
                  ? opt === "yes"
                    ? "bg-success/15 border-success/40 text-success"
                    : "bg-destructive/15 border-destructive/40 text-destructive"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Discrepancy ---------- */

function DiscrepancyRow({
  d,
  onNotes,
  onQueue,
}: {
  d: Discrepancy;
  onNotes: (notes: string) => void;
  onQueue: () => void;
}) {
  const typeLabel = {
    taking_not_on_referral: "Taking — Not on Source",
    not_taking_on_referral: "Not Taking — On Source",
    taking_differently: "Taking Differently",
  }[d.type];
  const typeCls = {
    taking_not_on_referral: "bg-info/10 text-info border-info/30",
    not_taking_on_referral: "bg-warning/10 text-warning-foreground border-warning/40",
    taking_differently: "bg-destructive/10 text-destructive border-destructive/30",
  }[d.type];
  return (
    <div className="p-2 rounded border border-border bg-background space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{d.medication}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", typeCls)}>
              {typeLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 mt-1 text-[11px]">
            <div>
              <span className="text-muted-foreground">Source: </span>
              {d.referral ? <span>{d.referral}</span> : <span className="italic text-muted-foreground">—</span>}
            </div>
            <div>
              <span className="text-muted-foreground">Patient: </span>
              {d.patient ? <span>{d.patient}</span> : <span className="italic text-muted-foreground">—</span>}
            </div>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={onQueue}>
          <Bell className="size-3" /> Queue
        </Button>
      </div>
      <Input
        value={d.notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Notes (e.g. patient stopped 2 wks ago)…"
        className="h-7 text-xs"
      />
    </div>
  );
}

/* ---------- Interaction ---------- */

function AutoTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [props.value]);
  return <Textarea ref={ref} className={cn("resize-none overflow-hidden", className)} {...props} />;
}

function CompactToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; label: string; tone?: "success" | "danger" }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex gap-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? "" : o.v)}
            className={cn(
              "px-1.5 py-0.5 rounded border text-[10px]",
              value === o.v
                ? o.tone === "danger"
                  ? "bg-destructive/15 border-destructive/40 text-destructive"
                  : "bg-success/15 border-success/40 text-success"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InteractionRow({
  i,
  doc,
  onDoc,
}: {
  i: Interaction;
  doc: InteractionDoc;
  onDoc: (patch: Partial<InteractionDoc>) => void;
}) {
  const sevCls = {
    minor: "bg-muted text-muted-foreground border-border",
    moderate: "bg-warning/10 text-warning-foreground border-warning/40",
    major: "bg-destructive/10 text-destructive border-destructive/30",
  }[i.severity];

  const [monitorOpen, setMonitorOpen] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);

  const generateSummary = () => {
    const date = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    const sevWord = i.severity === "major" ? "severe medication interaction" : "medication interaction";
    const summary =
      `Physician notified regarding ${sevWord} between ${i.med_a} and ${i.med_b} on ${date}. ` +
      `Voicemail left with callback information. Awaiting response/orders.`;
    onDoc({ physician_summary: summary, summary_generated_at: new Date().toISOString() });
  };

  return (
    <div className="p-2 rounded border border-border bg-background space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold">
          {i.med_a} <span className="text-muted-foreground">×</span> {i.med_b}
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize shrink-0", sevCls)}>
          {i.severity}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <CompactToggle
          label="Did you assess the patient for this interaction?"
          value={doc.patient_assessed}
          options={[
            { v: "yes", label: "Yes", tone: "success" },
            { v: "no", label: "No", tone: "danger" },
          ]}
          onChange={(v) => onDoc({ patient_assessed: v as "yes" | "no" | "" })}
        />
        <CompactToggle
          label="Did the patient exhibit any interaction symptoms?"
          value={doc.symptoms_state}
          options={[
            { v: "none", label: "No symptoms noted", tone: "success" },
            { v: "present", label: "Symptoms present", tone: "danger" },
          ]}
          onChange={(v) => onDoc({ symptoms_state: v as "none" | "present" | "" })}
        />
        <CompactToggle
          label="Was the patient/caregiver educated about this interaction?"
          value={doc.educated}
          options={[
            { v: "yes", label: "Yes", tone: "success" },
            { v: "no", label: "No", tone: "danger" },
          ]}
          onChange={(v) => onDoc({ educated: v as "yes" | "no" | "" })}
        />
        <CompactToggle
          label="Does the physician need to be notified?"
          value={doc.notify_needed}
          options={[
            { v: "no", label: "No", tone: "success" },
            { v: "yes", label: "Yes", tone: "danger" },
          ]}
          onChange={(v) => onDoc({ notify_needed: v as "yes" | "no" | "" })}
        />
      </div>

      {i.monitor && (
        <Collapsible open={monitorOpen} onOpenChange={setMonitorOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronDown className={cn("size-3 transition-transform", monitorOpen && "rotate-180")} />
            What symptoms should be monitored?
          </CollapsibleTrigger>
          <CollapsibleContent className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-1">
            {i.monitor}
          </CollapsibleContent>
        </Collapsible>
      )}

      {i.education && (
        <Collapsible open={eduOpen} onOpenChange={setEduOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronDown className={cn("size-3 transition-transform", eduOpen && "rotate-180")} />
            Suggested patient/caregiver education
          </CollapsibleTrigger>
          <CollapsibleContent className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-1">
            {i.education}
          </CollapsibleContent>
        </Collapsible>
      )}

      {doc.symptoms_state === "present" && (
        <Field label="Symptoms reported">
          <AutoTextarea
            value={doc.symptoms_reported}
            onChange={(e) => onDoc({ symptoms_reported: e.target.value })}
            placeholder="Describe symptoms…"
            className="min-h-[28px] text-xs"
          />
        </Field>
      )}

      {doc.educated === "yes" && (
        <Field label="Additional interaction education provided (optional)">
          <AutoTextarea
            value={doc.additional_education}
            onChange={(e) => onDoc({ additional_education: e.target.value })}
            placeholder="Anything beyond standard guidance…"
            className="min-h-[28px] text-xs"
          />
        </Field>
      )}

      {doc.notify_needed === "yes" && (
        <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold flex items-center gap-1.5">
              <PhoneCall className="size-3" /> Physician Communication Summary
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] gap-1"
              onClick={generateSummary}
            >
              <Sparkles className="size-3" />
              {doc.physician_summary ? "Regenerate" : "Generate"}
            </Button>
          </div>
          <AutoTextarea
            value={doc.physician_summary}
            onChange={(e) => onDoc({ physician_summary: e.target.value })}
            placeholder="Click Generate after the AI Call Agent completes the call to auto-fill a summary. You can edit before saving."
            className="min-h-[40px] text-xs"
          />
          {doc.summary_generated_at && (
            <div className="text-[10px] text-muted-foreground">
              Generated {new Date(doc.summary_generated_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; label: string; tone: "success" | "danger" | "muted" }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] px-1.5 py-1 rounded bg-background border border-border">
      <span className="truncate">{label}</span>
      <div className="flex gap-0.5 shrink-0">
        {options.map((o) => {
          const active = value === o.v;
          const toneCls = active
            ? o.tone === "danger"
              ? "bg-destructive/15 border-destructive/40 text-destructive"
              : "bg-success/15 border-success/40 text-success"
            : "border-border text-muted-foreground hover:bg-muted";
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(active ? "" : o.v)}
              className={cn("px-1.5 py-0.5 rounded border text-[10px] uppercase", toneCls)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/* ---------- Notifications ---------- */

function NotificationRow({
  n,
  onStatus,
  onPriority,
  onDelete,
}: {
  n: PhysicianNotification;
  onStatus: (s: NotifyStatus) => void;
  onPriority: (p: NotifyPriority) => void;
  onDelete: () => void;
}) {
  const statusCls = {
    needs: "bg-warning/10 text-warning-foreground border-warning/40",
    notified: "bg-info/10 text-info border-info/30",
    resolved: "bg-success/10 text-success border-success/30",
  }[n.status];
  const statusLabel = { needs: "Needs Notification", notified: "Notified", resolved: "Resolved" }[
    n.status
  ];
  return (
    <div className="p-2 rounded border border-border bg-background">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold">{n.issue}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{n.reason}</div>
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remove"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", statusCls)}>
          {statusLabel}
        </span>
        <select
          value={n.priority}
          onChange={(e) => onPriority(e.target.value as NotifyPriority)}
          className="text-[10px] h-6 px-1 rounded border border-border bg-background"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="ml-auto flex gap-1">
          {n.status !== "needs" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onStatus("needs")}>
              Needs
            </Button>
          )}
          {n.status !== "notified" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onStatus("notified")}>
              Notified
            </Button>
          )}
          {n.status !== "resolved" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onStatus("resolved")}>
              Resolved
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared ---------- */

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon?: ReactNode;
  tone?: "warning" | "danger";
  children: ReactNode;
}) {
  const iconCls =
    tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "text-primary";
  return (
    <section className="surface-card p-3">
      <h3 className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2", iconCls)}>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, count, tone }: { label: string; count: number; tone?: "warning" | "danger" }) {
  const cls =
    tone === "danger"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : tone === "warning"
        ? "bg-warning/10 text-warning-foreground border-warning/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border", cls)}>
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[11px] italic text-muted-foreground py-2">{children}</p>;
}

/* ---------- helpers ---------- */

function uniqueByName(meds: MedEntry[]): MedEntry[] {
  const seen = new Set<string>();
  const out: MedEntry[] = [];
  for (const m of meds) {
    const k = m.name.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

function mergeDiscrepancies(fresh: Discrepancy[], prior: Discrepancy[]): Discrepancy[] {
  const priorById = new Map(prior.map((d) => [d.id, d]));
  return fresh.map((d) => {
    const p = priorById.get(d.id);
    return p && p.notes ? { ...d, notes: p.notes } : d;
  });
}

function notificationFromDiscrepancy(d: Discrepancy): PhysicianNotification {
  const typeLabel = {
    taking_not_on_referral: "Taking but not on source",
    not_taking_on_referral: "On source but not taking",
    taking_differently: "Taking differently than source",
  }[d.type];
  return {
    id: `notif-${d.id}-${Date.now()}`,
    issue: `${d.medication} — ${typeLabel}`,
    reason: [d.referral && `Source: ${d.referral}`, d.patient && `Patient: ${d.patient}`, d.notes]
      .filter(Boolean)
      .join(" • "),
    priority: d.type === "taking_differently" ? "high" : "medium",
    status: "needs",
    source: "discrepancy",
  };
}

function notificationFromInteraction(i: Interaction, symptomatic: boolean): PhysicianNotification {
  return {
    id: `notif-${i.id}-${Date.now()}`,
    issue: `Interaction: ${i.med_a} × ${i.med_b}${symptomatic ? " (symptomatic)" : ""}`,
    reason: `${i.severity.toUpperCase()} — ${i.concern}`,
    priority: symptomatic || i.severity === "major" ? "high" : i.severity === "moderate" ? "medium" : "low",
    status: "needs",
    source: "interaction",
  };
}
