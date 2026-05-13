import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

const CAT_COLORS = {
  Engineering: "#DBEAFE",
  Design: "#DCFCE7",
  Finance: "#FEF3C7",
  Marketing: "#FEE2E2",
  Operations: "#F3F4F6",
};
const CAT_TEXT = {
  Engineering: "#1D4ED8",
  Design: "#15803D",
  Finance: "#B45309",
  Marketing: "#B91C1C",
  Operations: "#374151",
};

export default function CalendarView() {
  const [tasks, setTasks] = useState([]);
  const [current, setCurrent] = useState(new Date());
  const [filterCat, setFilterCat] = useState("All");

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)")
      .eq("archived", false)
      .then(({ data }) => setTasks(data || []));
  }, []);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const filtered = tasks.filter(
    (t) => filterCat === "All" || t.category === filterCat
  );

  function tasksOnDay(day) {
    return filtered.filter(
      (t) => t.due_date && isSameDay(new Date(t.due_date), day)
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Calendar</h1>
          <p className="page-sub">All tasks plotted by due date</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            onClick={() =>
              setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1))
            }
          >
            ← Prev
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {format(current, "MMMM yyyy")}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() =>
              setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1))
            }
          >
            Next →
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {[
          "All",
          "Engineering",
          "Design",
          "Finance",
          "Marketing",
          "Operations",
        ].map((c) => (
          <button
            key={c}
            className={`filter-pill${filterCat === c ? " active" : ""}`}
            onClick={() => setFilterCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="calendar-day-header">
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            const dayTasks = tasksOnDay(day);
            const inMonth = isSameMonth(day, current);
            const todayDay = isToday(day);
            return (
              <div
                key={i}
                className={`calendar-cell${!inMonth ? " other-month" : ""}${
                  todayDay ? " today" : ""
                }`}
              >
                <div
                  className={`calendar-date${todayDay ? " today-num" : ""}`}
                  style={!inMonth ? { opacity: 0.4 } : {}}
                >
                  {format(day, "d")}
                </div>
                {dayTasks.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="cal-task-chip"
                    style={{
                      background: CAT_COLORS[t.category] || "#F3F4F6",
                      color: CAT_TEXT[t.category] || "#374151",
                    }}
                    title={`${t.title} — ${
                      t.assignee?.full_name || "Unassigned"
                    }`}
                  >
                    {t.task_type === "Recurring" ? "⟳ " : ""}
                    {t.title}
                  </span>
                ))}
                {dayTasks.length > 3 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      paddingLeft: 4,
                    }}
                  >
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}
      >
        {Object.entries(CAT_COLORS).map(([cat, bg]) => (
          <div
            key={cat}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--text-secondary)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: bg,
                border: "1px solid #e5e7eb",
              }}
            ></div>
            {cat}
          </div>
        ))}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          <span>⟳</span> Recurring
        </div>
      </div>
    </div>
  );
}
