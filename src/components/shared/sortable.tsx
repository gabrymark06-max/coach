"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import * as React from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Riordino con trascinamento, **senza togliere niente a chi non trascina**.
 *
 * WCAG 2.5.7 chiede che ogni gesto complesso abbia un'alternativa: qui le voci di menu
 * `Sposta su` / `Sposta giù` restano dove sono e continuano a funzionare. Il
 * trascinamento e' in piu', ed e' comunque **azionabile da tastiera** — la maniglia e' un
 * pulsante vero, `Spazio` solleva, le frecce spostano, `Spazio` rilascia, `Esc` annulla
 * (`KeyboardSensor` di dnd kit).
 *
 * `PointerSensor` parte dopo 8px di movimento: senza quella soglia, in sessione, un
 * tocco sul campo dei chili diventerebbe un trascinamento e lo scroll morirebbe.
 *
 * `prefers-reduced-motion`: la transizione di riassestamento sparisce; il trascinamento
 * resta, perche' segue il dito ed e' diretto, non un'animazione automatica (§8.6).
 */

export function SortableList({
  ids,
  onReorder,
  announceMove,
  children,
}: {
  ids: readonly string[];
  onReorder: (from: number, to: number) => void;
  /** frase per la regione `aria-live` a riordino avvenuto */
  announceMove?: (id: string, from: number, to: number, total: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      onReorder(from, to);
      announceMove?.(String(active.id), from, to, ids.length);
    },
    [announceMove, ids, onReorder],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Solo l'asse verticale. `restrictToParentElement` **no**: il genitore di ogni
      // elemento trascinabile e' il suo `<li>`, non la lista, e limitare il movimento a
      // quello vuol dire non poterlo muovere affatto — da tastiera non succedeva niente.
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Hai sollevato l'elemento ${active.id}.`,
          onDragOver: () => "",
          onDragEnd: () => "Elemento rilasciato.",
          onDragCancel: () => "Spostamento annullato.",
        },
        screenReaderInstructions: {
          draggable:
            "Premi Spazio per sollevare, le frecce su e giù per spostare, Spazio per rilasciare, Esc per annullare.",
        },
      }}
    >
      <SortableContext items={ids as string[]} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem({
  id,
  label,
  children,
  className,
}: {
  id: string;
  /** nome dell'elemento, per il nome accessibile della maniglia */
  label: string;
  /** riceve la maniglia da piazzare dove il componente vuole */
  children: (handle: React.ReactNode) => React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Riordina ${label}`}
      className="inline-flex size-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)] active:cursor-grabbing"
    >
      <GripVertical aria-hidden="true" className="size-6" strokeWidth={1.75} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reduced ? undefined : transition,
      }}
      className={cn(isDragging && "relative z-[var(--z-sticky)] opacity-90", className)}
    >
      {children(handle)}
    </div>
  );
}
