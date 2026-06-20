import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    const { visitId, visitType, reassessSatisfies, anticipateDischarge } = data;

    // Determine which sections to generate based on visit type + toggles
    const sections = computeSections(visitType, reassessSatisfies, anticipateDischarge);

    // Placeholder content for now — future AI integration will replace this
    const generated = sections.map((label) => ({
      label,
      content: `[Placeholder] ${label} content will be generated from the visit narrative once AI documentation workflows are fully implemented.`,
    }));

    // Save generated documentation to the database
    const { error } = await supabase
      .from("visits")
      .update({ generated_documentation: generated })
      .eq("id", visitId);

    if (error) throw new Error(error.message);
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
