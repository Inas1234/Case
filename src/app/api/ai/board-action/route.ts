import { NextResponse } from "next/server";
import { z } from "zod";

import { boardStatuses, cardTags, cardTypes, verdicts } from "@/lib/board/types";

export const runtime = "nodejs";

const aiRoles = ["Skeptic", "Scientist", "Market Analyst"] as const;
const aiActions = [
  "Organize",
  "Challenge",
  "Find contradictions",
  "Compress",
  "Suggest next test",
] as const;

type AiAction = (typeof aiActions)[number];
type CardType = (typeof cardTypes)[number];
type CardTag = (typeof cardTags)[number];
type BoardStatus = (typeof boardStatuses)[number];

const priorityTags = new Set<CardTag>([
  "critical",
  "useful",
  "optional",
  "distracting",
]);

const typeToPrimaryTag: Record<CardType, CardTag> = {
  Thought: "idea",
  Question: "question",
  Evidence: "evidence",
  Screenshot: "evidence",
  Idea: "idea",
  User: "user",
  Problem: "problem",
  Assumption: "assumption",
  Risk: "risk",
  Contradiction: "problem",
  Experiment: "experiment",
  Conclusion: "conclusion",
};

const typeToPriorityTag: Record<CardType, CardTag> = {
  Thought: "optional",
  Question: "useful",
  Evidence: "useful",
  Screenshot: "useful",
  Idea: "useful",
  User: "critical",
  Problem: "critical",
  Assumption: "critical",
  Risk: "critical",
  Contradiction: "critical",
  Experiment: "useful",
  Conclusion: "optional",
};

const CardContextSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(cardTypes),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().max(2200),
  tags: z.array(z.enum(cardTags)).max(8),
});

const BoardContextSchema = z.object({
  title: z.string().trim().min(1).max(180),
  status: z.enum(boardStatuses),
  verdict: z.enum(verdicts).nullable().optional(),
  summary: z.object({
    thesis: z.string().trim().max(1600),
    topRisk: z.string().trim().max(1600),
    topOpenQuestions: z.array(z.string().trim().max(500)).max(12),
    recommendedNextStep: z.string().trim().max(1200),
  }),
  cards: z.array(CardContextSchema).max(80),
});

const BoardActionRequestSchema = z.object({
  role: z.enum(aiRoles),
  action: z.enum(aiActions),
  selectedCardIds: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  board: BoardContextSchema,
});

type BoardActionRequest = z.infer<typeof BoardActionRequestSchema>;

const AiCardDraftSchema = z.object({
  type: z.enum(cardTypes),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(700),
  tags: z.array(z.enum(cardTags)).max(6).optional().default([]),
});

const AiCardUpdateSchema = z.object({
  cardId: z.string().trim().min(1).max(80),
  type: z.enum(cardTypes).optional(),
  tags: z.array(z.enum(cardTags)).max(6).optional(),
});

const AiSummaryUpdateSchema = z.object({
  thesis: z.string().trim().max(900).optional(),
  topRisk: z.string().trim().max(900).optional(),
  topOpenQuestions: z.array(z.string().trim().min(1).max(240)).max(3).optional(),
  recommendedNextStep: z.string().trim().max(900).optional(),
  status: z.enum(boardStatuses).optional(),
});

const AiClusterSchema = z.object({
  label: z.string().trim().min(1).max(120),
  cardIds: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  rationale: z.string().trim().min(1).max(260),
});

const AiContradictionSchema = z.object({
  cardIds: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  explanation: z.string().trim().min(1).max(260),
});

const AiUnsupportedClaimSchema = z.object({
  cardId: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(260),
});

const AiActionMetaSchema = z.object({
  mostImportantWeakAssumption: z.string().trim().max(320).optional(),
  mostImportantMissingClarity: z.string().trim().max(320).optional(),
  riskiestAssumption: z.string().trim().max(320).optional(),
  ignoreForNow: z.array(z.string().trim().min(1).max(220)).max(3).optional(),
  verdictSuggestion: z.enum(verdicts).nullable().optional(),
  diminishingReturns: z.boolean().optional(),
});

const StructuredOutputSchema = z
  .object({
    note: z.string().trim().min(1).max(260),
    cardsToCreate: z.array(AiCardDraftSchema).max(8).optional(),
    cardUpdates: z.array(AiCardUpdateSchema).max(40).optional(),
    clusters: z.array(AiClusterSchema).max(6).optional(),
    contradictions: z.array(AiContradictionSchema).max(5).optional(),
    unsupportedClaims: z.array(AiUnsupportedClaimSchema).max(8).optional(),
    summaryUpdate: AiSummaryUpdateSchema.optional(),
    actionMeta: AiActionMetaSchema.optional(),
  })
  .strict();

type StructuredOutput = z.infer<typeof StructuredOutputSchema>;

type OpenRouterResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    text?: string | null;
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
          }>;
      refusal?: string | null;
    };
  }>;
  error?: {
    code?: number | string;
    message?: string;
  };
  provider?: string;
  model?: string;
};

type OpenRouterChoice = NonNullable<OpenRouterResponse["choices"]>[number];

const SYSTEM_PROMPT = [
  "You are CASE, a board-based idea investigator.",
  "You never act like a chat assistant and you are quiet by default.",
  "Work only on the requested action and board content.",
  "Prioritize decision relevance over expansion.",
  "Never ask more than 3 decision-critical questions.",
  "Never generate more than 5 challenge cards.",
  "Always identify the riskiest assumption when possible.",
  "Mark low-priority paths explicitly.",
  "If analysis has diminishing returns, say so.",
  "Treat screenshots and questions as first-class inputs.",
  "Return strict JSON only, no markdown.",
].join(" ");

function actionRules(action: AiAction) {
  switch (action) {
    case "Organize":
      return [
        "Classify and retag cards.",
        "Suggest compact clusters.",
        "Detect duplicates and key vs secondary signals.",
        "Create at most 3 summary cards plus optional thesis card.",
        "Do not deeply challenge yet.",
      ];
    case "Challenge":
      return [
        "Interrogate only selected scope or highest-risk cluster.",
        "Generate 3 to 5 challenge cards total.",
        "Return one mostImportantWeakAssumption and one mostImportantMissingClarity.",
        "Optional contradiction marker if real conflict exists.",
        "Every challenge must tie to a decision or risk.",
      ];
    case "Find contradictions":
      return [
        "Identify only real conflicts between claims/evidence/goals.",
        "Return contradiction markers and unsupported claims.",
        "One short explanation per contradiction.",
        "If none exist, state that directly in note.",
      ];
    case "Compress":
      return [
        "Reduce board complexity.",
        "Return current best interpretation, top risk, and top 1-3 unresolved questions.",
        "List what can be ignored now and recommended next move.",
        "Suggest verdict only when clarity is enough.",
      ];
    case "Suggest next test":
      return [
        "Identify riskiest assumption first.",
        "Recommend the smallest practical test that reduces uncertainty.",
        "Prefer concrete tests such as interview, fake-door, concierge, landing page, usability, niche positioning.",
        "Avoid vague research tasks.",
      ];
    default:
      return [];
  }
}

function readMessageText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") {
          return text;
        }
      }

      return "";
    })
    .join("\n")
    .trim();
}

function readChoiceText(choice: OpenRouterChoice | null | undefined) {
  if (!choice || typeof choice !== "object") {
    return "";
  }

  const messageContent = readMessageText(choice.message?.content);
  if (messageContent) {
    return messageContent;
  }

  if (typeof choice.text === "string" && choice.text.trim().length > 0) {
    return choice.text.trim();
  }

  if (
    choice.message &&
    typeof choice.message.refusal === "string" &&
    choice.message.refusal.trim().length > 0
  ) {
    return choice.message.refusal.trim();
  }

  return "";
}

function dedupeStrings(items: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(normalized);
    }
  }
  return output;
}

function normalizeTags(type: CardType, incoming: CardTag[]) {
  const deduped = dedupeStrings(incoming)
    .filter((tag): tag is CardTag => cardTags.includes(tag as CardTag))
    .slice(0, 6);
  const next = new Set<CardTag>(deduped);
  next.add(typeToPrimaryTag[type]);
  if (![...next].some((tag) => priorityTags.has(tag))) {
    next.add(typeToPriorityTag[type]);
  }
  return Array.from(next).slice(0, 6);
}

function normalizeCards(cards: StructuredOutput["cardsToCreate"] | undefined) {
  return (cards ?? []).map((card) => ({
    ...card,
    title: card.title.trim().slice(0, 160),
    content: card.content.trim().slice(0, 700),
    tags: normalizeTags(card.type, card.tags),
  }));
}

function normalizeCardUpdates(updates: StructuredOutput["cardUpdates"] | undefined) {
  return (updates ?? []).map((update) => ({
    ...update,
    tags:
      update.tags && update.type
        ? normalizeTags(update.type, update.tags)
        : update.tags
          ? dedupeStrings(update.tags).filter(
              (tag): tag is CardTag => cardTags.includes(tag as CardTag),
            )
          : undefined,
  }));
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }
    const sliced = candidate.slice(start, end + 1);
    try {
      return JSON.parse(sliced) as unknown;
    } catch {
      return null;
    }
  }
}

function statusRank(status: BoardStatus) {
  const order: BoardStatus[] = [
    "Open",
    "Under Investigation",
    "Narrowing",
    "Ready for Verdict",
    "Solved",
    "Archived",
  ];
  return order.indexOf(status);
}

function rankToStatus(rank: number): BoardStatus {
  if (rank <= 0) {
    return "Open";
  }
  if (rank === 1) {
    return "Under Investigation";
  }
  if (rank === 2) {
    return "Narrowing";
  }
  if (rank === 3) {
    return "Ready for Verdict";
  }
  if (rank === 4) {
    return "Solved";
  }
  return "Archived";
}

function minStatusForAction(action: AiAction) {
  switch (action) {
    case "Organize":
    case "Challenge":
    case "Find contradictions":
      return "Under Investigation" as BoardStatus;
    case "Compress":
    case "Suggest next test":
      return "Narrowing" as BoardStatus;
    default:
      return "Open" as BoardStatus;
  }
}

function resolveStatus(
  action: AiAction,
  current: BoardStatus,
  requested?: BoardStatus,
): BoardStatus {
  if (current === "Solved" || current === "Archived") {
    return current;
  }
  const minimumRank = statusRank(minStatusForAction(action));
  const currentRank = statusRank(current);
  const requestedRank = requested ? statusRank(requested) : -1;
  const rank = Math.max(currentRank, minimumRank, requestedRank);
  return rankToStatus(rank);
}

function getFocusCards(input: BoardActionRequest) {
  const selected = new Set(input.selectedCardIds ?? []);
  const selectedCards = input.board.cards.filter((card) => selected.has(card.id));
  return selectedCards.length > 0 ? selectedCards : input.board.cards.slice(-12);
}

function getRiskiestAssumption(input: BoardActionRequest) {
  const direct = input.board.cards.find(
    (card) => card.type === "Assumption" || card.type === "Risk",
  );
  if (direct) {
    return `${direct.title}: ${direct.content || "Assumption needs validation."}`;
  }
  if (input.board.summary.topRisk.trim()) {
    return input.board.summary.topRisk.trim();
  }
  return "Users may not care enough to change behavior.";
}

function buildChallengeFallbackCards(input: BoardActionRequest) {
  const focusCards = getFocusCards(input);
  const focusTitle = focusCards[0]?.title ?? "core claim";
  const riskiestAssumption = getRiskiestAssumption(input);

  return [
    {
      type: "Question" as CardType,
      title: "Why would users switch now?",
      content: `What concrete pain around "${focusTitle}" is strong enough to force behavior change within 30 days?`,
      tags: ["question", "critical"] as CardTag[],
    },
    {
      type: "Assumption" as CardType,
      title: "Weak assumption to verify",
      content: riskiestAssumption,
      tags: ["assumption", "critical"] as CardTag[],
    },
    {
      type: "Risk" as CardType,
      title: "Decision-risk gap",
      content:
        "No clear trigger for adoption is proven yet. Without a trigger, solution quality will not matter.",
      tags: ["risk", "critical"] as CardTag[],
    },
  ];
}

function buildFallbackOutput(input: BoardActionRequest): StructuredOutput {
  const riskiestAssumption = getRiskiestAssumption(input);
  const focusCards = getFocusCards(input);
  const topQuestionCandidates = dedupeStrings([
    ...input.board.summary.topOpenQuestions,
    "Which single persona has urgent pain right now?",
    "What behavior change proves this idea is working?",
    "What is the smallest test that can fail this assumption quickly?",
  ]).slice(0, 3);

  switch (input.action) {
    case "Organize":
      return {
        note: "Organized cards into decision-relevant structure and marked priorities.",
        cardsToCreate: [
          {
            type: "Conclusion",
            title: "Current thesis draft",
            content:
              input.board.summary.thesis.trim() ||
              "The board points to one core problem, but user urgency and switching trigger remain unproven.",
            tags: ["conclusion", "useful"],
          },
        ],
        cardUpdates: focusCards.slice(0, 10).map((card) => ({
          cardId: card.id,
          type: card.type,
          tags: normalizeTags(card.type, card.tags),
        })),
        clusters: [
          {
            label: "Core decision path",
            cardIds: focusCards.slice(0, 6).map((card) => card.id),
            rationale: "These cards directly affect user value and adoption risk.",
          },
        ],
        summaryUpdate: {
          thesis:
            input.board.summary.thesis.trim() ||
            "User problem is plausible, but the adoption trigger and wedge are still uncertain.",
          topRisk: input.board.summary.topRisk.trim() || "Assumption quality is weak.",
          topOpenQuestions: topQuestionCandidates,
          recommendedNextStep: "Challenge the strongest assumption before adding new branches.",
          status: resolveStatus(input.action, input.board.status),
        },
        actionMeta: {
          riskiestAssumption,
        },
      };
    case "Challenge":
      return {
        note: "Challenged only the highest-risk assumptions tied to the decision.",
        cardsToCreate: buildChallengeFallbackCards(input),
        summaryUpdate: {
          topRisk: "Core value and switching trigger are not yet proven.",
          topOpenQuestions: topQuestionCandidates,
          recommendedNextStep: "Run one narrow test on the riskiest assumption this week.",
          status: resolveStatus(input.action, input.board.status),
        },
        actionMeta: {
          mostImportantWeakAssumption: riskiestAssumption,
          mostImportantMissingClarity:
            "Exact user segment and trigger event for adoption are unclear.",
          riskiestAssumption,
        },
      };
    case "Find contradictions":
      return {
        note:
          focusCards.length < 2
            ? "No strong contradiction found yet; more competing claims are needed."
            : "Found one high-impact contradiction affecting feasibility.",
        cardsToCreate:
          focusCards.length < 2
            ? []
            : [
                {
                  type: "Contradiction",
                  title: "Claim/evidence mismatch",
                  content:
                    "A core claim is not backed by direct evidence yet. Confidence is ahead of proof.",
                  tags: ["problem", "critical", "warning"],
                },
              ],
        contradictions:
          focusCards.length < 2
            ? []
            : [
                {
                  cardIds: focusCards.slice(0, 2).map((card) => card.id),
                  explanation:
                    "The current evidence does not directly support the strongest claim.",
                },
              ],
        summaryUpdate: {
          topRisk:
            input.board.summary.topRisk.trim() ||
            "Claims are stronger than available evidence.",
          recommendedNextStep:
            "Collect direct evidence that can support or falsify the top claim.",
          status: resolveStatus(input.action, input.board.status),
        },
      };
    case "Compress": {
      const unresolved = dedupeStrings([
        ...input.board.summary.topOpenQuestions,
        "Who is the first narrow user we are committing to?",
        "What result would make us stop this direction?",
      ]).slice(0, 3);
      const resolvedStatus = unresolved.length <= 1 ? "Ready for Verdict" : "Narrowing";

      return {
        note: "Compressed the board to core risk, core questions, and next move.",
        cardsToCreate: [
          {
            type: "Conclusion",
            title: "Compressed board state",
            content:
              "Idea is clearer, but one assumption still dominates risk. Ignore non-blocking branches for now.",
            tags: ["conclusion", "critical"],
          },
        ],
        summaryUpdate: {
          thesis:
            input.board.summary.thesis.trim() ||
            "The idea could work for a narrow segment if adoption trigger is validated quickly.",
          topRisk:
            input.board.summary.topRisk.trim() ||
            "Users may not switch from current behavior.",
          topOpenQuestions: unresolved,
          recommendedNextStep: "Run one fast test focused on switching trigger and willingness.",
          status: resolveStatus(input.action, input.board.status, resolvedStatus),
        },
        actionMeta: {
          riskiestAssumption,
          ignoreForNow: [
            "Long-tail feature requests",
            "Brand details before core value is proven",
          ],
          verdictSuggestion: unresolved.length <= 1 ? "Test first" : null,
          diminishingReturns: unresolved.length <= 1,
        },
      };
    }
    case "Suggest next test":
      return {
        note: "Proposed the smallest realistic test that can reduce the top uncertainty.",
        cardsToCreate: [
          {
            type: "Experiment",
            title: "Fast test for riskiest assumption",
            content:
              "Interview 5 target users with a fake-door or concierge offer this week; success means at least 2 users request immediate follow-up.",
            tags: ["experiment", "critical"],
          },
        ],
        summaryUpdate: {
          topRisk: input.board.summary.topRisk.trim() || "Riskiest assumption is unvalidated.",
          topOpenQuestions: topQuestionCandidates.slice(0, 2),
          recommendedNextStep:
            "Execute the test this week and decide: proceed, pivot, or pause based on observed behavior.",
          status: resolveStatus(input.action, input.board.status),
        },
        actionMeta: {
          riskiestAssumption,
          mostImportantMissingClarity: "What behavior confirms real demand, not polite feedback?",
        },
      };
    default:
      return {
        note: "Kept board work focused on the highest-risk decision thread.",
      };
  }
}

function applyActionLimits(input: BoardActionRequest, output: StructuredOutput) {
  const limitedCards = normalizeCards(output.cardsToCreate);
  const limitedUpdates = normalizeCardUpdates(output.cardUpdates);
  const summaryUpdate = output.summaryUpdate
    ? {
        ...output.summaryUpdate,
        topOpenQuestions: output.summaryUpdate.topOpenQuestions
          ? dedupeStrings(output.summaryUpdate.topOpenQuestions).slice(0, 3)
          : undefined,
        status: resolveStatus(input.action, input.board.status, output.summaryUpdate.status),
      }
    : undefined;

  let cardsToCreate: StructuredOutput["cardsToCreate"] = limitedCards;

  if (input.action === "Organize") {
    cardsToCreate = cardsToCreate.slice(0, 4);
  }

  if (input.action === "Challenge") {
    cardsToCreate = cardsToCreate.slice(0, 5);
    if (cardsToCreate.length < 3) {
      cardsToCreate = [...cardsToCreate, ...buildChallengeFallbackCards(input)].slice(0, 5);
    }
  }

  if (input.action === "Find contradictions") {
    cardsToCreate = cardsToCreate.slice(0, 5);
  }

  if (input.action === "Compress") {
    cardsToCreate = cardsToCreate.slice(0, 3);
  }

  if (input.action === "Suggest next test") {
    cardsToCreate = cardsToCreate.slice(0, 3);
  }

  let questionCount = 0;
  cardsToCreate = cardsToCreate.map((card) => {
    if (card.type !== "Question") {
      return card;
    }
    questionCount += 1;
    if (questionCount <= 3) {
      return card;
    }
    const convertedType = "Assumption" as CardType;
    return {
      ...card,
      type: convertedType,
      tags: normalizeTags(convertedType, card.tags),
    };
  });

  return {
    ...output,
    cardsToCreate,
    cardUpdates: limitedUpdates,
    summaryUpdate,
    clusters: output.clusters?.slice(0, 6),
    contradictions: output.contradictions?.slice(0, 5),
    unsupportedClaims: output.unsupportedClaims?.slice(0, 8),
  };
}

function buildUserPrompt(input: BoardActionRequest) {
  const selected = new Set(input.selectedCardIds ?? []);
  const cardLines =
    input.board.cards.length === 0
      ? ["- No cards yet."]
      : input.board.cards.map((card, index) => {
          const safeTags = card.tags.length > 0 ? card.tags.join(", ") : "none";
          const selectedMark = selected.has(card.id) ? " [SELECTED]" : "";
          return [
            `- #${index + 1} (${card.id}) [${card.type}] ${card.title}${selectedMark}`,
            `  content: ${card.content || "(empty)"}`,
            `  tags: ${safeTags}`,
          ].join("\n");
        });

  const openQuestions =
    input.board.summary.topOpenQuestions.length === 0
      ? "- none"
      : input.board.summary.topOpenQuestions.map((question) => `- ${question}`).join("\n");

  const schemaGuide = [
    "{",
    '  "note": "short action result",',
    '  "cardsToCreate": [',
    '    { "type": "Question", "title": "...", "content": "...", "tags": ["question","critical"] }',
    "  ],",
    '  "cardUpdates": [',
    '    { "cardId": "existing-card-id", "type": "Assumption", "tags": ["assumption","critical"] }',
    "  ],",
    '  "clusters": [{ "label": "...", "cardIds": ["id1"], "rationale": "..." }],',
    '  "contradictions": [{ "cardIds": ["id1","id2"], "explanation": "..." }],',
    '  "unsupportedClaims": [{ "cardId": "id1", "reason": "..." }],',
    '  "summaryUpdate": {',
    '    "thesis": "...",',
    '    "topRisk": "...",',
    '    "topOpenQuestions": ["max 3 items"],',
    '    "recommendedNextStep": "...",',
    '    "status": "Open|Under Investigation|Narrowing|Ready for Verdict|Solved|Archived"',
    "  },",
    '  "actionMeta": {',
    '    "mostImportantWeakAssumption": "...",',
    '    "mostImportantMissingClarity": "...",',
    '    "riskiestAssumption": "...",',
    '    "ignoreForNow": ["..."],',
    '    "verdictSuggestion": "Proceed|Test first|Pivot|Pause|Kill|null",',
    '    "diminishingReturns": false',
    "  }",
    "}",
  ].join("\n");

  return [
    `Role: ${input.role}`,
    `Action: ${input.action}`,
    `Board title: ${input.board.title}`,
    `Board status: ${input.board.status}`,
    `Board verdict: ${input.board.verdict ?? "none"}`,
    "",
    "Action requirements:",
    ...actionRules(input.action).map((rule) => `- ${rule}`),
    `- Allowed card types: ${cardTypes.join(", ")}`,
    `- Allowed tags: ${cardTags.join(", ")}`,
    "",
    "Board summary:",
    `- Thesis: ${input.board.summary.thesis || "none"}`,
    `- Top risk: ${input.board.summary.topRisk || "none"}`,
    "- Top open questions:",
    openQuestions,
    `- Recommended next step: ${input.board.summary.recommendedNextStep || "none"}`,
    "",
    "Cards:",
    cardLines.join("\n"),
    "",
    "Respond with valid JSON only, using this schema guide:",
    schemaGuide,
  ].join("\n");
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const candidate = (payload as { error?: { message?: unknown } }).error?.message;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return fallback;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing OPENROUTER_API_KEY. Add it to your environment before using AI actions.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BoardActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI action payload." }, { status: 400 });
  }

  const input = parsed.data;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
  const userPrompt = buildUserPrompt(input);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_SITE_NAME) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_SITE_NAME;
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        ...(fallbackModel && fallbackModel !== model
          ? { models: [model, fallbackModel] }
          : {}),
        temperature: 0.25,
        max_completion_tokens: 950,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });
  } catch {
    const fallback = applyActionLimits(input, buildFallbackOutput(input));
    return NextResponse.json(
      {
        ...fallback,
        model,
        provider: null,
        fallback: true,
        warning: "Failed to reach OpenRouter. Fallback action output was used.",
      },
      { status: 200 },
    );
  }

  let payload: OpenRouterResponse | unknown;
  try {
    payload = (await upstream.json()) as OpenRouterResponse;
  } catch {
    const fallback = applyActionLimits(input, buildFallbackOutput(input));
    return NextResponse.json(
      {
        ...fallback,
        model,
        provider: null,
        fallback: true,
        warning: "OpenRouter returned a non-JSON response. Fallback action output was used.",
      },
      { status: 200 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: getErrorMessage(payload, "OpenRouter request failed.") },
      { status: upstream.status },
    );
  }

  const completion = payload as OpenRouterResponse;

  if (completion.error?.message) {
    const fallback = applyActionLimits(input, buildFallbackOutput(input));
    return NextResponse.json(
      {
        ...fallback,
        model: completion.model ?? model,
        provider: completion.provider ?? null,
        fallback: true,
        warning: completion.error.message,
      },
      { status: 200 },
    );
  }

  const firstChoice = completion.choices?.[0];
  const text = firstChoice ? readChoiceText(firstChoice) : "";
  const maybeJson = extractJson(text);
  const structured = maybeJson ? StructuredOutputSchema.safeParse(maybeJson) : null;

  if (!structured?.success) {
    const fallback = applyActionLimits(input, buildFallbackOutput(input));
    return NextResponse.json({
      ...fallback,
      model: completion.model ?? model,
      provider: completion.provider ?? null,
      fallback: true,
      warning:
        firstChoice?.finish_reason === "length"
          ? "Model output hit token limit; fallback action output was used."
          : "Model output was not valid structured JSON; fallback action output was used.",
    });
  }

  const bounded = applyActionLimits(input, structured.data);

  return NextResponse.json({
    ...bounded,
    model: completion.model ?? model,
    provider: completion.provider ?? null,
    fallback: false,
  });
}
