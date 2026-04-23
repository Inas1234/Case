"use client";

import { Download, LogOut, Minus, Plus, Sparkles } from "lucide-react";
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

const typeToTag: Record<CardType, CardTag> = {
  Thought: "idea",
  Question: "question",
  Evidence: "evidence",
  Screenshot: "evidence",
  Assumption: "assumption",
  Risk: "risk",
  Contradiction: "problem",
  Experiment: "experiment",
  Conclusion: "conclusion",
};

const aiActionToCardType: Record<AiAction, CardType> = {
  Organize: "Conclusion",
  Challenge: "Question",
  "Find contradictions": "Contradiction",
  Compress: "Conclusion",
  "Suggest next test": "Experiment",
};

const aiActionToCopy: Record<AiAction, string> = {
  Organize:
    "Cluster existing cards around one thesis and mark duplicates as lower priority.",
  Challenge:
    "Test the strongest assumption first: why would users switch from current behavior?",
  "Find contradictions":
    "One card claims speed is the edge while another says reliability matters most.",
  Compress:
    "Keep the user acquisition problem in focus and defer tooling details for later.",
  "Suggest next test":
    "Run 5 targeted interviews with one narrow persona and validate willingness to pay.",
};

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
    if (!board) {
      return;
    }

    const boardId = board.id;
    const aiCardType = aiActionToCardType[action];
    const { data, error } = await supabase
      .from("board_cards")
      .insert({
        board_id: boardId,
        created_by: userId,
        type: aiCardType,
        title: `${action} (${aiRole})`,
        content: aiActionToCopy[action],
        tags: [typeToTag[aiCardType]],
        position_x: 640,
        position_y: 180 + board.cards.length * 14,
        ai_origin: true,
      })
      .select("*")
      .single();

    if (error || !data) {
      setErrorText(error?.message ?? "Could not add AI note.");
      return;
    }

    const nextCard = mapCardRow(data as DbCardRow);
    setLastAiAction(`${action} completed with role ${aiRole}.`);
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }

      const nextStatus = action === "Compress" ? "Narrowing" : prev.status;
      return {
        ...prev,
        cards: [...prev.cards, nextCard],
        status: nextStatus,
        summary: {
          ...prev.summary,
          recommendedNextStep:
            action === "Suggest next test"
              ? "Run the proposed narrow test this week and report objective outcomes."
              : prev.summary.recommendedNextStep,
          status: nextStatus,
        },
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedCardId(nextCard.id);
    setBoards((prev) =>
      updateBoardListEntry(prev, boardId, {
        status: action === "Compress" ? "Narrowing" : board.status,
      }),
    );

    if (action === "Compress") {
      await persistBoardPatch(boardId, { status: "Narrowing" });
    }
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
            <Select value={aiRole} onValueChange={(value) => setAiRole(value as AiRole)} disabled={!board}>
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
                disabled={!board}
              >
                <Sparkles />
                {action}
              </Button>
            ))}
          </div>
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
