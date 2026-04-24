import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BoardCard as BoardCardModel, CardType } from "@/lib/board/types";
import { cn } from "@/lib/utils";

const typeTone: Record<CardType, string> = {
  Thought: "border-blue-400/30 bg-blue-500/10 text-blue-100",
  Question: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  Evidence: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  Screenshot: "border-indigo-400/30 bg-indigo-500/10 text-indigo-100",
  Idea: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  User: "border-orange-400/30 bg-orange-500/10 text-orange-100",
  Problem: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
  Assumption: "border-violet-400/30 bg-violet-500/10 text-violet-100",
  Risk: "border-rose-500/30 bg-rose-600/10 text-rose-100",
  Contradiction: "border-red-500/40 bg-red-700/15 text-red-100",
  Experiment: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  Conclusion: "border-lime-400/30 bg-lime-500/10 text-lime-100",
};

interface BoardCardProps {
  card: BoardCardModel;
  isDragging?: boolean;
  isSelected?: boolean;
}

export function BoardCard({
  card,
  isDragging = false,
  isSelected = false,
}: BoardCardProps) {
  return (
    <Card
      className={cn(
        "w-[430px] min-h-[210px] gap-3 border border-border/70 bg-card/95 text-sm shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-shadow",
        isDragging && "shadow-[0_14px_44px_rgba(0,0,0,0.55)] ring-2 ring-ring/50",
        isSelected && "ring-2 ring-primary/60",
      )}
      size="sm"
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn("border px-2 py-0.5 text-[11px]", typeTone[card.type])}
          >
            {card.type}
          </Badge>
          {card.aiOrigin ? (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              AI
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-sm leading-snug">{card.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-base leading-7 text-muted-foreground">{card.content}</p>
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <Badge key={`${card.id}-${tag}`} variant="ghost" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
