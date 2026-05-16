// src/pages/Dashboard.js — drop-in replacement
// Refinements: smart greeting, motivational line, weekly progress, focus card,
// priority accent stripe. Circle stays decorative.

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

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);

  // Start of current week (Monday)
  const weekStart = new Date(today);
  const dayOfWeek = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
  weekStart.setDate(weekStart.getDate() - dayOfWeek);

  const mine = tasks.filter((t) => t.assignee_id === profile?.id);
  const open = mine.filter((t) => t.status !== "Done");

  // Tasks where I am the reviewer and they're currently In Review
  const toReview = tasks.filter(
    (t) => t.reviewer_id === profile?.id && t.status === "In Review"
  );

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

  // Helper: is this review past its TAT?
  const isReviewOverdue = (t) =>
    t.status === "In Review" &&
    t.review_started_at &&
    t.review_tat_days &&
    new Date(t.review_started_at).getTime() + t.review_tat_days * 86400000 <
      Date.now();

  // Helper: days remaining (or overdue) for review
  const reviewDays = (t) => {
    if (!t.review_started_at || !t.review_tat_days) return null;
    const dueMs =
      new Date(t.review_started_at).getTime() + t.review_tat_days * 86400000;
    const diffMs = dueMs - Date.now();
    return Math.ceil(Math.abs(diffMs) / 86400000) * (diffMs < 0 ? -1 : 1);
  };

  // Priority sort: High > Medium > Low > undefined
  const priorityWeight = { High: 0, Medium: 1, Low: 2 };
  const sortByPriorityThenDate = (a, b) => {
    const pa = priorityWeight[a.priority] ?? 3;
    const pb = priorityWeight[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date)
      return new Date(a.due_date) - new Date(b.due_date);
    return 0;
  };

  const groups = [
    {
      label: "Overdue",
      tasks: mine.filter(isOverdue).sort(sortByPriorityThenDate),
      tone: "var(--danger)",
    },
    {
      label: "Today",
      tasks: mine.filter(isToday).sort(sortByPriorityThenDate),
      tone: "var(--primary)",
    },
    {
      label: "This week",
      tasks: mine.filter(isWeek).sort(sortByPriorityThenDate),
      tone: "var(--success)",
    },
    {
      label: "Later",
      tasks: mine.filter(isLater).sort(sortByPriorityThenDate),
      tone: "var(--text-tertiary)",
    },
    {
      label: "Recently done",
      tasks: mine
        .filter((t) => t.status === "Done")
        .sort((a, b) => {
          const da = a.completed_at ? new Date(a.completed_at) : new Date(0);
          const db = b.completed_at ? new Date(b.completed_at) : new Date(0);
          return db - da;
        })
        .slice(0, 5),
      tone: "var(--success)",
    },
  ];

  // ── This week's progress ──
  const tasksDueThisWeek = mine.filter(
    (t) =>
      t.due_date &&
      new Date(t.due_date) >= weekStart &&
      new Date(t.due_date) <= week
  );
  const completedThisWeek = mine.filter(
    (t) =>
      t.status === "Done" &&
      t.completed_at &&
      new Date(t.completed_at) >= weekStart
  );
  const totalThisWeek =
    completedThisWeek.length +
    tasksDueThisWeek.filter((t) => t.status !== "Done").length;
  const weekProgressPct = totalThisWeek
    ? Math.round((completedThisWeek.length / totalThisWeek) * 100)
    : 0;

  const counts = {
    overdue: mine.filter(isOverdue).length,
    today: mine.filter(isToday).length,
    upcoming: open.filter((t) => t.due_date && new Date(t.due_date) > today)
      .length,
    done: mine.filter((t) => t.status === "Done").length,
    toReview: toReview.length,
    reviewOverdue: toReview.filter(isReviewOverdue).length,
    high: open.filter((t) => t.priority === "High").length,
  };

  // ── Time-aware greeting ──
  const hour = now.getHours();
  let greeting;
  if (hour >= 5 && hour < 12) greeting = "Good morning";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17 && hour < 22) greeting = "Good evening";
  else greeting = "Burning the midnight oil";

  // ── Motivational/contextual subline (always positive) ──
  function getMotivationalLine() {
    if (mine.length === 0) {
      return "A blank slate. Time to plan something great.";
    }
    if (open.length === 0 && counts.done > 0) {
      return "Inbox zero. You've earned a coffee. ☕";
    }
    if (counts.overdue >= 5) {
      return "A busy stretch. One step at a time — you've got this.";
    }
    if (counts.overdue > 0) {
      return `${counts.overdue} catching up. Take the first one and momentum follows.`;
    }
    if (counts.high >= 3) {
      return `${counts.high} high-priority items today. Focus mode on.`;
    }
    if (counts.toReview > 0) {
      return `${counts.toReview} item${
        counts.toReview > 1 ? "s" : ""
      } waiting for your eyes. Quick wins.`;
    }
    if (counts.today > 0) {
      return `${counts.today} due today. A focused day ahead.`;
    }
    if (completedThisWeek.length >= 5) {
      return `${completedThisWeek.length} done this week. Strong momentum.`;
    }
    if (open.length <= 3) {
      return "A light load today. Use the headroom wisely.";
    }
    return "Let's make this a productive day.";
  }
  const motivationalLine = getMotivationalLine();

  // ── Focus task — the single most-pressing thing ──
  const allUrgent = [...mine.filter(isOverdue), ...mine.filter(isToday)].sort(
    sortByPriorityThenDate
  );
  const focusTask = allUrgent.length > 0 ? allUrgent[0] : null;

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
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="page-title">
            {greeting},{" "}
            <em style={{ color: "var(--primary)", fontStyle: "italic" }}>
              {firstName}
            </em>
            .
          </h1>
          <p
            className="page-sub"
            style={{
              fontStyle: "italic",
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            {motivationalLine}
          </p>
        </div>
      </div>

      {/* ── WEEKLY PROGRESS BAR ── */}
      {(tasksDueThisWeek.length > 0 || completedThisWeek.length > 0) && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                This week
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {completedThisWeek.length} completed
                {tasksDueThisWeek.filter((t) => t.status !== "Done").length >
                  0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {
                        tasksDueThisWeek.filter((t) => t.status !== "Done")
                          .length
                      }{" "}
                      remaining
                    </span>
                  </>
                )}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--border)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${weekProgressPct}%`,
                  height: "100%",
                  background:
                    weekProgressPct >= 80
                      ? "var(--success)"
                      : weekProgressPct >= 40
                      ? "var(--primary)"
                      : "var(--warning)",
                  borderRadius: 3,
                  transition: "width 0.5s ease-out",
                }}
              ></div>
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color:
                weekProgressPct >= 80
                  ? "var(--success)"
                  : "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              minWidth: 56,
              textAlign: "right",
            }}
          >
            {weekProgressPct}%
          </div>
        </div>
      )}

      {/* ── FOCUS TASK CARD ── */}
      {focusTask && (
        <div
          onClick={() => navigate("/board")}
          style={{
            background:
              "linear-gradient(135deg, var(--primary-light, rgba(91, 76, 245, 0.08)) 0%, var(--bg-card) 60%)",
            border: "1px solid var(--primary)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 28 }}>🎯</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--primary)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Your focus today
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {focusTask.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                display: "flex",
                gap: 12,
              }}
            >
              {focusTask.category && <span>{focusTask.category}</span>}
              {focusTask.priority && (
                <span
                  style={{
                    color:
                      focusTask.priority === "High"
                        ? "var(--danger)"
                        : focusTask.priority === "Medium"
                        ? "var(--warning)"
                        : "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {focusTask.priority}
                </span>
              )}
              {focusTask.due_date && (
                <span
                  style={{
                    color: isOverdue(focusTask)
                      ? "var(--danger)"
                      : "var(--text-secondary)",
                    fontWeight: isOverdue(focusTask) ? 700 : 400,
                  }}
                >
                  {isOverdue(focusTask) ? "⚠ Overdue: " : "Due "}
                  {new Date(focusTask.due_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 22, color: "var(--primary)" }}>→</div>
        </div>
      )}

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
        {/* TASKS AWAITING YOUR REVIEW */}
        {toReview.length > 0 && (
          <section
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              borderTop: "3px solid var(--primary)",
            }}
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
              <span style={{ fontSize: 18 }}>👁</span>
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: -0.1,
                }}
              >
                Tasks awaiting your review
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
                {toReview.length}
              </span>
              {counts.reviewOverdue > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--danger)",
                    background: "rgba(220, 38, 38, 0.10)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  {counts.reviewOverdue} overdue
                </span>
              )}
            </header>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {toReview.map((t) => {
                const days = reviewDays(t);
                const overdue = isReviewOverdue(t);
                const assignee = people.find((p) => p.id === t.assignee_id);
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
                    <span style={{ fontSize: 14 }}>👁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 13.5,
                          color: "var(--text-primary)",
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
                        {assignee && <span>by {assignee.full_name}</span>}
                        {t.category && <span>{t.category}</span>}
                        {t.priority && <span>{t.priority}</span>}
                      </div>
                    </div>
                    {days !== null && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: overdue ? "var(--danger)" : "var(--success)",
                        }}
                      >
                        {overdue
                          ? `⚠ ${Math.abs(days)}d late`
                          : `${days}d left`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
                  const isHighPriority = t.priority === "High";
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
                        borderLeft: isHighPriority
                          ? "3px solid var(--danger)"
                          : "3px solid transparent",
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
                          {t.priority && (
                            <span
                              style={{
                                color: isHighPriority
                                  ? "var(--danger)"
                                  : "inherit",
                                fontWeight: isHighPriority ? 700 : 400,
                              }}
                            >
                              {t.priority}
                            </span>
                          )}
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

        {mine.length === 0 && toReview.length === 0 && (
          <div className="card">
            <p
              style={{
                fontSize: 14,
                color: "var(--text-tertiary)",
                margin: 0,
                fontStyle: "italic",
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
