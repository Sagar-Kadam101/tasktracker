// src/pages/ProjectDetail.js
// Commit 1: stub showing project info + task list (read-only).
// Commit 2 will add bulk-add UI + CSV import + full mini-kanban.

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ProjectDetail({ profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [pRes, tRes, mRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)")
        .eq("project_id", id)
        .eq("archived", false)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, role"),
    ]);
    if (pRes.error) {
      console.error(pRes.error);
    }
    setProject(pRes.data || null);
    setTasks(tRes.data || []);
    setMembers(mRes.data || []);
    setLoading(false);
  }

  // Admin-only: count private tasks not visible to current user
  // RLS already filters them out; we query the count separately as admin
  const [hiddenCount, setHiddenCount] = useState(0);
  useEffect(() => {
    if (profile?.role !== "admin") return;
    // Admins see all anyway via RLS, so just count private ones for the footer
    const priv = tasks.filter((t) => t.visibility === "private").length;
    setHiddenCount(priv);
  }, [tasks, profile?.role]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Project not found, or you don't have access.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/projects")}
          style={{ marginTop: 12 }}
        >
          ← Back to Projects
        </button>
      </div>
    );
  }

  const owner = members.find((m) => m.id === project.owner_id);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < today && t.status !== "Done"
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/projects")}
          style={{ fontSize: 12, padding: "4px 8px" }}
        >
          ← Projects
        </button>
      </div>

      {/* Header */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{project.name}</h1>
          {project.description && (
            <p className="page-sub" style={{ color: "var(--text-secondary)" }}>
              {project.description}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-primary)",
            background: "var(--bg-soft)",
            padding: "5px 12px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {project.status}
        </span>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {done}
          </div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: overdue > 0 ? "var(--danger)" : "inherit" }}
          >
            {overdue}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--primary)" }}>
            {pct}%
          </div>
          <div className="stat-label">Progress</div>
        </div>
      </div>

      {/* Project meta card */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Owner
          </div>
          <div style={{ fontSize: 13 }}>{owner?.full_name || "—"}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Start
          </div>
          <div style={{ fontSize: 13 }}>{project.start_date || "—"}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            End
          </div>
          <div style={{ fontSize: 13 }}>
            {project.end_date || "—"}
            {project.end_date && project.deadline_type === "hard" && (
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 6,
                  color: "var(--danger)",
                  fontWeight: 700,
                }}
              >
                🚨 HARD
              </span>
            )}
            {project.end_date && project.deadline_type === "target" && (
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 6,
                  color: "var(--primary)",
                  fontWeight: 700,
                }}
              >
                🎯 TARGET
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Task list (read-only stub for Commit 1) */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tasks</h3>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              fontStyle: "italic",
            }}
          >
            Bulk add + CSV import coming in next update
          </span>
        </header>
        {tasks.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
              No tasks yet in this project.
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
              }}
            >
              For now, you can create tasks from the Board and set their Project
              to this one when editing.
            </p>
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {tasks.map((t) => {
              const taskOverdue =
                t.due_date &&
                new Date(t.due_date) < today &&
                t.status !== "Done";
              return (
                <li
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border:
                        "1.5px solid " +
                        (t.status === "Done"
                          ? "var(--success)"
                          : "var(--border-strong)"),
                      background:
                        t.status === "Done" ? "var(--success)" : "transparent",
                      flex: "0 0 auto",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        textDecoration:
                          t.status === "Done" ? "line-through" : "none",
                      }}
                    >
                      {t.visibility === "private" && (
                        <span title="Private" style={{ marginRight: 4 }}>
                          🔒
                        </span>
                      )}
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
                      {t.assignee && <span>{t.assignee.full_name}</span>}
                      {t.category && <span>{t.category}</span>}
                      {t.priority && <span>{t.priority}</span>}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: taskOverdue
                        ? "var(--danger)"
                        : "var(--text-secondary)",
                      fontWeight: taskOverdue ? 700 : 400,
                    }}
                  >
                    {t.due_date || "—"}
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
        )}
        {profile?.role === "admin" && hiddenCount > 0 && (
          <div
            style={{
              padding: "10px 18px",
              borderTop: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontStyle: "italic",
              background: "var(--bg-soft)",
            }}
          >
            🔒 {hiddenCount} private task{hiddenCount > 1 ? "s" : ""} in this
            project (visible to you as admin).
          </div>
        )}
      </div>
    </div>
  );
}
