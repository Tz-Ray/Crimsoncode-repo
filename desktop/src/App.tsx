
//most of the major code is done here for making this project work. built with react
import React, { useEffect, useMemo, useState } from "react";
import {
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    isWithinInterval,
    startOfMonth,
    endOfMonth,
} from "date-fns";
import {
    buildMonthGrid,
    toDateKey,
    isCurrentMonth,
    format,
    isToday,
} from "./calendarUtils";
import type { Task } from "./types";
import { runAiAction } from "./aiClient";

const TASKS_STORAGE_KEY = "crimsoncode_tasks_v1";
const AI_CACHE_STORAGE_KEY = "crimsoncode_ai_cache_v1";

// Generic safe JSON loader
function loadJsonFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch (error: unknown) {
        console.error(`[storage] Failed to read key "${key}"`, error);
        return fallback;
    }
}

// Generic safe JSON saver
function saveJsonToStorage(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error: unknown) {
        console.error(`[storage] Failed to write key "${key}"`, error);
    }
}

// load tasks from local storage (validated as array)
function loadTasks(): Task[] {
    const parsed = loadJsonFromStorage<unknown>(TASKS_STORAGE_KEY, []);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
}

const PRIORITY_COLORS: Record<1 | 2 | 3, string> = {
    1: "#ff4d4f", // Red
    2: "#faad14", // Yellow/Gold
    3: "#1890ff", // Blue
};

type AiSummaryResult = {
    headline: string;
    summary: string;
    suggestedWorkflow?: string[];
    stats?: {
        total: number;
        completed: number;
        pending: number;
        withTime: number;
    };
    upcoming?: Array<{
        title: string;
        date: string;
        time?: string;
    }>;
    suggestions?: string[];
    warnings?: string[];
};

type AiSummaryMeta = {
    provider: string;
    model: string;
    generatedAt: string;
    cached?: boolean;
    fallback?: boolean;
};

type AiCacheEntry = { summary: AiSummaryResult; meta: AiSummaryMeta | null };
type AiCache = Record<string, AiCacheEntry>;

function loadAiCache(): AiCache {
    const parsed = loadJsonFromStorage<unknown>(AI_CACHE_STORAGE_KEY, {});
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
    }
    return parsed as AiCache;
}

export default function App() {
    // calender control
    const [anchorDate, setAnchorDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // tasks states
    const [taskViewMode, setTaskViewMode] = useState<"day" | "week" | "month">("day");
    const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

    const [aiCache, setAiCache] = useState<AiCache>(() => loadAiCache());

    // task properties
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskTime, setNewTaskTime] = useState("");
    const [newPriorityValue, setPriority] = useState<1 | 2 | 3>(1);

    // ai properties

    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string>("");

    // notifications
    const [dueSoonTasks, setDueSoonTasks] = useState<Task[]>([]);

    // when task list changes, change in local storage
    // Persist tasks whenever they change
    useEffect(() => {
        console.log("[storage] saving tasks:", tasks.length);
        saveJsonToStorage(TASKS_STORAGE_KEY, tasks);
    }, [tasks]);

    // Persist AI cache whenever it changes
    useEffect(() => {
        console.log("[storage] saving aiCache entries:", Object.keys(aiCache).length);
        saveJsonToStorage(AI_CACHE_STORAGE_KEY, aiCache);
    }, [aiCache]);

    // One-time mount check (helps confirm what's loaded on startup)
    useEffect(() => {
        console.log("[storage] loaded tasks on startup:", tasks.length);
        console.log("[storage] loaded aiCache keys on startup:", Object.keys(aiCache).length);
    }, []);

    // --- Notification Logic Start ---
    useEffect(() => {
        const checkUpcomingTasks = () => {
            const now = new Date();
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

            const found = tasks
                .filter((t) => {
                    if (!t.time || t.completed) return false;
                    const taskDateTime = new Date(`${t.date}T${t.time}:00`);
                    return taskDateTime > now && taskDateTime <= oneHourFromNow;
                })
                // Sort so the earliest time (closest) comes first
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

            setDueSoonTasks(found);
        };

        // Check immediately, then every 60 seconds
        checkUpcomingTasks();
        const interval = setInterval(checkUpcomingTasks, 60000);
        return () => clearInterval(interval);
    }, [tasks]);
    // --- Notification Logic End ---

    // generate days in month for grid
    const monthDays = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);

    // set date
    const selectedDateKey = toDateKey(selectedDate);

    // Filter tasks by selected view mode
    const filteredTasks = useMemo(() => {
        // display day tasks
        if (taskViewMode === "day") {
            return tasks.filter((t) => t.date === selectedDateKey);
        }
        // display week tasks
        if (taskViewMode === "week") {
            const start = startOfWeek(selectedDate);
            const end = endOfWeek(selectedDate);
            return tasks.filter((t) => {
                const taskDate = new Date(t.date + "T00:00:00");
                return isWithinInterval(taskDate, { start, end });
            });
        }
        // display month tasks
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

    // Sort tasks by date/time in order
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
            description: newTaskDesc || undefined,
            date: selectedDateKey,
            time: newTaskTime || undefined,
            completed: false,
            priority: newPriorityValue,
        };

        setTasks((prev) => [...prev, task]);
        // reset
        setNewTaskTitle("");
        setNewTaskDesc("");
        setNewTaskTime("");
        setPriority(1);
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

    // handels the funtionality for jumping to the current day
    function jumpToToday() {
        // get date
        const now = new Date();
        // set to date
        setAnchorDate(now);
        setSelectedDate(now);
        setTaskViewMode("day");
    }

    function getAiRangeInfo() {
        if (taskViewMode === "day") {
            const d = toDateKey(selectedDate);
            return {
                rangeLabel: format(selectedDate, "EEEE, MMM d"),
                rangeStart: d,
                rangeEnd: d,
                buttonLabel: "Summarize this day",
            };
        }

        if (taskViewMode === "week") {
            const ws = startOfWeek(selectedDate);
            const we = endOfWeek(selectedDate);
            return {
                rangeLabel: `Week of ${format(ws, "MMM d")}`,
                rangeStart: toDateKey(ws),
                rangeEnd: toDateKey(we),
                buttonLabel: "Summarize this week",
            };
        }

        const ms = startOfMonth(anchorDate);
        const me = endOfMonth(anchorDate);
        return {
            rangeLabel: format(anchorDate, "MMMM yyyy"),
            rangeStart: toDateKey(ms),
            rangeEnd: toDateKey(me),
            buttonLabel: "Summarize this month",
        };
    }

    const aiRangeInfo = useMemo(() => getAiRangeInfo(), [taskViewMode, selectedDate, anchorDate]);

    const activeAiKey = useMemo(() => {
        return `${taskViewMode}:${aiRangeInfo.rangeStart}:${aiRangeInfo.rangeEnd}`;
    }, [taskViewMode, aiRangeInfo.rangeStart, aiRangeInfo.rangeEnd]);

    const activeAiEntry = aiCache[activeAiKey];
    const aiSummary = activeAiEntry?.summary ?? null;
    const aiMeta = activeAiEntry?.meta ?? null;

    // When you switch day/week/month (or the range changes), clear transient UI errors/loading.
    // (Does NOT delete cached summaries.)
    useEffect(() => {
        setAiError("");
        setAiLoading(false);
    }, [activeAiKey]);


    async function summarizeCurrentView() {
        try {
            setAiLoading(true);
            setAiError("");

            const { rangeLabel, rangeStart, rangeEnd } = aiRangeInfo;

            const tasksToSummarize = sortedTasks;

            if (tasksToSummarize.length === 0) {
                setAiError(`No tasks in this ${taskViewMode} to summarize.`);
                return;
            }

            const response = await runAiAction({
                version: "1",
                action: "summarizeTasks",
                payload: {
                    rangeLabel,
                    tasks: tasksToSummarize.map((t) => ({
                        id: t.id,
                        title: t.title,
                        date: t.date,
                        time: t.time,
                        completed: t.completed,

                        // Send both current and compatibility fields
                        description: t.description,
                        priority: t.priority,
                        notes: t.description,
                        tags: t.priority ? [`priority-${t.priority}`] : undefined,
                    })),
                },
                context: {
                    view: taskViewMode,
                    rangeStart,
                    rangeEnd,
                },
            });

            if (!response.ok) {
                setAiError(response.error?.message || "AI request failed");
                return;
            }

            // ✅ Save the result for THIS view+range only
            setAiCache((prev) => ({
                ...prev,
                [activeAiKey]: {
                    summary: (response.result as AiSummaryResult) || null,
                    meta: (response.meta as AiSummaryMeta) || null,
                },
            }));
        } catch (error: unknown) {
            setAiError(error instanceof Error ? error.message : "Unknown error");
        } finally {
            setAiLoading(false);
        }
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 360px",
                height: "100vh",
                fontFamily: "sans-serif",
            }}
        >
            {/* Calendar side */}
            <div style={{ padding: 16, borderRight: "1px solid #ddd", overflowY: "auto" }}>
                {/* calender navigation */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setAnchorDate(subMonths(anchorDate, 1))}>◀</button>
                    <button onClick={jumpToToday}>Today</button>
                    <button onClick={() => setAnchorDate(addMonths(anchorDate, 1))}>▶</button>
                    <h2 style={{ margin: "0 0 0 8px" }}>{format(anchorDate, "MMMM yyyy")}</h2>
                </div>

                {/* Weekday labels */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 6,
                        marginBottom: 6,
                    }}
                >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div
                            key={d}
                            style={{ fontSize: 12, fontWeight: 600, textAlign: "center" }}
                        >
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
                                    if (!isCurrentMonth(day, anchorDate)) {
                                        setAnchorDate(day);
                                    }
                                }}
                                style={{
                                    minHeight: 72,
                                    border: isToday(day) ? "2px solid #ddd" : "1px solid #ddd",
                                    borderRadius: 8,
                                    padding: 6,
                                    textAlign: "left",
                                    background: isSelected ? "#eef5ff" : "white",
                                    opacity: isCurrentMonth(day, anchorDate) ? 1 : 0.45,
                                    cursor: "pointer",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: isToday(day) ? 800 : 400,
                                            textDecoration: "none",
                                        }}
                                    >
                                        {format(day, "d")}
                                    </span>

                                    {count > 0 && (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                border: "1px solid #aaa",
                                                borderRadius: 999,
                                                padding: "0 6px",
                                            }}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </div>

                                {/* Tiny preview (up to 2 task titles) */}
                                <div style={{ marginTop: 4, fontSize: 11 }}>
                                    {tasks
                                        .filter((t) => t.date === toDateKey(day))
                                        .slice(0, 2)
                                        .map((t) => {
                                            const p = (t.priority || 3) as 1 | 2 | 3;
                                            return (
                                                <div
                                                    key={t.id}
                                                    style={{
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        color: t.completed ? "#2e7d32" : PRIORITY_COLORS[p],
                                                        textDecoration: t.completed ? "line-through" : "none",
                                                        opacity: t.completed ? 0.7 : 1,
                                                    }}
                                                >
                                                    • {t.title}
                                                    {t.time ? `, ${t.time}` : ""} - P{p}
                                                </div>
                                            );
                                        })}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Task View */}
            <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
                {/* buttons for task view day, week, month */}
                <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
                    <div
                        style={{
                            display: "flex",
                            background: "#f0f0f0",
                            borderRadius: 8,
                            padding: 4,
                            marginBottom: 16,
                        }}
                    >
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
                                    fontWeight: taskViewMode === mode ? 600 : 400,
                                    textTransform: "capitalize",
                                }}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    <h3 style={{ marginTop: 0 }}>
                        {taskViewMode === "day" && format(selectedDate, "EEEE, MMM d")}
                        {taskViewMode === "week" && `Week of ${format(startOfWeek(selectedDate), "MMM d")}`}
                        {taskViewMode === "month" && format(anchorDate, "MMMM yyyy")}
                    </h3>
                </div>

                {/* task area */}
                <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
                    {/* Add task form only in day mode */}
                    {taskViewMode === "day" && (
                        <div
                            style={{
                                display: "grid",
                                gap: 8,
                                marginBottom: 20,
                                paddingBottom: 20,
                                borderBottom: "1px solid #eee",
                            }}
                        >
                            <input
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Task title"
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                            />
                            <textarea
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                placeholder="Add description ..."
                                rows={3}
                                style={{
                                    padding: "8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ddd",
                                    fontFamily: "inherit",
                                }}
                            />
                            <input
                                type="time"
                                value={newTaskTime}
                                onChange={(e) => setNewTaskTime(e.target.value)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                            />
                            <select
                                value={newPriorityValue}
                                onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                            >
                                <option value="1">Priority 1 (High)</option>
                                <option value="2">Priority 2 (Medium)</option>
                                <option value="3">Priority 3 (Low)</option>
                            </select>

                            <button
                                onClick={addTask}
                                style={{
                                    padding: "8px",
                                    background: "#007bff",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                }}
                            >
                                Add Task
                            </button>
                        </div>
                    )}

                    <div style={{ display: "grid", gap: 8 }}>
                        {sortedTasks.length === 0 && (
                            <div style={{ color: "#666" }}>No tasks for this {taskViewMode}.</div>
                        )}

                        {sortedTasks.map((task) => {
                            const p = (task.priority || 3) as 1 | 2 | 3;
                            return (
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
                                        background: task.completed ? "#f9f9f9" : "white",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => toggleTask(task.id)}
                                        style={{ marginTop: 4 }}
                                    />

                                    <div>
                                        {/* show dates when not in day view */}
                                        {taskViewMode !== "day" && (
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "#007bff",
                                                    fontWeight: 700,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {format(new Date(task.date + "T00:00:00"), "MMM d")}
                                            </div>
                                        )}

                                        <div
                                            style={{
                                                fontWeight: 600,
                                                textDecoration: task.completed ? "line-through" : "none",
                                                color: task.completed ? "#888" : "#000",
                                            }}
                                        >
                                            {task.title}
                                        </div>

                                        <div
                                            style={{
                                                marginTop: 4,
                                                fontSize: 12,
                                                color: task.completed ? "#999" : PRIORITY_COLORS[p],
                                            }}
                                        >
                                            Priority {p}
                                        </div>

                                        {task.description && (
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: task.completed ? "#aaa" : "#555",
                                                    marginTop: 4,
                                                    whiteSpace: "pre-wrap",
                                                    lineHeight: "1.4",
                                                }}
                                            >
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
                                            color: "#d9534f",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    {/* AI Summary Section (re-added) */}
                    <div style={{ marginTop: 16, borderTop: "1px solid #ddd", paddingTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                            Summarize the currently visible {taskViewMode} tasks ({sortedTasks.length})
                        </div>

                        <button
                            onClick={summarizeCurrentView}
                            disabled={aiLoading || sortedTasks.length === 0}
                            style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                cursor: aiLoading || sortedTasks.length === 0 ? "not-allowed" : "pointer",
                                opacity: aiLoading || sortedTasks.length === 0 ? 0.6 : 1,
                                background: "white",
                            }}
                        >
                            {aiLoading
                                ? "Summarizing..."
                                : taskViewMode === "day"
                                    ? `Summarize this day (${sortedTasks.length})`
                                    : taskViewMode === "week"
                                        ? `Summarize this week (${sortedTasks.length})`
                                        : `Summarize this month (${sortedTasks.length})`}
                        </button>

                        {aiError && <div style={{ color: "red", marginTop: 8 }}>{aiError}</div>}

                        {aiSummary && (
                            <div
                                style={{
                                    marginTop: 10,
                                    border: "1px solid #ddd",
                                    borderRadius: 8,
                                    padding: 10,
                                    background: "#fafafa",
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>{aiSummary.headline}</div>
                                <div style={{ marginTop: 6 }}>{aiSummary.summary}</div>

                                {aiMeta && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                                        Source: {aiMeta.model}
                                        {aiMeta.fallback ? " (fallback)" : ""}
                                    </div>
                                )}

                                {Array.isArray(aiSummary.suggestedWorkflow) &&
                                    aiSummary.suggestedWorkflow.length > 0 && (
                                        <div
                                            style={{
                                                marginTop: 12,
                                                padding: "10px",
                                                backgroundColor: "#e6f7ff",
                                                borderRadius: "6px",
                                                border: "1px solid #91d5ff",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    color: "#0050b3",
                                                    marginBottom: "6px",
                                                }}
                                            >
                                                🚀 Suggested Workflow
                                            </div>
                                            <ul
                                                style={{
                                                    margin: 0,
                                                    paddingLeft: "20px",
                                                    fontSize: "12px",
                                                    lineHeight: "1.6",
                                                    color: "#333",
                                                }}
                                            >
                                                {aiSummary.suggestedWorkflow.map((step, i) => (
                                                    <li key={i} style={{ marginBottom: "4px" }}>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                {aiSummary.stats && (
                                    <div style={{ marginTop: 8, fontSize: 13, color: "#444" }}>
                                        Total: {aiSummary.stats.total} · Completed: {aiSummary.stats.completed} · Pending:{" "}
                                        {aiSummary.stats.pending} · Timed: {aiSummary.stats.withTime}
                                    </div>
                                )}

                                {Array.isArray(aiSummary.upcoming) && aiSummary.upcoming.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>Upcoming</div>
                                        <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                                            {aiSummary.upcoming.map((u, i) => (
                                                <li key={`${u.title}-${u.date}-${i}`}>
                                                    {u.title} ({u.date}
                                                    {u.time ? ` ${u.time}` : ""})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {Array.isArray(aiSummary.suggestions) && aiSummary.suggestions.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>Suggestions</div>
                                        <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                                            {aiSummary.suggestions.map((s, i) => (
                                                <li key={i}>{s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {Array.isArray(aiSummary.warnings) && aiSummary.warnings.length > 0 && (
                                    <div style={{ marginTop: 8, color: "#8a6d3b", fontSize: 12 }}>
                                        {aiSummary.warnings.map((w, i) => (
                                            <div key={i}>⚠ {w}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notification Stack */}
            <div
                style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    display: "flex",
                    flexDirection: "column-reverse",
                    gap: "12px",
                    zIndex: 9999,
                    pointerEvents: "none",
                }}
            >
                {dueSoonTasks.map((task) => (
                    <div
                        key={task.id}
                        style={{
                            pointerEvents: "auto",
                            width: "300px",
                            backgroundColor: "#1e1e1e",
                            color: "white",
                            padding: "16px",
                            borderRadius: "12px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                            borderLeft: `6px solid ${PRIORITY_COLORS[task.priority as 1 | 2 | 3]}`,
                            animation: "slideInRight 0.3s ease-out",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                                style={{
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    color: "#faad14",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                UPCOMING
                            </span>
                            <button
                                onClick={() => setDueSoonTasks((prev) => prev.filter((t) => t.id !== task.id))}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#666",
                                    cursor: "pointer",
                                    fontSize: "18px",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ fontWeight: 600, marginTop: "8px", fontSize: "15px" }}>{task.title}</div>

                        <div
                            style={{
                                fontSize: "13px",
                                color: "#bbb",
                                marginTop: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            <span>Due at {task.time}</span>
                            <span style={{ color: "#555" }}>•</span>
                            <span>P{task.priority}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
