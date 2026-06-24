import { z } from "zod";

export interface DocSection {
  label: string;
  content: string;
}

export const REQUIRED_NARRATIVE_SECTIONS = [
  "Homebound Status",
  "Assessment",
  "Therapy Plan / Main Focus for Next Visit",
  "Anticipated Ongoing Services Required",
  "Current Progress Toward Discharge Plan",
] as const;

type NarrativeSectionLabel = (typeof REQUIRED_NARRATIVE_SECTIONS)[number];

const SectionSchema = z.object({
  label: z.enum(REQUIRED_NARRATIVE_SECTIONS),
  content: z.string().min(1),
});

interface GenerateNarrativeDocumentationInput {
  narrative: string;
  visitType: string;
  reassessSatisfies: string | null;
  anticipateDischarge: string | null;
}

function outputText(response: unknown): string | null {
  if (typeof response !== "object" || response == null) return null;
  const maybe = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof maybe.output_text === "string") return maybe.output_text;
  for (const item of maybe.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function requiredSectionsFor(anticipateDischarge: string | null): NarrativeSectionLabel[] {
  if (anticipateDischarge !== "yes") return [...REQUIRED_NARRATIVE_SECTIONS];

  return REQUIRED_NARRATIVE_SECTIONS.filter(
    (section) => section !== "Anticipated Ongoing Services Required",
  );
}

function validateSections(value: unknown, requiredSections: NarrativeSectionLabel[]): DocSection[] {
  const parsed = z
    .object({
      sections: z
        .array(SectionSchema)
        .length(requiredSections.length)
        .refine((sections) =>
          sections.every((section) => requiredSections.includes(section.label)),
        ),
    })
    .parse(value);

  const byLabel = new Map(
    parsed.sections.map((section) => [section.label, section.content.trim()]),
  );

  return requiredSections.map((label) => {
    const content = byLabel.get(label);
    if (!content) throw new Error("Missing generated section");
    return { label, content };
  });
}

function generationError(): Error {
  return new Error("Unable to generate documentation safely. Please try again.");
}

export async function generateNarrativeDocumentation({
  narrative,
  visitType,
  reassessSatisfies,
  anticipateDischarge,
}: GenerateNarrativeDocumentationInput): Promise<DocSection[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw generationError();

  const requiredSections = requiredSectionsFor(anticipateDischarge);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You write concise home health physical therapy documentation from clinician visit narratives. " +
            "Do not invent objective findings, diagnoses, vitals, assist levels, falls, wounds, medications, " +
            "or physician communication not present in the narrative. Preserve uncertainty when details are vague. " +
            "Use professional clinical language. Avoid CMS/legal phrases such as 'meets criteria' or 'taxing effort'. " +
            "If narrative detail is sparse, state that more visit detail is needed rather than inventing findings. " +
            "Section rules: Homebound Status should only describe homebound factors directly supported by the narrative, " +
            "such as mobility limits, endurance, safety, assistance, device use, pain, or environmental barriers. " +
            "Assessment should summarize clinical status and justify skilled PT need only when supported by documented " +
            "deficits, treatment response, safety concerns, mobility limits, education needs, or functional limitations. " +
            "Therapy Plan / Main Focus for Next Visit should name the main focus for the next visit using only documented " +
            "needs or barriers. Anticipated Ongoing Services Required should describe ongoing services only when supported " +
            "by documented deficits, skilled need, or an explicitly stated service plan. Current Progress Toward Discharge " +
            "Plan should describe documented progress, remaining barriers, education, HEP carryover, safety, mobility, or " +
            "goal-related status; if these details are absent, say more visit detail is needed. " +
            "Discharge logic: if anticipateDischarge is yes, Anticipated Ongoing Services Required must not state that " +
            "continued therapy is anticipated unless the narrative explicitly states another service will continue. " +
            "When anticipateDischarge is yes, write discharge-focused language and make the Therapy Plan focus on discharge " +
            "readiness, final safety or HEP review, caregiver education, or remaining barriers if documented. " +
            "If anticipateDischarge is no, ongoing services may be described only when supported by documented deficits " +
            "or skilled need. If anticipateDischarge is unknown, avoid confident assumptions about either discharge or " +
            "continued care. " +
            "If Anticipated Ongoing Services Required is not included in requiredSections, do not generate it. " +
            "Put discharge-related language in Assessment, Therapy Plan / Main Focus for Next Visit, and Current Progress Toward Discharge Plan. " +
            "Visit type logic: for SOC or Evaluation, avoid inventing baseline function, orders, home setup, caregiver " +
            "status, or admission details not in the narrative. For Subsequent visits, keep language visit-focused and " +
            "tie assessment and plan to the documented treatment, response, education, safety, or functional limits. " +
            "For Reassessment, Recert, or ROC visits, discuss progress, response to treatment, current limitations, plan " +
            "changes, and continued skilled need only when documented; do not invent outcome measures, goal percentages, " +
            "or standardized tests. For AgencyDischarge or DisciplineDischarge, use discharge-focused language and avoid " +
            "suggesting continued PT unless explicitly documented.",
        },
        {
          role: "user",
          content: JSON.stringify({
            visitType,
            reassessmentVisit: reassessSatisfies,
            anticipateDischarge,
            requiredSections,
            narrative,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "narrative_documentation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              sections: {
                type: "array",
                minItems: requiredSections.length,
                maxItems: requiredSections.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { enum: requiredSections },
                    content: { type: "string" },
                  },
                  required: ["label", "content"],
                },
              },
            },
            required: ["sections"],
          },
        },
      },
    }),
  });

  if (!response.ok) throw generationError();

  try {
    const text = outputText(await response.json());
    if (!text) throw generationError();
    return validateSections(JSON.parse(text), requiredSections);
  } catch {
    throw generationError();
  }
}
