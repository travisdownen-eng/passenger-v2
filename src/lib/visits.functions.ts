import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateNarrativeDocumentation } from "@/lib/narrative-generation";

function getSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function markNarrativeNeedsReview(supabase: ReturnType<typeof getSupabase>, visitId: string) {
  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("patient_id")
    .eq("id", visitId)
    .maybeSingle();

  if (visitError) throw new Error(visitError.message);
  if (!visit) throw new Error("Visit not found");

  const { data: existing, error: existingError } = await supabase
    .from("workflow_statuses")
    .select("id")
    .eq("workflow_type", "narrative")
    .eq("source_table", "visits")
    .eq("source_id", visitId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const payload = {
    patient_id: visit.patient_id,
    workflow_type: "narrative" as const,
    state: "needs_review" as const,
    source_table: "visits",
    source_id: visitId,
    reviewed_at: null,
    ready_to_sync_at: null,
    synced_at: null,
  };

  const { error } = existing
    ? await supabase.from("workflow_statuses").update(payload).eq("id", existing.id)
    : await supabase.from("workflow_statuses").insert(payload);

  if (error) throw new Error(error.message);
}

async function tryMarkNarrativeNeedsReview(
  supabase: ReturnType<typeof getSupabase>,
  visitId: string,
) {
  try {
    await markNarrativeNeedsReview(supabase, visitId);
  } catch {
    // Workflow statuses are best-effort until the table is available.
  }
}

const SaveNarrativeInput = z.object({
  visitId: z.string(),
  narrative: z.string(),
  reassessSatisfies: z.enum(["yes", "no"]).nullable(),
  anticipateDischarge: z.enum(["yes", "no"]).nullable(),
  generatedDocumentation: z
    .array(z.object({ label: z.string(), content: z.string() }))
    .optional(),
});

export const saveNarrative = createServerFn({ method: "POST" })
  .inputValidator((data) => SaveNarrativeInput.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    const {
      visitId,
      narrative,
      reassessSatisfies,
      anticipateDischarge,
      generatedDocumentation,
    } = data;

    const { error } = await supabase
      .from("visits")
      .update({
        narrative,
        reassess_satisfies: reassessSatisfies,
        anticipate_discharge: anticipateDischarge,
        ...(generatedDocumentation !== undefined && {
          generated_documentation: generatedDocumentation,
        }),
      })
      .eq("id", visitId);

    if (error) throw new Error(error.message);
    if (generatedDocumentation !== undefined && generatedDocumentation.length > 0) {
      await tryMarkNarrativeNeedsReview(supabase, visitId);
    }
    return { success: true };
  });

const GenerateDocsInput = z.object({
  visitId: z.string(),
  narrative: z.string(),
  visitType: z.enum([
    "SOC",
    "Evaluation",
    "Subsequent",
    "Reassessment",
    "Recert",
    "ROC",
    "AgencyDischarge",
    "DisciplineDischarge",
  ]),
  reassessSatisfies: z.enum(["yes", "no"]).nullable(),
  anticipateDischarge: z.enum(["yes", "no"]).nullable(),
});

export const generateDocumentation = createServerFn({ method: "POST" })
  .inputValidator((data) => GenerateDocsInput.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    const { visitId, narrative, visitType, reassessSatisfies, anticipateDischarge } = data;

    const generated = await generateNarrativeDocumentation({
      narrative,
      visitType,
      reassessSatisfies,
      anticipateDischarge,
    });

    // Save generated documentation to the database
    const { error } = await supabase
      .from("visits")
      .update({ generated_documentation: generated })
      .eq("id", visitId);

    if (error) throw new Error(error.message);
    await tryMarkNarrativeNeedsReview(supabase, visitId);
    return { sections: generated };
  });

const REASSESSMENT_SECTIONS = [
  "Homebound Status",
  "Assessment",
  "Summary of Functional Progress Towards Goals",
  "Effectiveness of Plan",
  "Variable Factors Influencing Patient's Condition or Response to Treatment",
  "Impact of Current Comorbidities on Progress",
  "Objective Evidence or Expectation of Continued Progress Towards Goals",
  "Objective Outcome Measures/Tools Utilized",
  "Justification and Plan for Continued Services",
];

const STANDARD_SECTIONS = [
  "Homebound Status",
  "Assessment",
  "Therapy Plan / Main Focus for Next Visit",
];

function showsDischargeToggle(vt: string): boolean {
  return vt !== "AgencyDischarge" && vt !== "DisciplineDischarge";
}

function usesReassessmentSections(vt: string, reassessSatisfies: string | null): boolean {
  if (vt === "Reassessment") return true;
  if ((vt === "Recert" || vt === "ROC") && reassessSatisfies === "yes") return true;
  return false;
}

function computeSections(
  vt: string,
  reassessSatisfies: string | null,
  anticipateDischarge: string | null,
): string[] {
  if (vt === "AgencyDischarge" || vt === "DisciplineDischarge") {
    return ["Assessment"];
  }

  const base = usesReassessmentSections(vt, reassessSatisfies)
    ? [...REASSESSMENT_SECTIONS]
    : [...STANDARD_SECTIONS];

  if (showsDischargeToggle(vt) && anticipateDischarge !== null) {
    base.push("Anticipated Ongoing Services Required");
    base.push("Current Progress Toward Discharge Plan");
  }

  return base;
}
