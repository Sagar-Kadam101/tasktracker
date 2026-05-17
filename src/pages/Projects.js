// src/pages/Projects.js
// Commit 1: list of projects + create-empty-project modal.
// Commit 2 will add bulk task creation + CSV import.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Projects({ profile }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [taskCounts, setTaskCounts] = useState({}); // { projectId: { total, done, overdue } }
  const [members, setMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return {
      name: "",
      description: "",
      owner_id: profile?.id || "",
      start_date: "",
      end_date: "",
      deadline_type: "target",
    };
  }

  useEffect(() => {
    fetchAll();
  }, [profile?.id]);

  async function fetchAll() {
    const [projRes, taskRes, memRes] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, project_id, status, due_date, visibility")
        .eq("archived", false),
      supabase.from("profiles").select("id, full_name, email, role"),
    ]);
    setProjects(projRes.data || []);
    setMembers(memRes.data || []);
    // Build task counts per project — RLS already filters tasks to what user can see
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = {};
    (taskRes.data || []).forEach((t) => {
      if (!t.project_id) return;
      if (!counts[t.project_id]) {
        counts[t.project_id] = { total: 0, done: 0, overdue: 0 };
      }
      counts[t.project_id].total++;
      if (t.status === "Done") counts[t.project_id].done++;
      if (t.due_date && new Date(t.due_date) < today && t.status !== "Done") {
        counts[t.project_id].overdue++;
      }
    });
    setTaskCounts(counts);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        owner_id: form.owner_id || profile?.id,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        deadline_type: form.end_date ? form.deadline_type : "none",
        status: "Active",
        created_by: profile?.id,
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.error("Project create error:", error);
        alert("Could not create project: " + error.message);
        return;
      }
      setShowModal(false);
      setForm(defaultForm());
      await fetchAll();
      // Go straight to the new project so user can start adding tasks (Commit 2 enables bulk-add there)
      if (data?.id) navigate(`/projects/${data.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Filter projects by status tab
  const filtered =
    statusFilter === "All"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  // Counts for status tabs
  const statusCounts = {
    Active: projects.filter((p) => p.status === "Active").length,
    "On Hold": projects.filter((p) => p.status === "On Hold").length,
    Completed: projects.filter((p) => p.status === "Completed").length,
    Cancelled: projects.filter((p) => p.status === "Cancelled").length,
    All: projects.length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">
            {projects.length} total · {statusCounts.Active} active
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm(defaultForm());
            setShowModal(true);
          }}
        >
          + New Project
        </button>
      </div>

      {/* Status tabs */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {["Active", "On Hold", "Completed", "Cancelled", "All"].map((s) => (
          <button
            key={s}
            className={`filter-dropdown-btn${
              statusFilter === s ? " has-value" : ""
            }`}
            onClick={() => setStatusFilter(s)}
            style={{ fontSize: 12.5 }}
          >
            {s}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                marginLeft: 6,
                opacity: 0.7,
              }}
            >
              {statusCounts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Project grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              margin: 0,
              marginBottom: 16,
            }}
          >
            {statusFilter === "All"
              ? "No projects yet. Create your first one to get started."
              : `No ${statusFilter.toLowerCase()} projects.`}
          </p>
          {statusFilter === "All" && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setForm(defaultForm());
                setShowModal(true);
              }}
            >
              + New Project
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              counts={taskCounts[p.id] || { total: 0, done: 0, overdue: 0 }}
              owner={members.find((m) => m.id === p.owner_id)}
              onClick={() => navigate(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title">New Project</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Project name{" "}
                    <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    className="form-input"
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Q3 Audit Preparation"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="What is this project about?"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner</label>
                  <select
                    className="form-select"
                    value={form.owner_id}
                    onChange={(e) =>
                      setForm({ ...form, owner_id: e.target.value })
                    }
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Start date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                {form.end_date && (
                  <div className="form-group">
                    <label className="form-label">Deadline type</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["hard", "target"].map((t) => (
                        <label
                          key={t}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            border: `2px solid ${
                              form.deadline_type === t
                                ? "var(--primary)"
                                : "var(--border)"
                            }`,
                            borderRadius: 8,
                            cursor: "pointer",
                            background:
                              form.deadline_type === t
                                ? "var(--primary-light, rgba(91, 76, 245, 0.08))"
                                : "transparent",
                          }}
                        >
                          <input
                            type="radio"
                            name="deadline_type"
                            value={t}
                            checked={form.deadline_type === t}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                deadline_type: e.target.value,
                              })
                            }
                            style={{ accentColor: "var(--primary)" }}
                          />
                          <span style={{ fontSize: 13 }}>
                            <strong>
                              {t === "hard" ? "🚨 Hard" : "🎯 Target"}
                            </strong>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                marginTop: 2,
                              }}
                            >
                              {t === "hard"
                                ? "Can't slip"
                                : "Aim for it, some slack ok"}
                            </div>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    padding: "10px 12px",
                    background: "var(--bg-soft)",
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  💡 After creating the project, you'll be taken to its page
                  where you can add tasks (bulk paste or CSV import coming in
                  the next update).
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.name.trim()}
                >
                  {saving ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, counts, owner, onClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pct =
    counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  // Days remaining / overdue
  let dateInfo = null;
  if (project.end_date) {
    const due = new Date(project.end_date);
    const diffMs = due - today;
    const days = Math.ceil(diffMs / 86400000);
    if (project.status === "Completed") {
      dateInfo = { text: "Completed", color: "var(--success)" };
    } else if (days < 0) {
      dateInfo = {
        text: `⚠ ${Math.abs(days)}d overdue`,
        color: "var(--danger)",
      };
    } else if (days === 0) {
      dateInfo = { text: "Due today", color: "var(--warning)" };
    } else if (days <= 7) {
      dateInfo = { text: `${days}d left`, color: "var(--warning)" };
    } else {
      dateInfo = { text: `${days}d left`, color: "var(--text-secondary)" };
    }
  }

  const statusColor = {
    Active: "var(--success)",
    "On Hold": "var(--warning)",
    Completed: "var(--primary)",
    Cancelled: "var(--text-tertiary)",
  }[project.status];

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "all 0.15s",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {project.name}
          </div>
          {project.description && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.4,
              }}
            >
              {project.description}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: statusColor,
            background: "var(--bg-soft)",
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {project.status}
        </span>
      </div>

      {/* progress bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--text-secondary)",
            marginBottom: 4,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>
            {counts.done}/{counts.total} tasks
          </span>
          <span style={{ fontWeight: 600 }}>{pct}%</span>
        </div>
        <div
          style={{
            height: 5,
            background: "var(--border)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background:
                pct >= 100
                  ? "var(--success)"
                  : pct >= 50
                  ? "var(--primary)"
                  : "var(--warning)",
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>

      {/* footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
          flexWrap: "wrap",
        }}
      >
        {owner && <span>👤 {owner.full_name?.split(" ")[0]}</span>}
        {counts.overdue > 0 && (
          <span
            style={{
              color: "var(--danger)",
              fontWeight: 700,
            }}
          >
            ⚠ {counts.overdue} overdue
          </span>
        )}
        {dateInfo && (
          <span style={{ color: dateInfo.color, marginLeft: "auto" }}>
            {dateInfo.text}
          </span>
        )}
      </div>
    </div>
  );
}
