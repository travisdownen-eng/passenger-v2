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

const SectionSchema = z.object({
  label: z.enum(REQUIRED_NARRATIVE_SECTIONS),
  content: z.string().min(1),
});

const GeneratedDocumentationSchema = z.object({
  sections: z.array(SectionSchema).length(REQUIRED_NARRATIVE_SECTIONS.length),
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

function validateSections(value: unknown): DocSection[] {
  const parsed = GeneratedDocumentationSchema.parse(value);
  const byLabel = new Map(parsed.sections.map((section) => [section.label, section.content.trim()]));
  return REQUIRED_NARRATIVE_SECTIONS.map((label) => {
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
            "If a section cannot be safely generated, write a brief sentence that more visit detail is needed.",
        },
        {
          role: "user",
          content: JSON.stringify({
            visitType,
            reassessmentVisit: reassessSatisfies,
            anticipateDischarge,
            requiredSections: REQUIRED_NARRATIVE_SECTIONS,
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
                minItems: REQUIRED_NARRATIVE_SECTIONS.length,
                maxItems: REQUIRED_NARRATIVE_SECTIONS.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { enum: REQUIRED_NARRATIVE_SECTIONS },
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
    return validateSections(JSON.parse(text));
  } catch {
    throw generationError();
  }
}
