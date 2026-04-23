"use client";

import {
  DndContext,
  useDraggable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DemoNote = {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
};

const initialNotes: DemoNote[] = [
  {
    id: "n1",
    title: "Core idea",
    content: "Founders need a board that pushes them to decisions, not more notes.",
    x: 70,
    y: 80,
  },
  {
    id: "n2",
    title: "Critical risk",
    content: "Without compression, the board becomes another place where ideas stall.",
    x: 420,
    y: 250,
  },
];

export function CaseDropDemo() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const sensors = useSensors(useSensor(PointerSensor));
  const [notes, setNotes] = useState<DemoNote[]>(initialNotes);

  const handleDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const { x, y } = event.delta;

    if (!x && !y) {
      return;
    }

    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? {
              ...note,
              x: Math.max(0, note.x + x),
              y: Math.max(0, note.y + y),
            }
          : note,
      ),
    );
  };

  if (!mounted) {
    return (
      <Card className="case-panel border-border/70">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Board Preview</CardTitle>
          <Badge variant="secondary">2 draggable notes</Badge>
        </CardHeader>
        <CardContent>
          <div className="relative h-[480px] rounded-lg border border-border/70 bg-background/40 case-grid">
            {initialNotes.map((note) => (
              <div
                key={note.id}
                style={{ left: note.x, top: note.y }}
                className="absolute w-[320px] rounded-md border border-border/70 bg-card/90 p-4 shadow-lg"
              >
                <p className="text-sm font-semibold">{note.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{note.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="case-panel border-border/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Board Preview</CardTitle>
        <Badge variant="secondary">Drag notes around</Badge>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="relative h-[480px] rounded-lg border border-border/70 bg-background/40 case-grid">
            {notes.map((note) => (
              <DraggableNote key={note.id} note={note} />
            ))}
          </div>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function DraggableNote({ note }: { note: DemoNote }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        left: note.x,
        top: note.y,
        transform: CSS.Translate.toString(transform),
      }}
      className={`absolute w-[320px] cursor-grab rounded-md border border-border/70 bg-card/90 p-4 shadow-lg active:cursor-grabbing ${isDragging ? "z-40 ring-2 ring-ring/50" : "z-20"}`}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-semibold">{note.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.content}</p>
    </article>
  );
}
