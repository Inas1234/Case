export const boardTypes = ["Startup", "Product", "Blank"] as const;
export type BoardType = (typeof boardTypes)[number];

export const boardStatuses = [
  "Open",
  "Under Investigation",
  "Narrowing",
  "Ready for Verdict",
  "Solved",
  "Archived",
] as const;
export type BoardStatus = (typeof boardStatuses)[number];

export const verdicts = [
  "Proceed",
  "Test first",
  "Pivot",
  "Pause",
  "Kill",
] as const;
export type Verdict = (typeof verdicts)[number];

export const cardTypes = [
  "Thought",
  "Question",
  "Evidence",
  "Screenshot",
  "Assumption",
  "Risk",
  "Contradiction",
  "Experiment",
  "Conclusion",
] as const;
export type CardType = (typeof cardTypes)[number];

export const cardTags = [
  "idea",
  "problem",
  "user",
  "evidence",
  "assumption",
  "risk",
  "question",
  "experiment",
  "conclusion",
] as const;
export type CardTag = (typeof cardTags)[number];

export interface BoardCard {
  id: string;
  type: CardType;
  title: string;
  content: string;
  tags: CardTag[];
  position: {
    x: number;
    y: number;
  };
  aiOrigin: boolean;
}

export interface BoardSummary {
  thesis: string;
  topRisk: string;
  topOpenQuestions: string[];
  recommendedNextStep: string;
  status: BoardStatus;
}

export interface Board {
  id: string;
  title: string;
  type: BoardType;
  status: BoardStatus;
  verdict: Verdict | null;
  cards: BoardCard[];
  summary: BoardSummary;
  updatedAt: string;
}

export interface BoardListItem {
  id: string;
  title: string;
  status: BoardStatus;
  updatedAt: string;
}
