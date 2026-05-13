import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["To Do", "In Progress", "In Review", "Done"];
const PRIORITIES = ["High", "Medium", "Low"];
const CATEGORIES = [
  "Engineering",
  "Design",
  "Finance",
  "Marketing",
  "Operations",
];
const RECURRENCES = ["None", "Daily", "Weekly", "Fortnightly", "Monthly"];
const STATUS_COLORS = {
  "To Do": "#6B7280",
  "In Progress": "#0369A1",
  "In Review": "#D97706",
  Done: "#16A34A",
};
const AVATAR_COLORS = [
  "#5B4CF5",
  "#1D9E75",
  "#D97706",
  "#DC2626",
  "#0369A1",
  "#7C3AED",
  "#DB2777",
];

function getColor(name = "") {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Board({ profile }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return {
      title: "",
      description: "",
      assignee_id: "",
      due_date: "",
      priority: "Medium",
      category: "Engineering",
      status: "To Do",
      task_type: "One-time",
      recurrence: "None",
      drive_link: "",
      blocked_by: "",
      tags: "",
    };
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, assignee:profiles!tasks_assignee_id_fkey(id,full_name), blocked_by_task:tasks!tasks_blocked_by_fkey(id,title)"
        )
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,role"),
    ]);
    setTasks(t || []);
    setMembers(m || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      assignee_id: form.assignee_id || null,
      blocked_by: form.blocked_by || null,
      archived: false,
      created_by: profile?.id,
    };
    if (editTask) {
      await supabase.from("tasks").update(payload).eq("id", editTask.id);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    setShowModal(false);
    setEditTask(null);
    setForm(defaultForm());
    fetchAll();
  }

  async function updateStatus(taskId, newStatus) {
    const updates = { status: newStatus };
    if (newStatus === "Done") updates.completed_at = new Date().toISOString();
    await supabase.from("tasks").update(updates).eq("id", taskId);
    fetchAll();
  }

  async function archiveTask(taskId) {
    await supabase
      .from("tasks")
      .update({ archived: true, completed_at: new Date().toISOString() })
      .eq("id", taskId);
    fetchAll();
  }

  function openEdit(task) {
    setEditTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      assignee_id: task.assignee_id || "",
      due_date: task.due_date || "",
      priority: task.priority || "Medium",
      category: task.category || "Engineering",
      status: task.status || "To Do",
      task_type: task.task_type || "One-time",
      recurrence: task.recurrence || "None",
      drive_link: task.drive_link || "",
      blocked_by: task.blocked_by || "",
      tags: task.tags || "",
    });
    setShowModal(true);
  }

  function openNew(status = "To Do") {
    setEditTask(null);
    setForm({ ...defaultForm(), status });
    setShowModal(true);
  }

  const filtered = tasks.filter((t) => {
    if (filterCat !== "All" && t.category !== filterCat) return false;
    if (filterAssignee !== "All" && t.assignee_id !== filterAssignee)
      return false;
    return true;
  });

  const byStatus = (status) => filtered.filter((t) => t.status === status);

  if (loading)
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Board</h1>
          <p className="page-sub">
            {tasks.length} total tasks ·{" "}
            {tasks.filter((t) => t.status === "Done").length} completed
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew()}>
          + New Task
        </button>
      </div>

      <div className="filter-bar">
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontWeight: 600,
          }}
        >
          Category:
        </span>
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            className={`filter-pill${filterCat === c ? " active" : ""}`}
            onClick={() => setFilterCat(c)}
          >
            {c}
          </button>
        ))}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontWeight: 600,
            marginLeft: 8,
          }}
        >
          Assignee:
        </span>
        <button
          className={`filter-pill${filterAssignee === "All" ? " active" : ""}`}
          onClick={() => setFilterAssignee("All")}
        >
          All
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            className={`filter-pill${filterAssignee === m.id ? " active" : ""}`}
            onClick={() => setFilterAssignee(m.id)}
          >
            {m.full_name?.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="kanban-board">
        {STATUSES.map((status) => (
          <div key={status} className="kanban-col">
            <div className="kanban-col-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: STATUS_COLORS[status],
                  }}
                ></div>
                <span className="kanban-col-title">{status}</span>
              </div>
              <span className="kanban-count">{byStatus(status).length}</span>
            </div>
            {byStatus(status).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => openEdit(task)}
                onStatusChange={(s) => updateStatus(task.id, s)}
                onArchive={() => archiveTask(task.id)}
                statuses={STATUSES}
              />
            ))}
            <button className="add-task-btn" onClick={() => openNew(status)}>
              + Add task
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editTask ? "Edit Task" : "New Task"}
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Task title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="What needs to be done?"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Add more details..."
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div className="form-group">
                  <label className="form-label">Assign to</label>
                  <select
                    className="form-select"
                    value={form.assignee_id}
                    onChange={(e) =>
                      setForm({ ...form, assignee_id: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm({ ...form, due_date: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Task type</label>
                  <select
                    className="form-select"
                    value={form.task_type}
                    onChange={(e) =>
                      setForm({ ...form, task_type: e.target.value })
                    }
                  >
                    <option>One-time</option>
                    <option>Recurring</option>
                  </select>
                </div>
                {form.task_type === "Recurring" && (
                  <div className="form-group">
                    <label className="form-label">Repeats</label>
                    <select
                      className="form-select"
                      value={form.recurrence}
                      onChange={(e) =>
                        setForm({ ...form, recurrence: e.target.value })
                      }
                    >
                      {RECURRENCES.filter((r) => r !== "None").map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Blocked by</label>
                  <select
                    className="form-select"
                    value={form.blocked_by}
                    onChange={(e) =>
                      setForm({ ...form, blocked_by: e.target.value })
                    }
                  >
                    <option value="">None</option>
                    {tasks
                      .filter((t) => t.id !== editTask?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Google Drive link</label>
                <input
                  className="form-input"
                  value={form.drive_link}
                  onChange={(e) =>
                    setForm({ ...form, drive_link: e.target.value })
                  }
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input
                  className="form-input"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="e.g. urgent, client, Q2"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editTask ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onStatusChange, onArchive, statuses }) {
  const [showMenu, setShowMenu] = useState(false);
  const name = task.assignee?.full_name || "";
  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "Done";

  return (
    <div className="task-card" onClick={onEdit}>
      <div className="task-card-title">{task.title}</div>
      <div
        style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}
      >
        <span className={`badge badge-${task.priority?.toLowerCase()}`}>
          {task.priority}
        </span>
        <span className={`badge badge-${task.category?.toLowerCase()}`}>
          {task.category}
        </span>
        {task.task_type === "Recurring" && (
          <span className="badge badge-recurring">⟳ {task.recurrence}</span>
        )}
      </div>
      {task.blocked_by_task && (
        <div className="dep-tag">
          ⛔ Blocked by: {task.blocked_by_task.title}
        </div>
      )}
      <div className="task-card-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {name && (
            <div
              className="avatar"
              style={{
                background: getColor(name),
                width: 22,
                height: 22,
                fontSize: 9,
              }}
            >
              {getInitials(name)}
            </div>
          )}
          {task.due_date && (
            <span
              style={{
                fontSize: 10,
                color: isOverdue ? "var(--danger)" : "var(--text-tertiary)",
                fontWeight: isOverdue ? 700 : 400,
              }}
            >
              {isOverdue ? "⚠ " : ""}
              {new Date(task.due_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {task.drive_link && (
            <span style={{ fontSize: 10, color: "var(--info)" }}>📎</span>
          )}
        </div>
        <div
          style={{ position: "relative" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              fontSize: 16,
              padding: "0 4px",
            }}
            onClick={() => setShowMenu(!showMenu)}
          >
            ⋯
          </button>
          {showMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: "100%",
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "var(--shadow-md)",
                zIndex: 100,
                minWidth: 140,
                padding: "4px 0",
              }}
            >
              {statuses
                .filter((s) => s !== task.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(s);
                      setShowMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "7px 14px",
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "var(--text-primary)",
                    }}
                  >
                    → Move to {s}
                  </button>
                ))}
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--border)",
                  margin: "4px 0",
                }}
              />
              <button
                onClick={() => {
                  onArchive();
                  setShowMenu(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "7px 14px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "var(--danger)",
                }}
              >
                Archive task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
