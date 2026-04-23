"use client";

import type { BoardCard } from "@/lib/board/types";
import { DndKitCanvas } from "@/components/board/dnd-kit-canvas";

interface CanvasRouterProps {
  cards: BoardCard[];
  zoom: number;
  selectedCardId: string | null;
  onCardsChange: (cards: BoardCard[]) => void;
  onCardSelect: (cardId: string) => void;
  onZoomChange: (zoom: number) => void;
}

export function CanvasRouter({
  cards,
  zoom,
  selectedCardId,
  onCardsChange,
  onCardSelect,
  onZoomChange,
}: CanvasRouterProps) {
  return (
    <DndKitCanvas
      cards={cards}
      zoom={zoom}
      selectedCardId={selectedCardId}
      onCardsChange={onCardsChange}
      onCardSelect={onCardSelect}
      onZoomChange={onZoomChange}
    />
  );
}
