"use client";

import { Card, cn } from "@/shared/components/ui";
import { useToggleTask } from "@/features/docket/hooks/useCaseOverview";

interface Task {
  id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
}

interface MyTasksCardProps {
  matterId: string;
  tasks: Task[];
}

export default function MyTasksCard({ matterId, tasks }: MyTasksCardProps) {
  const toggleTask = useToggleTask(matterId);

  const visibleTasks = tasks.slice(0, 5);

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && !isToday(dueDate);
  };

  const isToday = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    );
  };

  const formatDueDate = (dueDate: string) => {
    return new Date(dueDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const handleToggle = (taskId: string, currentState: boolean) => {
    toggleTask.mutate({
      taskId,
      is_completed: !currentState,
    });
  };

  return (
    <Card className="rounded-xl border border-brand-gold/12 bg-base-100 shadow-sm p-4">
      <h3 className="text-sm font-serif font-semibold text-foreground mb-3">
        My tasks
      </h3>

      {visibleTasks.length === 0 ? (
        <p className="text-[11px] font-sans text-muted-foreground">
          No tasks assigned.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={task.is_completed}
                onChange={() => handleToggle(task.id, task.is_completed)}
                className="h-3.5 w-3.5 rounded border-brand-gold/30 text-brand-gold focus:ring-brand-gold/20 shrink-0"
                aria-label={`Toggle task: ${task.title}`}
              />
              <span
                className={cn(
                  "flex-1 text-[11px] font-sans",
                  task.is_completed
                    ? "line-through text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {task.title}
              </span>
              <span
                className={cn(
                  "text-[10px] font-sans shrink-0",
                  task.is_completed
                    ? "text-muted-foreground"
                    : isOverdue(task.due_date)
                      ? "text-amber-600 font-medium"
                      : "text-muted-foreground"
                )}
              >
                {formatDueDate(task.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
