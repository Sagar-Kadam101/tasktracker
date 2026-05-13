import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["To Do", "In Progress", "In Review", "Done"];
const PRIORITIES = ["High", "Medium", "Low"];
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
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [fileLinks, setFileLinks] = useState([""]);
  const [activeTab, setActiveTab] = useState("details");

  function defaultForm() {
    return {
      title: "",
      description: "",
      assignee_id: "",
      due_date: "",
      priority: "Medium",
      category: "",
      status: "To Do",
      task_type: "One-time",
      recurrence: "None",
      drive_link: "",
      blocked_by: "",
      tags: "",
      file_urls: "",
    };
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: t, error: te }, { data: m }, { data: c }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*, assignee:profiles!tasks_assignee_id_fkey(id,full_name)")
            .eq("archived", false)
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("id,full_name,role"),
          supabase.from("categories").select("*").order("created_at"),
        ]);
      if (te) console.error("Tasks error:", te);
      setTasks(t || []);
      setMembers(m || []);
      setCategories(c || []);
    } catch (err) {
      console.error("fetchAll error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function fetchTaskDetails(taskId) {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase
        .from("comments")
        .select("*, author:profiles(id,full_name)")
        .eq("task_id", taskId)
        .order("created_at"),
      supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at"),
    ]);
    setComments(c || []);
    setSubtasks(s || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const allFileLinks = fileLinks.filter((f) => f.trim() !== "");
      const payload = {
        title: form.title,
        description: form.description || null,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        priority: form.priority,
        category: form.category || null,
        status: form.status,
        task_type: form.task_type,
        recurrence: form.recurrence || "None",
        drive_link: form.drive_link || null,
        blocked_by: form.blocked_by || null,
        tags: form.tags || null,
        file_urls:
          allFileLinks.length > 0 ? JSON.stringify(allFileLinks) : null,
        archived: false,
        created_by: profile?.id,
      };
      if (editTask) {
        const { error } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", editTask.id);
        if (error) {
          console.error("Update error:", error);
          return;
        }
      } else {
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) {
          console.error("Insert error:", error);
          return;
        }
      }
      setShowModal(false);
      setEditTask(null);
      setForm(defaultForm());
      setFileLinks([""]);
      await fetchAll();
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(taskId, newStatus) {
    const updates = { status: newStatus };
    if (newStatus === "Done") updates.completed_at = new Date().toISOString();
    await supabase.from("tasks").update(updates).eq("id", taskId);
    await fetchAll();
  }

  async function archiveTask(taskId) {
    await supabase
      .from("tasks")
      .update({
        archived: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    setShowDetailModal(false);
    await fetchAll();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    await supabase.from("comments").insert({
      task_id: selectedTask.id,
      author_id: profile?.id,
      content: newComment.trim(),
    });
    setNewComment("");
    await fetchTaskDetails(selectedTask.id);
  }

  async function deleteComment(commentId) {
    await supabase.from("comments").delete().eq("id", commentId);
    await fetchTaskDetails(selectedTask.id);
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    await supabase.from("subtasks").insert({
      task_id: selectedTask.id,
      title: newSubtask.trim(),
      created_by: profile?.id,
    });
    setNewSubtask("");
    await fetchTaskDetails(selectedTask.id);
  }

  async function toggleSubtask(subtaskId, completed) {
    await supabase
      .from("subtasks")
      .update({ completed: !completed })
      .eq("id", subtaskId);
    await fetchTaskDetails(selectedTask.id);
  }

  async function deleteSubtask(subtaskId) {
    await supabase.from("subtasks").delete().eq("id", subtaskId);
    await fetchTaskDetails(selectedTask.id);
  }

  function openDetail(task) {
    setSelectedTask(task);
    setActiveTab("details");
    fetchTaskDetails(task.id);
    setShowDetailModal(true);
  }

  function openEdit(task) {
    setEditTask(task);
    const existingFiles = task.file_urls ? JSON.parse(task.file_urls) : [""];
    setFileLinks(existingFiles.length > 0 ? existingFiles : [""]);
    setForm({
      title: task.title || "",
      description: task.description || "",
      assignee_id: task.assignee_id || "",
      due_date: task.due_date || "",
      priority: task.priority || "Medium",
      category: task.category || "",
      status: task.status || "To Do",
      task_type: task.task_type || "One-time",
      recurrence: task.recurrence || "None",
      drive_link: task.drive_link || "",
      blocked_by: task.blocked_by || "",
      tags: task.tags || "",
      file_urls: task.file_urls || "",
    });
    setShowDetailModal(false);
    setShowModal(true);
  }

  function openNew(status = "To Do") {
    setEditTask(null);
    setFileLinks([""]);
    setForm({ ...defaultForm(), status, category: categories[0]?.name || "" });
    setShowModal(true);
  }

  function addFileLink() {
    setFileLinks([...fileLinks, ""]);
  }
  function updateFileLink(index, value) {
    const updated = [...fileLinks];
    updated[index] = value;
    setFileLinks(updated);
  }
  function removeFileLink(index) {
    setFileLinks(fileLinks.filter((_, i) => i !== index));
  }

  const filtered = tasks.filter((t) => {
    if (filterCat !== "All" && t.category !== filterCat) return false;
    if (filterAssignee !== "All" && t.assignee_id !== filterAssignee)
      return false;
    return true;
  });

  const byStatus = (status) => filtered.filter((t) => t.status === status);

  const getCatColor = (catName) => {
    const cat = categories.find((c) => c.name === catName);
    return cat ? cat.color : "#6B7280";
  };

  const getCatIcon = (catName) => {
    const cat = categories.find((c) => c.name === catName);
    return cat ? cat.icon : "📁";
  };

  const getFileIcon = (url) => {
    if (!url) return "📄";
    const lower = url.toLowerCase();
    if (
      lower.includes("sheet") ||
      lower.includes("xlsx") ||
      lower.includes("csv")
    )
      return "📊";
    if (lower.includes("doc") || lower.includes("word")) return "📝";
    if (lower.includes("pdf")) return "📕";
    if (lower.includes("slide") || lower.includes("ppt")) return "📑";
    if (lower.includes("drive.google")) return "📁";
    if (
      lower.includes("image") ||
      lower.includes("jpg") ||
      lower.includes("png")
    )
      return "🖼";
    return "🔗";
  };

  if (loading)
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading board...</p>
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

      {/* Filters */}
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
        <button
          className={`filter-pill${filterCat === "All" ? " active" : ""}`}
          onClick={() => setFilterCat("All")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`filter-pill${filterCat === c.name ? " active" : ""}`}
            onClick={() => setFilterCat(c.name)}
          >
            {c.icon} {c.name}
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

      {/* Kanban Board */}
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
                onOpen={() => openDetail(task)}
                onStatusChange={(s) => updateStatus(task.id, s)}
                onArchive={() => archiveTask(task.id)}
                statuses={STATUSES}
                getCatColor={getCatColor}
                getCatIcon={getCatIcon}
              />
            ))}
            <button className="add-task-btn" onClick={() => openNew(status)}>
              + Add task
            </button>
          </div>
        ))}
      </div>

      {/* ── TASK DETAIL MODAL ── */}
      {showDetailModal && selectedTask && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowDetailModal(false)
          }
        >
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div style={{ flex: 1 }}>
                <h2 className="modal-title">{selectedTask.title}</h2>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className={`badge badge-${selectedTask.priority?.toLowerCase()}`}
                  >
                    {selectedTask.priority}
                  </span>
                  <span
                    className={`badge badge-${selectedTask.status
                      ?.replace(/ /g, "")
                      .toLowerCase()}`}
                  >
                    {selectedTask.status}
                  </span>
                  {selectedTask.category && (
                    <span
                      className="badge"
                      style={{
                        background: getCatColor(selectedTask.category) + "22",
                        color: getCatColor(selectedTask.category),
                      }}
                    >
                      {getCatIcon(selectedTask.category)}{" "}
                      {selectedTask.category}
                    </span>
                  )}
                  {selectedTask.task_type === "Recurring" && (
                    <span className="badge badge-recurring">
                      ⟳ {selectedTask.recurrence}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => openEdit(selectedTask)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="modal-close"
                  onClick={() => setShowDetailModal(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              {["details", "subtasks", "comments", "files"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 700 : 400,
                    fontFamily: "var(--font)",
                    color:
                      activeTab === tab
                        ? "var(--primary)"
                        : "var(--text-secondary)",
                    borderBottom:
                      activeTab === tab
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                    textTransform: "capitalize",
                  }}
                >
                  {tab}
                  {tab === "comments" && comments.length > 0 && (
                    <span
                      style={{
                        marginLeft: 5,
                        background: "var(--primary)",
                        color: "#fff",
                        borderRadius: 20,
                        padding: "1px 6px",
                        fontSize: 10,
                      }}
                    >
                      {comments.length}
                    </span>
                  )}
                  {tab === "subtasks" && subtasks.length > 0 && (
                    <span
                      style={{
                        marginLeft: 5,
                        background: "var(--success)",
                        color: "#fff",
                        borderRadius: 20,
                        padding: "1px 6px",
                        fontSize: 10,
                      }}
                    >
                      {subtasks.filter((s) => s.completed).length}/
                      {subtasks.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* DETAILS TAB */}
            {activeTab === "details" && (
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 14,
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
                      Assigned to
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {selectedTask.assignee ? (
                        <>
                          <div
                            className="avatar"
                            style={{
                              background: getColor(
                                selectedTask.assignee.full_name
                              ),
                              width: 22,
                              height: 22,
                              fontSize: 9,
                            }}
                          >
                            {getInitials(selectedTask.assignee.full_name)}
                          </div>
                          {selectedTask.assignee.full_name}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
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
                      Due date
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {selectedTask.due_date || "—"}
                    </div>
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
                      Tags
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {selectedTask.tags || "—"}
                    </div>
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
                      Blocked by
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {selectedTask.blocked_by_task ? (
                        <span className="dep-tag">
                          ⛔ {selectedTask.blocked_by_task.title}
                        </span>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
                {selectedTask.description && (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Description
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-primary)",
                        lineHeight: 1.6,
                        background: "var(--bg)",
                        padding: "10px 12px",
                        borderRadius: 8,
                      }}
                    >
                      {selectedTask.description}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => openEdit(selectedTask)}
                  >
                    ✏️ Edit task
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12 }}
                    onClick={() => archiveTask(selectedTask.id)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            )}

            {/* SUBTASKS TAB */}
            {activeTab === "subtasks" && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  {subtasks.length === 0 ? (
                    <p
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      No subtasks yet. Add your first one below.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      {subtasks.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            background: "var(--bg)",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={s.completed}
                            onChange={() => toggleSubtask(s.id, s.completed)}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: "pointer",
                              accentColor: "var(--primary)",
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: "var(--text-primary)",
                              textDecoration: s.completed
                                ? "line-through"
                                : "none",
                              opacity: s.completed ? 0.5 : 1,
                            }}
                          >
                            {s.title}
                          </span>
                          <button
                            onClick={() => deleteSubtask(s.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-tertiary)",
                              fontSize: 14,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {subtasks.length > 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 12,
                      }}
                    >
                      {subtasks.filter((s) => s.completed).length} of{" "}
                      {subtasks.length} completed
                      <div
                        style={{
                          height: 4,
                          background: "var(--border)",
                          borderRadius: 2,
                          overflow: "hidden",
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${
                              (subtasks.filter((s) => s.completed).length /
                                subtasks.length) *
                              100
                            }%`,
                            height: "100%",
                            background: "var(--success)",
                            borderRadius: 2,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="form-input"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Add a subtask..."
                      onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                    />
                    <button className="btn btn-primary" onClick={addSubtask}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* COMMENTS TAB */}
            {activeTab === "comments" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 14,
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  {comments.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                      No comments yet. Be the first to comment.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} style={{ display: "flex", gap: 10 }}>
                        <div
                          className="avatar"
                          style={{
                            background: getColor(c.author?.full_name || ""),
                            width: 28,
                            height: 28,
                            fontSize: 10,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(c.author?.full_name || "?")}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            background: "var(--bg)",
                            borderRadius: 8,
                            padding: "8px 12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {c.author?.full_name || "Unknown"}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-tertiary)",
                                }}
                              >
                                {new Date(c.created_at).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                              {(c.author_id === profile?.id ||
                                profile?.role === "admin") && (
                                <button
                                  onClick={() => deleteComment(c.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-tertiary)",
                                    fontSize: 12,
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "var(--text-primary)",
                              lineHeight: 1.5,
                            }}
                          >
                            {c.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    onKeyDown={(e) => e.key === "Enter" && addComment()}
                  />
                  <button className="btn btn-primary" onClick={addComment}>
                    Post
                  </button>
                </div>
              </div>
            )}

            {/* FILES TAB */}
            {activeTab === "files" && (
              <div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 12,
                  }}
                >
                  Paste links to Google Drive files, Sheets, Docs, PDFs, or any
                  other document URL.
                </p>
                {selectedTask.drive_link && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      background: "var(--bg)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>
                      {getFileIcon(selectedTask.drive_link)}
                    </span>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        Primary Drive Link
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {selectedTask.drive_link}
                      </div>
                    </div>
                    <a
                      href={selectedTask.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      Open
                    </a>
                  </div>
                )}
                {selectedTask.file_urls &&
                  JSON.parse(selectedTask.file_urls).map(
                    (url, i) =>
                      url && (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            background: "var(--bg)",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {getFileIcon(url)}
                          </span>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {url.includes("sheet") || url.includes("xlsx")
                                ? "Spreadsheet"
                                : url.includes("doc") || url.includes("word")
                                ? "Document"
                                : url.includes("pdf")
                                ? "PDF"
                                : url.includes("slide") || url.includes("ppt")
                                ? "Presentation"
                                : "File"}{" "}
                              {i + 1}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {url}
                            </div>
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                          >
                            Open
                          </a>
                        </div>
                      )
                  )}
                {!selectedTask.drive_link &&
                  (!selectedTask.file_urls ||
                    JSON.parse(selectedTask.file_urls).filter(Boolean)
                      .length === 0) && (
                    <div className="empty-state">
                      <p>No files attached. Edit the task to add file links.</p>
                    </div>
                  )}
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 8, fontSize: 12 }}
                  onClick={() => openEdit(selectedTask)}
                >
                  ✏️ Add or edit file links
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT TASK MODAL ── */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal" style={{ maxWidth: 600 }}>
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
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.icon} {c.name}
                      </option>
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

              {/* File links */}
              <div className="form-group">
                <label className="form-label">
                  File links (Google Drive, Sheets, Docs, PDFs, etc.)
                </label>
                {fileLinks.map((link, index) => (
                  <div
                    key={index}
                    style={{ display: "flex", gap: 8, marginBottom: 6 }}
                  >
                    <input
                      className="form-input"
                      value={link}
                      onChange={(e) => updateFileLink(index, e.target.value)}
                      placeholder="Paste any file or document URL..."
                    />
                    {fileLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFileLink(index)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "0 10px",
                          cursor: "pointer",
                          color: "var(--danger)",
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, marginTop: 4 }}
                  onClick={addFileLink}
                >
                  + Add another file link
                </button>
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editTask
                    ? "Save changes"
                    : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onOpen,
  onStatusChange,
  onArchive,
  statuses,
  getCatColor,
  getCatIcon,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const name = task.assignee?.full_name || "";
  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "Done";

  return (
    <div className="task-card" onClick={onOpen}>
      <div className="task-card-title">{task.title}</div>
      <div
        style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}
      >
        <span className={`badge badge-${task.priority?.toLowerCase()}`}>
          {task.priority}
        </span>
        {task.category && (
          <span
            className="badge"
            style={{
              background: getCatColor(task.category) + "22",
              color: getCatColor(task.category),
              border: `1px solid ${getCatColor(task.category)}44`,
            }}
          >
            {getCatIcon(task.category)} {task.category}
          </span>
        )}
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
          {task.drive_link && <span style={{ fontSize: 10 }}>📎</span>}
          {task.file_urls &&
            JSON.parse(task.file_urls).filter(Boolean).length > 0 && (
              <span style={{ fontSize: 10, color: "var(--info)" }}>
                📁 {JSON.parse(task.file_urls).filter(Boolean).length}
              </span>
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
