import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  boardStatuses,
  cardTags,
  cardTypes,
  verdicts,
  type Board,
  type BoardListItem,
  type BoardCard,
  type BoardStatus,
  type CardTag,
  type CardType,
  type Verdict,
} from "@/lib/board/types";

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

type DbBoardRow = {
  id: string;
  title: string | null;
  board_type: string | null;
  status: string | null;
  verdict: string | null;
  thesis: string | null;
  top_risk: string | null;
  top_open_questions: unknown;
  recommended_next_step: string | null;
  updated_at: string | null;
};

type DbBoardListRow = {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string | null;
};

function asCardType(value: unknown): CardType {
  return cardTypes.includes(value as CardType) ? (value as CardType) : "Thought";
}

function asBoardStatus(value: unknown): BoardStatus {
  return boardStatuses.includes(value as BoardStatus)
    ? (value as BoardStatus)
    : "Open";
}

function asVerdict(value: unknown): Verdict | null {
  if (value === null || value === undefined) {
    return null;
  }
  return verdicts.includes(value as Verdict) ? (value as Verdict) : null;
}

function asCardTags(value: unknown): CardTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((tag): tag is CardTag =>
    cardTags.includes(tag as CardTag),
  );
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

function mapBoardRow(row: DbBoardRow, cards: BoardCard[]): Board {
  const topOpenQuestions = Array.isArray(row.top_open_questions)
    ? row.top_open_questions.map((item: unknown) => String(item))
    : [];

  const status = asBoardStatus(row.status);

  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled Case"),
    type:
      row.board_type === "Startup" || row.board_type === "Product"
        ? row.board_type
        : "Blank",
    status,
    verdict: asVerdict(row.verdict),
    cards,
    summary: {
      thesis: String(row.thesis ?? ""),
      topRisk: String(row.top_risk ?? ""),
      topOpenQuestions,
      recommendedNextStep: String(row.recommended_next_step ?? ""),
      status,
    },
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function fetchBoardById(boardId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    throw new Error(boardError?.message ?? "Board not found.");
  }

  const { data: cards } = await supabase
    .from("board_cards")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  return mapBoardRow(
    board as DbBoardRow,
    ((cards ?? []) as DbCardRow[]).map(mapCardRow),
  );
}

export async function getBoardWorkspaceData(userId: string): Promise<{
  activeBoard: Board | null;
  boards: BoardListItem[];
}> {
  const supabase = await createSupabaseServerClient();

  const { data: boardRows } = await supabase
    .from("boards")
    .select("id,title,status,updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (!boardRows || boardRows.length === 0) {
    return {
      activeBoard: null,
      boards: [],
    };
  }

  const boards = (boardRows as DbBoardListRow[]).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Untitled Case"),
    status: asBoardStatus(row.status),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }));

  const activeBoard = await fetchBoardById(boards[0].id);
  return { activeBoard, boards };
}
