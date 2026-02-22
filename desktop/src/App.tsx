import React, { useEffect, useMemo, useState } from "react";
import { addMonths, subMonths, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import {
  buildMonthGrid,
  toDateKey,
  isCurrentMonth,
  format,
  isToday,
} from "./calendarUtils";
import type { Task } from "./types";

const STORAGE_KEY = "crimsoncode_tasks_v1";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const PRIORITY_COLORS: Record<1 | 2 | 3, string> = {
  1: "#ff4d4f", // Red
  2: "#faad14", // Yellow/Gold
  3: "#1890ff", // Blue
};

export default function App() {
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [taskViewMode, setTaskViewMode] = useState<"day" | "week" | "month">("day");
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newPriorityValue, setPriority] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const monthDays = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const selectedDateKey = toDateKey(selectedDate);

  // handle switching between day, month, year
  const filteredTasks = useMemo(() => {

    if (taskViewMode === "day"){
      return tasks.filter((t) => t.date === selectedDateKey);
    }

    if (taskViewMode === "week") {
        const start = startOfWeek(selectedDate);
        const end = endOfWeek(selectedDate);
        return tasks.filter((t) => {
          const taskDate = new Date(t.date + "T00:00:00");
          return isWithinInterval(taskDate, { start, end });
        });
      }

    if (taskViewMode === "month") {
      return tasks.filter((t) => {
        const taskDate = new Date(t.date + "T00:00:00");
        return (
          taskDate.getMonth() === anchorDate.getMonth() &&
          taskDate.getFullYear() === anchorDate.getFullYear()
        );
      });
    }
    return [];
  }, [tasks, taskViewMode, selectedDate, selectedDateKey, anchorDate]);

  // sorts tasks based on data so they show up in order
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  }, [filteredTasks]);

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description: newTaskDesc,
      date: selectedDateKey,
      time: newTaskTime || undefined,
      completed: false,
      priority: newPriorityValue
    };

    setTasks((prev) => [...prev, task]);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskTime("");
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function taskCountForDate(day: Date) {
    const key = toDateKey(day);
    return tasks.filter((t) => t.date === key).length;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Calendar side */}
      <div style={{ padding: 16, borderRight: "1px solid #ddd", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setAnchorDate(subMonths(anchorDate, 1))}>◀</button>
          <button onClick={() => setAnchorDate(new Date())}>Today</button>
          <button onClick={() => setAnchorDate(addMonths(anchorDate, 1))}>▶</button>
          <h2 style={{ margin: "0 0 0 8px" }}>{format(anchorDate, "MMMM yyyy")}</h2>
        </div>

        {/* Weekday labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} style={{ fontSize: 12, fontWeight: 600, textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>
        
        {/* Month grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {monthDays.map((day) => {
            const isSelected = toDateKey(day) === selectedDateKey;
            const count = taskCountForDate(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  setTaskViewMode("day");
                }}
                style={{
                  minHeight: 72,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 6,
                  textAlign: "left",
                  background: isSelected ? "#eef5ff" : "white",
                  opacity: isCurrentMonth(day, anchorDate) ? 1 : 0.45,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontWeight: isToday(day) ? 700 : 400,
                      textDecoration: isToday(day) ? "underline" : "none",
                    }}
                  >
                    {format(day, "d")}
                  </span>
                  {count > 0 && (
                    <span style={{ fontSize: 11, border: "1px solid #aaa", borderRadius: 999, padding: "0 6px" }}>
                      {count}
                    </span>
                  )}
                </div>
                
                {/* Tiny preview (up to 2 task titles) */}
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  {tasks
                    .filter((t) => t.date === toDateKey(day))
                    .slice(0, 2)
                    .map((t) => (
                      <div key={t.id} style={{ whiteSpace: "nowrap",
                       overflow: "hidden", 
                       textOverflow: "ellipsis", 
                       color: t.completed 
                        ? "#2e7d32" 
                        : PRIORITY_COLORS[t.priority as 1 | 2 | 3],
                       textDecoration: t.completed ? "line-through" : "none",
                       opacity: t.completed ? 0.7 : 1 }}>
                        • {t.title}
                      , {t.time}  -  P{t.priority}
                      </div>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task View */}
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* buttons for task view day, moth, year */}
        <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
          <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 4, marginBottom: 16 }}>
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTaskViewMode(mode)}
                style={{
                  flex: 1,
                  border: "none",
                  padding: "8px 0",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: taskViewMode === mode ? "white" : "transparent",
                  fontWeight: taskViewMode === mode ? 600 : 400
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          
          <h3 style={{ marginTop: 0 }}>
            {taskViewMode === "day" && format(selectedDate, "EEEE, MMM d")}
            {taskViewMode === "week" && "This Week"}
            {taskViewMode === "month" && format(anchorDate, "MMMM yyyy")}
          </h3>
        </div>
        
        {/* add task apears when on day */}
        <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
          {taskViewMode === "day" && (
            <div style={{ display: "grid", gap: 8, marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #eee" }}>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <textarea
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Add description ..."
                rows={3}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              /> 
              <input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <select
                value = {newPriorityValue}
                onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="1">Priority 1 (High)</option>
                <option value="2">Priority 2 (Medium)</option>
                <option value="3">Priority 3 (Low)</option>
              </select>

              <button 
                onClick={addTask}
                style={{ padding: '8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Add Task
              </button>
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {sortedTasks.length === 0 && (
              <div style={{ color: "#666" }}>No tasks for this {taskViewMode}.</div>
            )}

            {sortedTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 10,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "start", 
                  marginBottom: 8,
                  background: task.completed ? "#f9f9f9" : "white"
                }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  style={{ marginTop: 4 }}
                />

                {/* show dates when not in day view */}
                <div>
                  {taskViewMode !== "day" && (
                    <div style={{ fontSize: 10, color: "#007bff", fontWeight: 700, marginBottom: 4 }}>
                      {format(new Date(task.date + "T00:00:00"), "MMM d")}
                    </div>
                  )}

                  <div style={{ 
                    fontWeight: 600, 
                    textDecoration: task.completed ? "line-through" : "none",
                    color: task.completed ? "#888" : "#000"
                  }}>
                    {task.title}
                  </div>

                  {task.description && (
                    <div style={{
                      fontSize: 13,
                      color: task.completed ? "#aaa" : "#555",
                      marginTop: 4,
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.4"
                    }}>
                      {task.description}
                    </div>
                  )}

                  {task.time && (
                    <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                      {task.time}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => deleteTask(task.id)}
                  style={{
                    padding: "4px 8px",
                    cursor: "pointer",
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#d9534f"
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}