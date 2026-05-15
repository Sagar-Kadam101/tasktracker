// src/pages/Dashboard.js — drop-in replacement
// This is your "My Tasks" page. Big serif welcome, grouped task lists.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Dashboard({ profile }) {
  const [tasks, setTasks] = useState([]);
  const [people, setPeople] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .then(({ data }) => setTasks(data || []));
    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => setPeople(data || []));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);

  const mine = tasks.filter((t) => t.assignee_id === profile?.id);
  const open = mine.filter((t) => t.status !== "Done");

  const isOverdue = (t) =>
    t.due_date && new Date(t.due_date) < today && t.status !== "Done";
  const isToday = (t) =>
    t.due_date && new Date(t.due_date).toDateString() === today.toDateString();
  const isWeek = (t) =>
    t.due_date &&
    new Date(t.due_date) > today &&
    new Date(t.due_date) <= week &&
    t.status !== "Done";
  const isLater = (t) =>
    t.due_date && new Date(t.due_date) > week && t.status !== "Done";

  const groups = [
    { label: "Overdue", tasks: mine.filter(isOverdue), tone: "var(--danger)" },
    { label: "Today", tasks: mine.filter(isToday), tone: "var(--primary)" },
    { label: "This week", tasks: mine.filter(isWeek), tone: "var(--success)" },
    {
      label: "Later",
      tasks: mine.filter(isLater),
      tone: "var(--text-tertiary)",
    },
    {
      label: "Recently done",
      tasks: mine.filter((t) => t.status === "Done").slice(0, 5),
      tone: "var(--success)",
    },
  ];

  const counts = {
    overdue: mine.filter(isOverdue).length,
    today: mine.filter(isToday).length,
    upcoming: open.filter((t) => t.due_date && new Date(t.due_date) > today)
      .length,
    done: mine.filter((t) => t.status === "Done").length,
  };

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div>
      <div className="page-header">
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {today.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="page-title">
            Good morning,{" "}
            <em style={{ color: "var(--primary)", fontStyle: "italic" }}>
              {firstName}
            </em>
            .
          </h1>
          <p className="page-sub">
            {open.length} open · {counts.overdue} overdue · {counts.done}{" "}
            completed
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>
            {counts.overdue}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--primary)" }}>
            {counts.today}
          </div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{counts.upcoming}</div>
          <div className="stat-label">Upcoming</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {counts.done}
          </div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups
          .filter((g) => g.tasks.length)
          .map((g) => (
            <section
              key={g.label}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 16,
                    background: g.tone,
                    borderRadius: 2,
                  }}
                />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: -0.1,
                  }}
                >
                  {g.label}
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    background: "var(--bg-soft)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  {g.tasks.length}
                </span>
              </header>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {g.tasks.map((t) => {
                  const overdue = isOverdue(t);
                  return (
                    <li
                      key={t.id}
                      onClick={() => navigate("/board")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 18px",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border:
                            "1.5px solid " +
                            (t.status === "Done"
                              ? "var(--success)"
                              : "var(--border-strong)"),
                          background:
                            t.status === "Done"
                              ? "var(--success)"
                              : "transparent",
                          flex: "0 0 auto",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 13.5,
                            color: "var(--text-primary)",
                            textDecoration:
                              t.status === "Done" ? "line-through" : "none",
                          }}
                        >
                          {t.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                            fontFamily: "var(--font-mono)",
                            marginTop: 3,
                            display: "flex",
                            gap: 12,
                          }}
                        >
                          {t.category && <span>{t.category}</span>}
                          {t.priority && <span>{t.priority}</span>}
                          {t.task_type === "Recurring" && (
                            <span>↻ {t.recurrence}</span>
                          )}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: overdue
                            ? "var(--danger)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </span>
                      <span
                        className={`badge badge-${t.status
                          ?.replace(/ /g, "")
                          .toLowerCase()}`}
                      >
                        {t.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

        {mine.length === 0 && (
          <div className="card">
            <p
              style={{
                fontSize: 14,
                color: "var(--text-tertiary)",
                margin: 0,
                fontStyle: "italic",
                fontFamily: "var(--font-display)",
              }}
            >
              No tasks assigned to you yet. Visit the Board to create one or get
              assigned to existing tasks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
