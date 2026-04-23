"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { BoardCard } from "@/components/board/board-card";
import type { BoardCard as BoardCardModel } from "@/lib/board/types";

interface DndKitCanvasProps {
  cards: BoardCardModel[];
  zoom: number;
  selectedCardId: string | null;
  onCardsChange: (cards: BoardCardModel[]) => void;
  onCardSelect: (cardId: string) => void;
  onZoomChange: (zoom: number) => void;
}

type Offset = { x: number; y: number };

function clampZoom(value: number) {
  return Math.max(0.6, Math.min(1.8, Number(value.toFixed(2))));
}

function isZeroOffset(offset: Offset | undefined) {
  return !offset || (!offset.x && !offset.y);
}

export function DndKitCanvas({
  cards,
  zoom,
  selectedCardId,
  onCardsChange,
  onCardSelect,
  onZoomChange,
}: DndKitCanvasProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 340, y: 220 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const panStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const cardsById = useMemo(
    () =>
      cards.reduce<Record<string, BoardCardModel>>((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {}),
    [cards],
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    const wheelHandler = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();

      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const currentZoom = zoomRef.current;
      const nextZoom = clampZoom(
        currentZoom + (event.deltaY > 0 ? -0.08 : 0.08),
      );

      if (nextZoom === currentZoom) {
        return;
      }

      setPan((prev) => {
        const worldX = (pointerX - prev.x) / currentZoom;
        const worldY = (pointerY - prev.y) / currentZoom;
        return {
          x: pointerX - worldX * nextZoom,
          y: pointerY - worldY * nextZoom,
        };
      });
      onZoomChange(nextZoom);
    };

    node.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      node.removeEventListener("wheel", wheelHandler);
    };
  }, [onZoomChange]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveId(id);
    onCardSelect(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const offset = {
      x: event.delta.x / zoom,
      y: event.delta.y / zoom,
    };
    const card = cardsById[id];

    if (!card) {
      setActiveId(null);
      return;
    }

    if (isZeroOffset(offset)) {
      setActiveId(null);
      return;
    }

    const finalPosition = {
      x: card.position.x + offset.x,
      y: card.position.y + offset.y,
    };

    const nextCards = cards.map((card) =>
      card.id === id
        ? {
            ...card,
            position: {
              x: finalPosition.x,
              y: finalPosition.y,
            },
          }
        : card,
    );

    onCardsChange(nextCards);
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-note-draggable='true']")) {
      return;
    }

    panStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStart.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    setPan({ x: start.panX + dx, y: start.panY + dy });
  };

  const endPanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panStart.current?.pointerId === event.pointerId) {
      panStart.current = null;
      setIsPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPanning}
      onPointerCancel={endPanning}
      className={`relative h-full w-full touch-none overflow-hidden rounded-lg border border-border/60 select-none ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 case-grid opacity-70"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {mounted ? (
        <DndContext
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            }}
          >
            {cards.map((card) => (
              <DraggableBoardCard
                key={card.id}
                card={card}
                zoom={zoom}
                isDragging={activeId === card.id}
                isSelected={selectedCardId === card.id}
                onCardSelect={onCardSelect}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          }}
        >
          {cards.map((card) => {
            const current = cardsById[card.id] ?? card;
            return (
              <StaticBoardCard
                key={card.id}
                card={current}
                isSelected={selectedCardId === card.id}
                onCardSelect={onCardSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraggableBoardCard({
  card,
  zoom,
  isDragging,
  isSelected,
  onCardSelect,
}: {
  card: BoardCardModel;
  zoom: number;
  isDragging: boolean;
  isSelected: boolean;
  onCardSelect: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        left: card.position.x,
        top: card.position.y,
        position: "absolute",
        transform: transform
          ? `translate3d(${transform.x / zoom}px, ${transform.y / zoom}px, 0)`
          : undefined,
        touchAction: "none",
        zIndex: isDragging ? 60 : 20,
      }}
      {...listeners}
      {...attributes}
      data-note-draggable="true"
      className="cursor-grab active:cursor-grabbing"
      onClick={() => onCardSelect(card.id)}
      onPointerDownCapture={() => onCardSelect(card.id)}
    >
      <BoardCard card={card} isDragging={isDragging} isSelected={isSelected} />
    </div>
  );
}

function StaticBoardCard({
  card,
  isSelected,
  onCardSelect,
}: {
  card: BoardCardModel;
  isSelected: boolean;
  onCardSelect: (cardId: string) => void;
}) {
  return (
    <div
      style={{
        left: card.position.x,
        top: card.position.y,
        position: "absolute",
        touchAction: "none",
        zIndex: 20,
      }}
      data-note-draggable="true"
      className="cursor-grab"
      onClick={() => onCardSelect(card.id)}
      onPointerDownCapture={() => onCardSelect(card.id)}
    >
      <BoardCard card={card} isSelected={isSelected} />
    </div>
  );
}
