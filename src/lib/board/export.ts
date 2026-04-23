import type { Board } from "@/lib/board/types";

export function boardToMarkdown(board: Board) {
  const cardLines = board.cards
    .map((card) => {
      const tagLine = card.tags.length ? ` [${card.tags.join(", ")}]` : "";
      const aiMark = card.aiOrigin ? " (AI)" : "";
      return `- **${card.type}**${aiMark}: ${card.title}${tagLine}\n  - ${card.content}\n  - Position: (${Math.round(card.position.x)}, ${Math.round(card.position.y)})`;
    })
    .join("\n");

  return `# ${board.title}

## Board
- Type: ${board.type}
- Status: ${board.status}
- Verdict: ${board.verdict ?? "None"}
- Updated: ${new Date(board.updatedAt).toLocaleString()}

## Summary
- Thesis: ${board.summary.thesis}
- Top risk: ${board.summary.topRisk}
- Top open questions: ${board.summary.topOpenQuestions.join(" | ") || "None"}
- Recommended next step: ${board.summary.recommendedNextStep}

## Cards
${cardLines}
`;
}
