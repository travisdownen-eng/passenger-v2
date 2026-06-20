import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Sparkles,
  ClipboardList,
  Home,
  Stethoscope,
  Target,
  ShieldCheck,
  Calendar,
  Activity,
  TrendingUp,
  ListChecks,
  Gauge,
  HeartPulse,
  Layers,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { patientVisitsQuery } from "@/lib/queries";
import {
  saveNarrative,
  generateDocumentation,
} from "@/lib/visits.functions";

export const Route = createFileRoute("/patients/$id/narrative")({
  head: () => ({ meta: [{ title: "Narrative Assistant · Passenger" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(patientVisitsQuery(params.id)),
  component: NarrativePage,
});

const VISIT_TYPE_LABELS: Record<string, string> = {
  SOC: "Start of Care",
  Evaluation: "Evaluation",
  Subsequent: "Subsequent Visit",
  Reassessment: "Reassessment",
  Recert: "Recertification",
  ROC: "Resumption of Care",
  AgencyDischarge: "Agency Discharge",
  DisciplineDischarge: "Discipline Discharge",
};

type YesNo = "yes" | "no" | null;

function showsReassessToggle(vt: string): boolean {
  return vt === "Recert" || vt === "ROC";
}

function showsDischargeToggle(vt: string): boolean {
  return vt !== "AgencyDischarge" && vt !== "DisciplineDischarge";
}

interface DocSection {
  label: string;
  content: string;
}

function NarrativePage() {
  const { id } = Route.useParams();
  const { data: visits } = useSuspenseQuery(patientVisitsQuery(id));
  const visit = visits[0] ?? null;

  const visitType = visit?.visit_type ?? "Subsequent";
  const visitId = visit?.id ?? "";

  const [reassessSatisfies, setReassessSatisfies] = useState<YesNo>(
    (visit?.reassess_satisfies as YesNo) ?? null,
  );
  const [anticipateDischarge, setAnticipateDischarge] = useState<YesNo>(
    (visit?.anticipate_discharge as YesNo) ?? null,
  );
  const [narrative, setNarrative] = useState(visit?.narrative ?? "");
  const [sections, setSections] = useState<DocSection[]>(
    visit?.generated_documentation ?? [],
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const showReassess = showsReassessToggle(visitType);
  const showDischarge = showsDischargeToggle(visitType);

  // Debounced auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSave = useCallback(
    (value: string, r: YesNo, a: YesNo) => {
      if (!visitId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await saveNarrative({
            data: {
              visitId,
              narrative: value,
              reassessSatisfies: r,
              anticipateDischarge: a,
            },
          });
          setLastSaved(new Date());
        } catch {
          // silent fail — user can retry via generate
        }
      }, 800);
    },
    [visitId],
  );

  const handleNarrativeChange = (value: string) => {
    setNarrative(value);
    autoSave(value, reassessSatisfies, anticipateDischarge);
  };

  const handleReassessChange = (value: YesNo) => {
    setReassessSatisfies(value);
    autoSave(narrative, value, anticipateDischarge);
  };

  const handleAnticipateChange = (value: YesNo) => {
    setAnticipateDischarge(value);
    autoSave(narrative, reassessSatisfies, value);
  };

  const handleGenerate = async () => {
    if (!narrative.trim() || !visitId) return;
    setIsGenerating(true);
    try {
      const result = await generateDocumentation({
        data: {
          visitId,
          narrative,
          visitType: visitType as
            | "SOC"
            | "Evaluation"
            | "Subsequent"
            | "Reassessment"
            | "Recert"
            | "ROC"
            | "AgencyDischarge"
            | "DisciplineDischarge",
          reassessSatisfies,
          anticipateDischarge,
        },
      });
      setSections(result.sections);
      setLastSaved(new Date());
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSection = (index: number, content: string) => {
    setSections((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, content } : s));
      if (visitId) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
          try {
            await saveNarrative({
              data: {
                visitId,
                narrative,
                reassessSatisfies,
                anticipateDischarge,
                generatedDocumentation: next,
              },
            });
            setLastSaved(new Date());
          } catch {
            // silent fail
          }
        }, 800);
      }
      return next;
    });
  };

  const canGenerate =
    narrative.trim().length > 0 &&
    !isGenerating &&
    (!showReassess || reassessSatisfies !== null) &&
    (!showDischarge || anticipateDischarge !== null);

  if (!visit) {
    return (
      <div className="p-4 lg:p-6 max-w-[900px] mx-auto">
        <p className="text-muted-foreground">No visits found for this patient.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[900px] mx-auto space-y-6">
      <header>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          Narrative Assistant
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter free-form visit notes. Passenger will convert them into structured documentation.
        </p>
      </header>

      {/* Synced visit type (read-only) */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Visit Context</h3>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
          <Link2 className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Visit Type (synced from HCHB)
          </span>
          <span className="text-sm font-semibold text-foreground ml-auto">
            {VISIT_TYPE_LABELS[visitType] ?? visitType}
          </span>
        </div>

        {showReassess && (
          <YesNoToggle
            label="Is this visit being used to satisfy the 30-day functional reassessment requirement?"
            value={reassessSatisfies}
            onChange={handleReassessChange}
          />
        )}

        {showDischarge && (
          <YesNoToggle
            label="Anticipate discharge by end of current episode?"
            value={anticipateDischarge}
            onChange={handleAnticipateChange}
          />
        )}
      </section>

      {/* Visit Narrative */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Visit Narrative</h3>
        </div>
        <Textarea
          value={narrative}
          onChange={(e) => handleNarrativeChange(e.target.value)}
          placeholder="Describe the visit and any important updates or observations."
          className="min-h-[200px] text-sm resize-y"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {narrative.length} character{narrative.length !== 1 ? "s" : ""}
            </span>
            {lastSaved && (
              <span className="text-[11px] text-success">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            <Sparkles className="size-3.5" />
            {isGenerating ? "Generating…" : "Generate Documentation"}
          </Button>
        </div>
      </section>

      {/* Generated Documentation */}
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Generated Documentation</h3>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <FileText className="size-6 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No documentation has been generated.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Enter a narrative above and click Generate Documentation to create structured outputs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <DocSectionView
                key={section.label}
                label={section.label}
                content={section.content}
                onChange={(value) => updateSection(index, value)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "px-3 h-8 rounded-md border text-xs font-medium capitalize transition",
              value === opt
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-background border-border text-muted-foreground hover:bg-muted/40",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function DocSectionView({
  label,
  content,
  onChange,
}: DocSection & { onChange: (value: string) => void }) {
  const icon = sectionIcon(label);
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] text-sm resize-y"
      />
    </div>
  );
}

function sectionIcon(label: string) {
  const cls = "size-3.5 text-muted-foreground";
  if (label.includes("Homebound")) return <Home className={cls} />;
  if (label.startsWith("Assessment")) return <Stethoscope className={cls} />;
  if (label.includes("Therapy Plan") || label.includes("Plan for Next"))
    return <Calendar className={cls} />;
  if (label.includes("Progress Toward")) return <TrendingUp className={cls} />;
  if (label.includes("Ongoing Services")) return <ShieldCheck className={cls} />;
  if (label.includes("Effectiveness")) return <Gauge className={cls} />;
  if (label.includes("Variable Factors")) return <Activity className={cls} />;
  if (label.includes("Comorbidities")) return <HeartPulse className={cls} />;
  if (label.includes("Objective Evidence")) return <Target className={cls} />;
  if (label.includes("Outcome Measures")) return <ListChecks className={cls} />;
  if (label.includes("Justification")) return <ShieldCheck className={cls} />;
  return <FileText className={cls} />;
}
