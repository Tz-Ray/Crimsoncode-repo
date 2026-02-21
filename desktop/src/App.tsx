import React, { useEffect, useMemo, useState } from "react";
import { addMonths, subMonths } from "date-fns";
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

export default function App() {
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const monthDays = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const selectedDateKey = toDateKey(selectedDate);

  const tasksForSelectedDay = tasks
    .filter((t) => t.date === selectedDateKey)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

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
      <div style={{ padding: 16, borderRight: "1px solid #ddd" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setAnchorDate(subMonths(anchorDate, 1))}>◀</button>
          <button onClick={() => setAnchorDate(new Date())}>Today</button>
          <button onClick={() => setAnchorDate(addMonths(anchorDate, 1))}>▶</button>
          <h2 style={{ margin: "0 0 0 8px" }}>{format(anchorDate, "MMMM yyyy")}</h2>
        </div>

        {/* Placeholder view bar (for later) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={{ fontWeight: "bold" }}>Month</button>
          <button disabled>Week</button>
          <button style={{fontWeight: "bold"}}>Day</button>
          <button disabled>Year</button>
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
                onClick={() => setSelectedDate(day)}
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
                      <div key={t.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        • {t.title}
                      , {t.time}
                      </div>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{format(selectedDate, "EEEE, MMM d")}</h3>

        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title"
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
          />
          <button onClick={addTask}>Add Task</button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {tasksForSelectedDay.length === 0 && (
            <div style={{ color: "#666" }}>No tasks for this day.</div>
          )}

          {tasksForSelectedDay.map((task) => (
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

              <div>
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
  );
}