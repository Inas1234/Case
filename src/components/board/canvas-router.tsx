"use client";

import type { BoardCard } from "@/lib/board/types";
import type { CanvasViewport } from "@/lib/board/canvas";
import { DndKitCanvas } from "@/components/board/dnd-kit-canvas";

interface CanvasRouterProps {
  cards: BoardCard[];
  zoom: number;
  selectedCardId: string | null;
  onCardsChange: (cards: BoardCard[]) => void;
  onCardSelect: (cardId: string) => void;
  onZoomChange: (zoom: number) => void;
  onViewportChange: (viewport: CanvasViewport) => void;
}

export function CanvasRouter({
  cards,
  zoom,
  selectedCardId,
  onCardsChange,
  onCardSelect,
  onZoomChange,
  onViewportChange,
}: CanvasRouterProps) {
  return (
    <DndKitCanvas
      cards={cards}
      zoom={zoom}
      selectedCardId={selectedCardId}
      onCardsChange={onCardsChange}
      onCardSelect={onCardSelect}
      onZoomChange={onZoomChange}
      onViewportChange={onViewportChange}
    />
  );
}
