// src/pages/Archive.js — drop-in replacement
// Changes vs previous version:
//   1. Accepts `profile` prop so we know if user is admin/creator (for delete)
//   2. Fetches categories dynamically (was hardcoded — broke when admin added new ones)
//   3. Admin/creator-only "🗑" delete button per row
//   4. Per-row "Restore" button to un-archive a task (sends it back to the Board)

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Archive({ profile }) {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [tRes, cRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)")
        .eq("archived", true)
        .order("completed_at", { ascending: false }),
      supabase.from("categories").select("*").order("created_at"),
    ]);
    setTasks(tRes.data || []);
    setCategories(cRes.data || []);
  }

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function canDeleteTask(task) {
    if (!task || !profile) return false;
    return profile.role === "admin" || task.created_by === profile.id;
  }

  async function deleteTask(task) {
    if (!canDeleteTask(task)) {
      showToast("⚠ You don't have permission to delete this task.", "warn");
      return;
    }
    const ok = window.confirm(
      `Delete "${task.title}" permanently?\n\nThis cannot be undone. All comments, subtasks, and history will also be deleted.`
    );
    if (!ok) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      console.error(error);
      showToast("⚠ Delete failed: " + error.message, "warn");
      return;
    }
    setTasks((arr) => arr.filter((t) => t.id !== task.id));
    showToast("✓ Task deleted permanently");
  }

  async function restoreTask(task) {
    const ok = window.confirm(
      `Restore "${task.title}" back to the active Board?`
    );
    if (!ok) return;
    const { error } = await supabase
      .from("tasks")
      .update({ archived: false, completed_at: null })
      .eq("id", task.id);
    if (error) {
      console.error(error);
      showToast("⚠ Restore failed: " + error.message, "warn");
      return;
    }
    setTasks((arr) => arr.filter((t) => t.id !== task.id));
    showToast("✓ Task restored to Board");
  }

  const filtered = tasks.filter((t) => {
    if (filterCat !== "All" && t.category !== filterCat) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  function exportCSV() {
    const rows = [
      ["Task", "Category", "Assignee", "Due Date", "Completed", "Priority"],
    ];
    filtered.forEach((t) =>
      rows.push([
        t.title,
        t.category,
        t.assignee?.full_name || "",
        t.due_date || "",
        t.completed_at?.slice(0, 10) || "",
        t.priority,
      ])
    );
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `taskflow-archive-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background:
              toast.type === "warn" ? "var(--danger)" : "var(--text-primary)",
            color: "white",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 360,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Archive</h1>
          <p className="page-sub">
            {tasks.length} completed tasks — searchable forever
          </p>
        </div>
        <button className="btn btn-ghost" onClick={exportCSV}>
          ⬇ Export CSV
        </button>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}
      >
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search by task name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-bar">
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
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>
              {search ? "No tasks match your search" : "No archived tasks yet"}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Category</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Completed</th>
                <th>Priority</th>
                <th>Files</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td>
                    <span
                      className={`badge badge-${t.category?.toLowerCase()}`}
                    >
                      {t.category || "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {t.assignee?.full_name || "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t.due_date || "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--success)" }}>
                    {t.completed_at?.slice(0, 10) || "—"}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${t.priority?.toLowerCase()}`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    {t.drive_link ? (
                      <a
                        href={t.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "var(--info)" }}
                      >
                        📎 View
                      </a>
                    ) : (
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontSize: 12,
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => restoreTask(t)}
                      title="Restore — send back to the Board"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        borderRadius: 5,
                        padding: "3px 8px",
                        cursor: "pointer",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginRight: 4,
                      }}
                    >
                      ↩ Restore
                    </button>
                    {canDeleteTask(t) && (
                      <button
                        onClick={() => deleteTask(t)}
                        title="Permanently delete — admins and creator only"
                        style={{
                          background: "none",
                          border: "1px solid var(--danger)",
                          borderRadius: 5,
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--danger)",
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
