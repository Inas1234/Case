"use client";

import { Download, LogOut, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CanvasRouter } from "@/components/board/canvas-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { boardToMarkdown } from "@/lib/board/export";
import {
  boardStatuses,
  cardTags,
  cardTypes,
  verdicts,
  type Board,
  type BoardCard,
  type BoardListItem,
  type BoardStatus,
  type CardTag,
  type CardType,
  type Verdict,
} from "@/lib/board/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const roleOptions = ["Skeptic", "Scientist", "Market Analyst"] as const;
type AiRole = (typeof roleOptions)[number];
type AiAction =
  | "Organize"
  | "Challenge"
  | "Find contradictions"
  | "Compress"
  | "Suggest next test";

const priorityTagOrder = ["critical", "useful", "optional", "distracting"] as const;
const priorityTagSet = new Set<CardTag>(priorityTagOrder);

const typeToTag: Record<CardType, CardTag> = {
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

interface AiBoardActionRequest {
  role: AiRole;
  action: AiAction;
  selectedCardIds?: string[];
  board: {
    title: string;
    status: BoardStatus;
    verdict?: Verdict | null;
    summary: {
      thesis: string;
      topRisk: string;
      topOpenQuestions: string[];
      recommendedNextStep: string;
    };
    cards: Array<{
      id: string;
      type: CardType;
      title: string;
      content: string;
      tags: CardTag[];
    }>;
  };
}

interface AiCardDraft {
  type: CardType;
  title: string;
  content: string;
  tags: CardTag[];
}

interface AiCardUpdate {
  cardId: string;
  type?: CardType;
  tags?: CardTag[];
}

interface AiSummaryUpdate {
  thesis?: string;
  topRisk?: string;
  topOpenQuestions?: string[];
  recommendedNextStep?: string;
  status?: BoardStatus;
}

interface AiBoardActionResponse {
  note?: string;
  cardsToCreate?: AiCardDraft[];
  cardUpdates?: AiCardUpdate[];
  summaryUpdate?: AiSummaryUpdate;
  actionMeta?: {
    mostImportantWeakAssumption?: string;
    mostImportantMissingClarity?: string;
    riskiestAssumption?: string;
    ignoreForNow?: string[];
    verdictSuggestion?: Verdict | null;
    diminishingReturns?: boolean;
  };
  model?: string;
  provider?: string | null;
  fallback?: boolean;
  warning?: string;
  error?: string;
}

type DbCardRow = {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  position_x: number | null;
  position_y: number | null;
  ai_origin: boolean | null;
};

function asCardType(value: unknown): CardType {
  return cardTypes.includes(value as CardType) ? (value as CardType) : "Thought";
}

function asCardTags(value: unknown): CardTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((tag): tag is CardTag => cardTags.includes(tag as CardTag));
}

function mapCardRow(row: DbCardRow): BoardCard {
  return {
    id: String(row.id),
    type: asCardType(row.type),
    title: String(row.title ?? "Untitled note"),
    content: String(row.content ?? ""),
    tags: asCardTags(row.tags),
    position: {
      x: Number(row.position_x ?? 120),
      y: Number(row.position_y ?? 120),
    },
    aiOrigin: Boolean(row.ai_origin),
  };
}

function dedupeTags(tags: CardTag[]) {
  return Array.from(new Set(tags));
}

function sanitizeCardTags(type: CardType, tags: CardTag[]) {
  const safeTags = dedupeTags(tags).filter((tag) => cardTags.includes(tag));
  if (!safeTags.includes(typeToTag[type])) {
    safeTags.unshift(typeToTag[type]);
  }
  const hasPriority = safeTags.some((tag) => priorityTagSet.has(tag));
  if (!hasPriority) {
    safeTags.push("useful");
  }
  return dedupeTags(safeTags).slice(0, 6);
}

function sanitizeSummaryUpdate(update: AiSummaryUpdate | undefined) {
  if (!update) {
    return undefined;
  }

  return {
    thesis: typeof update.thesis === "string" ? update.thesis.trim() : undefined,
    topRisk: typeof update.topRisk === "string" ? update.topRisk.trim() : undefined,
    topOpenQuestions: Array.isArray(update.topOpenQuestions)
      ? update.topOpenQuestions
          .map((question) => question.trim())
          .filter((question) => question.length > 0)
          .slice(0, 3)
      : undefined,
    recommendedNextStep:
      typeof update.recommendedNextStep === "string"
        ? update.recommendedNextStep.trim()
        : undefined,
    status:
      update.status && boardStatuses.includes(update.status as BoardStatus)
        ? (update.status as BoardStatus)
        : undefined,
  };
}

function buildAiRequestPayload(
  board: Board,
  role: AiRole,
  action: AiAction,
  selectedCardId: string | null,
): AiBoardActionRequest {
  return {
    role,
    action,
    selectedCardIds: selectedCardId ? [selectedCardId] : [],
    board: {
      title: board.title,
      status: board.status,
      verdict: board.verdict,
      summary: {
        thesis: board.summary.thesis,
        topRisk: board.summary.topRisk,
        topOpenQuestions: board.summary.topOpenQuestions,
        recommendedNextStep: board.summary.recommendedNextStep,
      },
      cards: board.cards.slice(-40).map((card) => ({
        id: card.id,
        type: card.type,
        title: card.title.slice(0, 180),
        content: card.content.slice(0, 2200),
        tags: card.tags,
      })),
    },
  };
}

function updateBoardListEntry(
  list: BoardListItem[],
  boardId: string,
  patch: Partial<BoardListItem>,
) {
  return list
    .map((item) =>
      item.id === boardId
        ? {
            ...item,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : item,
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface BoardWorkspaceProps {
  userId: string;
  userEmail: string;
  initialBoard: Board | null;
  initialBoards: BoardListItem[];
}

export function BoardWorkspace({
  userId,
  userEmail,
  initialBoard,
  initialBoards,
}: BoardWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [board, setBoard] = useState<Board | null>(initialBoard);
  const [boards, setBoards] = useState<BoardListItem[]>(initialBoards);
  const [newCardType, setNewCardType] = useState<CardType>("Thought");
  const [aiRole, setAiRole] = useState<AiRole>("Skeptic");
  const [lastAiAction, setLastAiAction] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    initialBoard?.cards[0]?.id ?? null,
  );
  const [zoom, setZoom] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
      }
    };
  }, []);

  const boardUpdatedAt = useMemo(
    () => (board ? new Date(board.updatedAt).toLocaleString() : "--"),
    [board],
  );
  const selectedCard = useMemo(
    () => (board ? board.cards.find((card) => card.id === selectedCardId) ?? null : null),
    [board, selectedCardId],
  );
  const zoomPercent = Math.round(zoom * 100);

  const persistBoardPatch = async (
    boardId: string,
    patch: Record<string, unknown>,
  ) => {
    setIsSaving(true);
    const { error } = await supabase.from("boards").update(patch).eq("id", boardId);
    setIsSaving(false);

    if (error) {
      setErrorText(error.message);
      return false;
    }

    return true;
  };

  const persistCardPatch = async (
    cardId: string,
    patch: Partial<{
      type: CardType;
      title: string;
      content: string;
      tags: CardTag[];
      position_x: number;
      position_y: number;
    }>,
  ) => {
    const { error } = await supabase.from("board_cards").update(patch).eq("id", cardId);
    if (error) {
      setErrorText(error.message);
      return false;
    }
    return true;
  };

  const updateCardLocal = (cardId: string, patch: Partial<BoardCard>) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: prev.cards.map((card) =>
              card.id === cardId ? { ...card, ...patch } : card,
            ),
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
  };

  const loadBoard = async (boardId: string) => {
    if (boardId === board?.id) {
      return;
    }

    setIsLoadingBoard(true);
    setErrorText("");

    const { data: boardRow, error: boardError } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .single();

    if (boardError || !boardRow) {
      setIsLoadingBoard(false);
      setErrorText(boardError?.message ?? "Could not load board.");
      return;
    }

    const { data: cardRows, error: cardsError } = await supabase
      .from("board_cards")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true });

    if (cardsError) {
      setIsLoadingBoard(false);
      setErrorText(cardsError.message);
      return;
    }

    const topOpenQuestions = Array.isArray(boardRow.top_open_questions)
      ? boardRow.top_open_questions.map((item: unknown) => String(item))
      : [];

    const status: BoardStatus = boardStatuses.includes(boardRow.status as BoardStatus)
      ? (boardRow.status as BoardStatus)
      : "Open";

    const nextBoard: Board = {
      id: String(boardRow.id),
      title: String(boardRow.title ?? "Untitled Case"),
      type:
        boardRow.board_type === "Startup" || boardRow.board_type === "Product"
          ? boardRow.board_type
          : "Blank",
      status,
      verdict:
        boardRow.verdict && verdicts.includes(boardRow.verdict as Verdict)
          ? (boardRow.verdict as Verdict)
          : null,
      cards: ((cardRows ?? []) as DbCardRow[]).map(mapCardRow),
      summary: {
        thesis: String(boardRow.thesis ?? ""),
        topRisk: String(boardRow.top_risk ?? ""),
        topOpenQuestions,
        recommendedNextStep: String(boardRow.recommended_next_step ?? ""),
        status,
      },
      updatedAt: String(boardRow.updated_at ?? new Date().toISOString()),
    };

    setBoard(nextBoard);
    setSelectedCardId(nextBoard.cards[0]?.id ?? null);
    setIsLoadingBoard(false);
  };

  const handleCreateBoard = async () => {
    setIsSaving(true);
    setErrorText("");

    const { data: createdBoard, error } = await supabase
      .from("boards")
      .insert({
        owner_id: userId,
        title: "Untitled Case",
        board_type: "Blank",
        status: "Open",
        thesis: "",
        top_risk: "",
        top_open_questions: [],
        recommended_next_step: "",
      })
      .select("*")
      .single();

    if (error || !createdBoard) {
      setIsSaving(false);
      setErrorText(error?.message ?? "Could not create board.");
      return;
    }

    const status = "Open" as BoardStatus;
    const newBoard: Board = {
      id: String(createdBoard.id),
      title: String(createdBoard.title ?? "Untitled Case"),
      type: "Blank",
      status,
      verdict: null,
      cards: [],
      summary: {
        thesis: "",
        topRisk: "",
        topOpenQuestions: [],
        recommendedNextStep: "",
        status,
      },
      updatedAt: String(createdBoard.updated_at ?? new Date().toISOString()),
    };

    setBoard(newBoard);
    setSelectedCardId(null);
    setBoards((prev) =>
      updateBoardListEntry(
        [
          {
            id: newBoard.id,
            title: newBoard.title,
            status: newBoard.status,
            updatedAt: newBoard.updatedAt,
          },
          ...prev,
        ],
        newBoard.id,
        {},
      ),
    );
    setIsSaving(false);
  };

  const handleBoardTitleChange = (title: string) => {
    if (!board) {
      return;
    }

    const boardId = board.id;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            title,
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setBoards((prev) => updateBoardListEntry(prev, boardId, { title }));

    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }

    titleDebounceRef.current = setTimeout(() => {
      void persistBoardPatch(boardId, { title });
    }, 400);
  };

  const updateBoardCards = (cards: BoardCard[]) => {
    if (!board) {
      return;
    }

    const boardId = board.id;
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }

      const previousById = new Map(prev.cards.map((card) => [card.id, card]));
      const changed = cards.filter((card) => {
        const before = previousById.get(card.id);
        if (!before) {
          return false;
        }
        return (
          before.position.x !== card.position.x || before.position.y !== card.position.y
        );
      });

      if (changed.length > 0) {
        void Promise.all(
          changed.map((card) =>
            persistCardPatch(card.id, {
              position_x: card.position.x,
              position_y: card.position.y,
            }),
          ),
        );
      }

      return {
        ...prev,
        cards,
        updatedAt: new Date().toISOString(),
      };
    });
    setBoards((prev) => updateBoardListEntry(prev, boardId, {}));
  };

  const handleAddCard = async () => {
    if (!board) {
      return;
    }

    setErrorText("");
    const createdCount = board.cards.length + 1;
    const boardId = board.id;

    const { data, error } = await supabase
      .from("board_cards")
      .insert({
        board_id: boardId,
        created_by: userId,
        type: newCardType,
        title: `${newCardType} ${createdCount}`,
        content: "Add details, evidence, or a sharper question.",
        tags: [typeToTag[newCardType]],
        position_x: 160 + (createdCount % 2) * 470,
        position_y: 150 + (createdCount % 2) * 180,
        ai_origin: false,
      })
      .select("*")
      .single();

    if (error || !data) {
      setErrorText(error?.message ?? "Could not create note.");
      return;
    }

    const nextCard = mapCardRow(data as DbCardRow);
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: [...prev.cards, nextCard],
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setSelectedCardId(nextCard.id);
    setBoards((prev) => updateBoardListEntry(prev, boardId, {}));
  };

  const handleAiAction = async (action: AiAction) => {
    if (!board || isAiThinking) {
      return;
    }

    const boardSnapshot = board;
    const boardId = board.id;
    setIsAiThinking(true);
    setErrorText("");

    let aiPayload: AiBoardActionResponse | null = null;
    let usedFallback = false;
    let modelLabel = "";

    try {
      const aiResponse = await fetch("/api/ai/board-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAiRequestPayload(boardSnapshot, aiRole, action, selectedCardId)),
      });

      const payload = (await aiResponse.json()) as AiBoardActionResponse;
      if (!aiResponse.ok) {
        throw new Error(payload.error ?? "AI request failed.");
      }

      aiPayload = payload;
      usedFallback = Boolean(payload.fallback);

      if (typeof payload.model === "string" && payload.model.trim().length > 0) {
        modelLabel = ` via ${payload.model}`;
      }

      if (typeof payload.warning === "string" && payload.warning.trim().length > 0) {
        setErrorText(payload.warning);
      }
      const cardsToCreate = Array.isArray(aiPayload.cardsToCreate)
        ? aiPayload.cardsToCreate
            .filter((card): card is AiCardDraft => cardTypes.includes(card.type as CardType))
            .map((card) => {
              const type = card.type;
              const title = card.title.trim().slice(0, 160) || `${action} (${aiRole})`;
              const content = card.content.trim().slice(0, 700) || "No details provided.";
              const tags = sanitizeCardTags(type, card.tags ?? [typeToTag[type]]);
              return {
                type,
                title,
                content,
                tags,
              };
            })
        : [];

      const cardUpdates = Array.isArray(aiPayload.cardUpdates)
        ? aiPayload.cardUpdates
            .filter((update) => typeof update.cardId === "string" && update.cardId.trim().length > 0)
            .map((update) => {
              const nextType =
                update.type && cardTypes.includes(update.type as CardType)
                  ? (update.type as CardType)
                  : undefined;
              const nextTags = Array.isArray(update.tags)
                ? (update.tags.filter((tag): tag is CardTag => cardTags.includes(tag as CardTag)) as CardTag[])
                : undefined;
              return {
                cardId: update.cardId,
                type: nextType,
                tags: nextType && nextTags ? sanitizeCardTags(nextType, nextTags) : nextTags,
              };
            })
        : [];

      const successfulUpdates: AiCardUpdate[] = [];
      await Promise.all(
        cardUpdates.map(async (update) => {
          const patch: Partial<{
            type: CardType;
            tags: CardTag[];
          }> = {};
          if (update.type) {
            patch.type = update.type;
          }
          if (update.tags && update.tags.length > 0) {
            patch.tags = dedupeTags(update.tags).slice(0, 6);
          }
          if (!patch.type && !patch.tags) {
            return;
          }
          const ok = await persistCardPatch(update.cardId, patch);
          if (ok) {
            successfulUpdates.push({
              cardId: update.cardId,
              type: patch.type,
              tags: patch.tags,
            });
          }
        }),
      );

      let insertedCards: BoardCard[] = [];
      if (cardsToCreate.length > 0) {
        const { data, error } = await supabase
          .from("board_cards")
          .insert(
            cardsToCreate.map((card, index) => ({
              board_id: boardId,
              created_by: userId,
              type: card.type,
              title: card.title,
              content: card.content,
              tags: card.tags,
              position_x: 620 + (index % 2) * 460,
              position_y: 180 + Math.floor(index / 2) * 210 + boardSnapshot.cards.length * 8,
              ai_origin: true,
            })),
          )
          .select("*");

        if (error) {
          throw new Error(error.message || "Could not add AI notes.");
        }

        insertedCards = ((data ?? []) as DbCardRow[]).map(mapCardRow);
      }

      const summaryUpdate = sanitizeSummaryUpdate(aiPayload.summaryUpdate);
      const nextStatus = summaryUpdate?.status ?? boardSnapshot.status;
      const boardPatch: Record<string, unknown> = {};
      if (summaryUpdate?.thesis !== undefined) {
        boardPatch.thesis = summaryUpdate.thesis;
      }
      if (summaryUpdate?.topRisk !== undefined) {
        boardPatch.top_risk = summaryUpdate.topRisk;
      }
      if (summaryUpdate?.topOpenQuestions !== undefined) {
        boardPatch.top_open_questions = summaryUpdate.topOpenQuestions;
      }
      if (summaryUpdate?.recommendedNextStep !== undefined) {
        boardPatch.recommended_next_step = summaryUpdate.recommendedNextStep;
      }
      if (nextStatus !== boardSnapshot.status) {
        boardPatch.status = nextStatus;
      }

      if (Object.keys(boardPatch).length > 0) {
        await persistBoardPatch(boardId, boardPatch);
      }

      setBoard((prev) => {
        if (!prev) {
          return prev;
        }

        const updatesById = new Map(successfulUpdates.map((update) => [update.cardId, update]));
        const updatedCards = prev.cards.map((card) => {
          const update = updatesById.get(card.id);
          if (!update) {
            return card;
          }

          const nextType = update.type ?? card.type;
          const nextTags =
            update.tags && update.tags.length > 0
              ? sanitizeCardTags(nextType, update.tags)
              : card.tags;

          return {
            ...card,
            type: nextType,
            tags: nextTags,
          };
        });

        return {
          ...prev,
          cards: [...updatedCards, ...insertedCards],
          status: nextStatus,
          summary: {
            ...prev.summary,
            thesis: summaryUpdate?.thesis ?? prev.summary.thesis,
            topRisk: summaryUpdate?.topRisk ?? prev.summary.topRisk,
            topOpenQuestions: summaryUpdate?.topOpenQuestions ?? prev.summary.topOpenQuestions,
            recommendedNextStep:
              summaryUpdate?.recommendedNextStep ?? prev.summary.recommendedNextStep,
            status: nextStatus,
          },
          updatedAt: new Date().toISOString(),
        };
      });

      if (insertedCards.length > 0) {
        setSelectedCardId(insertedCards[insertedCards.length - 1].id);
      }
      setBoards((prev) =>
        updateBoardListEntry(prev, boardId, {
          status: nextStatus,
        }),
      );

      const notePrefix =
        aiPayload.note && aiPayload.note.trim().length > 0
          ? aiPayload.note.trim()
          : `${action} completed with role ${aiRole}.`;
      const riskTail =
        aiPayload.actionMeta?.riskiestAssumption &&
        aiPayload.actionMeta.riskiestAssumption.trim().length > 0
          ? ` Riskiest assumption: ${aiPayload.actionMeta.riskiestAssumption.trim()}`
          : "";

      setLastAiAction(
        `${notePrefix}${usedFallback ? " (fallback output)." : `${modelLabel}.`}${riskTail}`,
      );
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "AI action failed.");
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleDeleteSelectedCard = async () => {
    if (!board || !selectedCard || isDeletingCard) {
      return;
    }

    setIsDeletingCard(true);
    setErrorText("");

    const boardId = board.id;
    const selectedId = selectedCard.id;
    const selectedIndex = board.cards.findIndex((card) => card.id === selectedId);

    const { error } = await supabase.from("board_cards").delete().eq("id", selectedId);

    if (error) {
      setErrorText(error.message);
      setIsDeletingCard(false);
      return;
    }

    const remainingCards = board.cards.filter((card) => card.id !== selectedId);
    const nextSelected =
      remainingCards[selectedIndex] ??
      remainingCards[Math.max(selectedIndex - 1, 0)] ??
      null;

    setBoard((prev) =>
      prev
        ? {
            ...prev,
            cards: prev.cards.filter((card) => card.id !== selectedId),
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setSelectedCardId(nextSelected?.id ?? null);
    setBoards((prev) => updateBoardListEntry(prev, boardId, {}));
    setIsDeletingCard(false);
  };

  const handleStatusChange = async (status: BoardStatus) => {
    if (!board) {
      return;
    }

    const boardId = board.id;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            status,
            summary: { ...prev.summary, status },
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setBoards((prev) => updateBoardListEntry(prev, boardId, { status }));
    await persistBoardPatch(boardId, { status });
  };

  const handleVerdictChange = async (verdict: Verdict | "none") => {
    if (!board) {
      return;
    }

    const boardId = board.id;
    const nextVerdict = verdict === "none" ? null : verdict;
    const nextStatus = verdict === "none" ? board.status : "Solved";

    setBoard((prev) =>
      prev
        ? {
            ...prev,
            verdict: nextVerdict,
            status: nextStatus,
            summary: { ...prev.summary, status: nextStatus },
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setBoards((prev) => updateBoardListEntry(prev, boardId, { status: nextStatus }));
    await persistBoardPatch(boardId, { verdict: nextVerdict, status: nextStatus });
  };

  const handleNoteTypeChange = async (value: string | null) => {
    if (!value || !selectedCard) {
      return;
    }

    const nextType = value as CardType;
    updateCardLocal(selectedCard.id, { type: nextType });

    if (selectedCard.tags.length === 0) {
      const tags = [typeToTag[nextType]];
      updateCardLocal(selectedCard.id, { tags });
      await persistCardPatch(selectedCard.id, { type: nextType, tags });
      return;
    }

    await persistCardPatch(selectedCard.id, { type: nextType });
  };

  const handleNoteTitleBlur = async () => {
    if (!selectedCard) {
      return;
    }
    await persistCardPatch(selectedCard.id, { title: selectedCard.title });
  };

  const handleNoteContentBlur = async () => {
    if (!selectedCard) {
      return;
    }
    await persistCardPatch(selectedCard.id, { content: selectedCard.content });
  };

  const handleTagsBlur = async (
    cardId: string,
    rawValue: string,
    fallbackType: CardType,
  ) => {
    const parsed = rawValue
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag): tag is CardTag => cardTags.includes(tag as CardTag));

    const nextTags = parsed.length > 0 ? parsed : [typeToTag[fallbackType]];
    updateCardLocal(cardId, { tags: nextTags });
    await persistCardPatch(cardId, { tags: nextTags });
  };

  const handleExportJson = () => {
    if (!board) {
      return;
    }
    downloadText(
      `${board.title.replace(/\s+/g, "-").toLowerCase()}.json`,
      JSON.stringify(board, null, 2),
    );
  };

  const handleExportMarkdown = () => {
    if (!board) {
      return;
    }
    downloadText(
      `${board.title.replace(/\s+/g, "-").toLowerCase()}.md`,
      boardToMarkdown(board),
    );
  };

  const zoomIn = () => setZoom((prev) => Math.min(1.8, Number((prev + 0.1).toFixed(2))));
  const zoomOut = () => setZoom((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))));
  const zoomReset = () => setZoom(1);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border/70 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Investigation Workspace
            </p>
            <Input
              value={board?.title ?? ""}
              onChange={(event) => handleBoardTitleChange(event.target.value)}
              placeholder={board ? "" : "Create a board to start"}
              disabled={!board}
              className="h-8 w-[340px] max-w-full border-border/70 bg-background/60 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-border/70">
              Updated {boardUpdatedAt}
            </Badge>
            {isSaving ? <Badge variant="secondary">Saving...</Badge> : null}
            <Button variant="outline" size="sm" onClick={handleExportMarkdown} disabled={!board}>
              <Download />
              Export MD
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} disabled={!board}>
              <Download />
              Export JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] flex-1 gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="case-panel rounded-lg p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Boards</p>
          <div className="mt-3 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCreateBoard}
              disabled={isSaving}
            >
              <Plus />
              New board
            </Button>
            {boards.map((item) => (
              <Button
                key={item.id}
                variant={item.id === board?.id ? "secondary" : "ghost"}
                className="w-full justify-start truncate"
                onClick={() => void loadBoard(item.id)}
                disabled={isLoadingBoard}
              >
                {item.title}
              </Button>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Session</p>
          <p className="mt-2 text-sm text-muted-foreground">{userEmail}</p>
          <div className="mt-4 space-y-2">
            <label className="text-xs text-muted-foreground">Board status</label>
            <Select
              value={board?.status ?? "Open"}
              onValueChange={(value) => void handleStatusChange(value as BoardStatus)}
              disabled={!board}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boardStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 space-y-2">
            <label className="text-xs text-muted-foreground">Verdict</label>
            <Select
              value={board?.verdict ?? "none"}
              onValueChange={(value) =>
                void handleVerdictChange(value as Verdict | "none")
              }
              disabled={!board}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No verdict yet</SelectItem>
                {verdicts.map((verdict) => (
                  <SelectItem key={verdict} value={verdict}>
                    {verdict}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </aside>

        <section className="case-panel flex min-h-0 flex-col rounded-lg p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={newCardType}
                onValueChange={(value) => setNewCardType(value as CardType)}
                disabled={!board}
              >
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardTypes.map((cardType) => (
                    <SelectItem key={cardType} value={cardType}>
                      {cardType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void handleAddCard()} disabled={!board}>
                <Plus />
                Add note
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={zoomOut} disabled={!board}>
                <Minus />
              </Button>
              <Button variant="outline" size="sm" onClick={zoomReset} disabled={!board}>
                {zoomPercent}%
              </Button>
              <Button variant="outline" size="sm" onClick={zoomIn} disabled={!board}>
                <Plus />
              </Button>
              {isLoadingBoard ? (
                <Badge variant="outline" className="border-border/70">
                  Loading board...
                </Badge>
              ) : null}
            </div>
          </div>
          <ScrollArea className="h-[calc(100svh-13rem)]">
            {board ? (
              <div className="h-full overflow-hidden">
                <CanvasRouter
                  cards={board.cards}
                  zoom={zoom}
                  selectedCardId={selectedCardId}
                  onCardsChange={updateBoardCards}
                  onCardSelect={setSelectedCardId}
                  onZoomChange={setZoom}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
                No board yet. Create one from the left panel.
              </div>
            )}
          </ScrollArea>
        </section>

        <aside className="case-panel flex min-h-0 flex-col rounded-lg p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI Actions</p>
          <div className="mt-3 space-y-2">
            <label className="text-xs text-muted-foreground">Role</label>
            <Select
              value={aiRole}
              onValueChange={(value) => setAiRole(value as AiRole)}
              disabled={!board || isAiThinking}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 grid gap-2">
            {(
              [
                "Organize",
                "Challenge",
                "Find contradictions",
                "Compress",
                "Suggest next test",
              ] as AiAction[]
            ).map((action) => (
              <Button
                key={action}
                variant="outline"
                className="justify-start border-border/70"
                onClick={() => void handleAiAction(action)}
                disabled={!board || isAiThinking}
              >
                <Sparkles />
                {action}
              </Button>
            ))}
          </div>
          {isAiThinking ? <p className="mt-3 text-xs text-muted-foreground">AI is thinking...</p> : null}
          {lastAiAction ? <p className="mt-3 text-xs text-muted-foreground">{lastAiAction}</p> : null}
          {errorText ? <p className="mt-3 text-xs text-destructive">{errorText}</p> : null}

          <Separator className="my-4" />
          <Card className="case-panel">
            <CardHeader>
              <CardTitle className="text-sm">Selected Note</CardTitle>
              <CardDescription>Click a note on the board to edit and save it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCard ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Type</label>
                    <Select
                      value={selectedCard.type}
                      onValueChange={(value) => void handleNoteTypeChange(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cardTypes.map((cardType) => (
                          <SelectItem key={cardType} value={cardType}>
                            {cardType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Title</label>
                    <Input
                      value={selectedCard.title}
                      onChange={(event) =>
                        updateCardLocal(selectedCard.id, { title: event.target.value })
                      }
                      onBlur={() => void handleNoteTitleBlur()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Content</label>
                    <Textarea
                      value={selectedCard.content}
                      onChange={(event) =>
                        updateCardLocal(selectedCard.id, { content: event.target.value })
                      }
                      onBlur={() => void handleNoteContentBlur()}
                      className="min-h-28"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
                    <Input
                      key={`${selectedCard.id}-tags`}
                      defaultValue={selectedCard.tags.join(", ")}
                      onBlur={(event) =>
                        void handleTagsBlur(
                          selectedCard.id,
                          event.target.value,
                          selectedCard.type,
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteSelectedCard()}
                    disabled={isDeletingCard}
                  >
                    <Trash2 />
                    {isDeletingCard ? "Deleting..." : "Delete note"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {board
                    ? "No note selected. Click a note to edit it."
                    : "Create a board first, then add and edit notes."}
                </p>
              )}
            </CardContent>
          </Card>

          <Separator className="my-4" />
          <Card className="case-panel">
            <CardHeader>
              <CardTitle className="text-sm">Board Summary</CardTitle>
              <CardDescription>Compress before expanding. Keep decisions bounded.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Current thesis</p>
                <p className="mt-1 text-sm">{board?.summary.thesis || "No thesis yet."}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Top risk</p>
                <p className="mt-1 text-sm">{board?.summary.topRisk || "No risk marked yet."}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Top open questions</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {board?.summary.topOpenQuestions && board.summary.topOpenQuestions.length > 0 ? (
                    board.summary.topOpenQuestions.map((question) => <li key={question}>- {question}</li>)
                  ) : (
                    <li>- No open questions yet.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Recommended next step</p>
                <p className="mt-1 text-sm">
                  {board?.summary.recommendedNextStep || "No next step suggested yet."}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Board status</p>
                <Badge variant="outline">{board?.summary.status ?? "Open"}</Badge>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
