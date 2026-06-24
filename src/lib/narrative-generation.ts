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
            "Universal Safety Rules: use only information documented in the narrative. Preserve uncertainty when details " +
            "are vague. If the narrative lacks sufficient detail for a section, briefly state what additional visit detail " +
            "is needed rather than padding content. Never invent diagnoses, falls, assistance levels, outcome measure scores, " +
            "wound measurements, medication changes, physician communication, caregiver availability, objective testing " +
            "results, progress toward goals, vital signs, or patient response to treatment. Avoid CMS/legal phrases such as " +
            "'meets criteria' or 'taxing effort'. " +
            "Documentation Style Rules: write patient-specific, clinically supportable, non-boilerplate language. Keep each " +
            "section concise, preferably 1-3 clinically dense sentences. Do not repeat the same information across sections. " +
            "When supported by the narrative, explain why skilled care was required, what skilled intervention occurred, " +
            "and the patient-specific deficit, safety concern, education need, complexity, or functional limitation requiring " +
            "skilled judgment. Avoid generic boilerplate such as 'will benefit from therapy' or 'continue per plan of care'. " +
            "Section-Specific Rules: Homebound Status should only use documented mobility limitations, devices, assistance, " +
            "endurance limitations, pain, weakness, dyspnea, cognitive deficits, neurological deficits, or environmental " +
            "barriers. Do not say the patient is homebound without supporting detail or state Medicare criteria are met. " +
            "Assessment should answer what problem exists, what skilled service occurred, why skill was required, patient " +
            "response when documented, and why continued care is needed if applicable. Avoid 'tolerated treatment well', " +
            "activity lists, and unsupported conclusions. Therapy Plan / Main Focus for Next Visit should focus on the next " +
            "skilled intervention, education reinforcement, safety, caregiver training, or progression using only documented " +
            "needs or barriers. Do not repeat the assessment. Anticipated Ongoing Services Required applies only when this " +
            "section is included in requiredSections and should describe ongoing services only when supported by documented " +
            "deficits, skilled need, or an explicitly stated service plan. Current Progress Toward Discharge Plan should " +
            "focus on documented gains, documented barriers, remaining deficits, or remaining caregiver needs. Do not " +
            "automatically state that the patient is progressing or that discharge is approaching, and do not repeat the " +
            "assessment; if detail is limited, state that additional discharge detail is needed. " +
            "Visit-Type Rules: for SOC or Evaluation, avoid inventing baseline function, orders, home setup, caregiver " +
            "status, or admission details not in the narrative. For Subsequent visits, keep language visit-focused and tie " +
            "assessment and plan to the documented treatment, response, education, safety, or functional limits. For " +
            "Reassessment, Recert/Recertification, or ROC visits, focus on documented progress toward goals, remaining " +
            "deficits, justification for continued services, response to prior interventions, and skilled need. Do not " +
            "invent outcome measures, goal percentages, or progress. If reassessment detail is limited, state that " +
            "additional reassessment information is needed. For AgencyDischarge or DisciplineDischarge, use discharge-focused " +
            "language and avoid suggesting continued PT unless explicitly documented. " +
            "Discharge Rules: if anticipateDischarge is yes, do not generate Anticipated Ongoing Services Required when it " +
            "is not included in requiredSections. Put discharge-related language in Assessment, Therapy Plan / Main Focus " +
            "for Next Visit, and Current Progress Toward Discharge Plan. When anticipateDischarge is yes, make the Therapy " +
            "Plan focus on discharge readiness, final safety or HEP review, caregiver education, or remaining barriers if " +
            "documented. If anticipateDischarge is no, ongoing services may be described only when supported by documented " +
            "deficits or skilled need. If anticipateDischarge is unknown, avoid confident assumptions about either discharge " +
            "or continued care.",
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
