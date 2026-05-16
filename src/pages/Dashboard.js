// src/pages/Dashboard.js — drop-in replacement
// Adds "Tasks awaiting your review" section. Reviewer + TAT-aware.

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
    toReview: toReview.length,
    reviewOverdue: toReview.filter(isReviewOverdue).length,
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
            {counts.toReview > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                  {counts.toReview} to review
                </span>
              </>
            )}
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
        {/* TASKS AWAITING YOUR REVIEW — pinned at top when present */}
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

        {mine.length === 0 && toReview.length === 0 && (
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
