import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Archive() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)")
      .eq("archived", true)
      .order("completed_at", { ascending: false })
      .then(({ data }) => setTasks(data || []));
  }, []);

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
                      {t.category}
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
                        style={{ color: "var(--text-tertiary)", fontSize: 12 }}
                      >
                        —
                      </span>
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
