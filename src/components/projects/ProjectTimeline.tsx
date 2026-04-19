import { useMemo, useState } from "react";
import { DndContext, useDraggable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask, type Task } from "@/services/tasks";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Zoom = "day" | "week" | "month";

const ZOOM_PX: Record<Zoom, number> = { day: 56, week: 22, month: 8 };

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
const fmtISO = (d: Date) => d.toISOString().slice(0, 10);

const PRIORITY_COLOR: Record<string, string> = {
  low: "from-muted-foreground/40 to-muted-foreground/60",
  medium: "from-secondary/70 to-primary/70",
  high: "from-destructive/80 to-warning/80",
};

interface BarProps {
  task: Task;
  pxPerDay: number;
  rangeStart: Date;
  canDrag: boolean;
}

function TaskBar({ task, pxPerDay, rangeStart, canDrag }: BarProps) {
  const due = task.due_date ? new Date(task.due_date) : null;
  const start = task.created_at ? new Date(task.created_at) : null;

  const startDay = start ? Math.max(0, daysBetween(rangeStart, start)) : 0;
  const endDay = due ? daysBetween(rangeStart, due) : startDay + 1;
  const left = startDay * pxPerDay;
  const width = Math.max(pxPerDay, (endDay - startDay + 1) * pxPerDay);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canDrag || !due,
  });

  const style: React.CSSProperties = {
    left,
    width,
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  const gradient = PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.medium;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`absolute h-8 rounded-md bg-gradient-to-r ${gradient} px-2 flex items-center gap-2 shadow-md ${
        canDrag && due ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      } ${task.status === "done" ? "opacity-60" : ""} hover:ring-2 hover:ring-primary/60 transition-shadow`}
      title={`${task.title}${due ? ` · due ${fmtISO(due)}` : ""}`}
    >
      <span className="text-xs font-medium text-foreground/95 truncate">
        <Link to={`/tasks/${task.id}`} onPointerDown={(e) => e.stopPropagation()} className="hover:underline">
          {task.title}
        </Link>
      </span>
    </div>
  );
}

export function ProjectTimeline({
  projectId, tasks, canDrag,
}: { projectId: string; tasks: Task[]; canDrag: boolean }) {
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<Zoom>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const pxPerDay = ZOOM_PX[zoom];
  const totalDays = zoom === "day" ? 21 : zoom === "week" ? 90 : 240;
  const rangeStart = useMemo(() => addDays(anchor, -Math.floor(totalDays / 4)), [anchor, totalDays]);
  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, totalDays],
  );
  const todayOffset = daysBetween(rangeStart, new Date()) * pxPerDay;

  const updateMut = useMutation({
    mutationFn: ({ id, due_date }: { id: string; due_date: string }) => updateTask(id, { due_date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      toast.success("Due date updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, delta } = e;
    const dx = delta.x;
    if (!dx) return;
    const dayShift = Math.round(dx / pxPerDay);
    if (!dayShift) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task?.due_date) return;
    const newDue = addDays(new Date(task.due_date), dayShift);
    updateMut.mutate({ id: task.id, due_date: fmtISO(newDue) });
  };

  const rowHeight = 44;
  const visible = tasks;

  return (
    <div className="card-glass p-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setAnchor(addDays(anchor, -totalDays / 3))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setAnchor(addDays(anchor, totalDays / 3))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">No tasks to display on the timeline.</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto scrollbar-thin">
            <div style={{ width: totalDays * pxPerDay, minWidth: "100%" }} className="relative">
              {/* Date header */}
              <div className="flex border-b border-border sticky top-0 bg-card/70 backdrop-blur-md z-10">
                {days.map((d, i) => {
                  const isMonthStart = d.getDate() === 1;
                  const isWeekStart = d.getDay() === 1;
                  const showLabel =
                    zoom === "day" ? true :
                    zoom === "week" ? isWeekStart :
                    isMonthStart;
                  return (
                    <div
                      key={i}
                      style={{ width: pxPerDay }}
                      className={`shrink-0 text-[10px] py-2 text-center border-r border-border/30 ${
                        d.toDateString() === new Date().toDateString() ? "text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {showLabel && (
                        zoom === "month"
                          ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
                          : zoom === "week"
                          ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : d.getDate()
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset <= totalDays * pxPerDay && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none z-20"
                  style={{ left: todayOffset, boxShadow: "0 0 12px hsl(var(--primary) / 0.6)" }}
                />
              )}

              {/* Rows */}
              <div className="relative">
                {visible.map((t, idx) => (
                  <div
                    key={t.id}
                    className="relative border-b border-border/20"
                    style={{ height: rowHeight }}
                  >
                    {idx % 2 === 0 && <div className="absolute inset-0 bg-muted/10 pointer-events-none" />}
                    <div className="absolute top-1.5">
                      <TaskBar task={t} pxPerDay={pxPerDay} rangeStart={rangeStart} canDrag={canDrag} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DndContext>
      )}

      {canDrag && tasks.some((t) => t.due_date) && (
        <p className="text-xs text-muted-foreground mt-3">
          Drag a task bar horizontally to change its due date.
        </p>
      )}
    </div>
  );
}
