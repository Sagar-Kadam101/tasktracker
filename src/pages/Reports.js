import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = {
  Done: "#16A34A",
  "In Progress": "#0369A1",
  "In Review": "#D97706",
  "To Do": "#9CA3AF",
};
const PIE_COLORS = ["#5B4CF5", "#1D9E75", "#D97706", "#DC2626", "#6B7280"];

export default function Reports() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(id,full_name)"),
      supabase.from("profiles").select("id,full_name"),
    ]).then(([{ data: t }, { data: m }]) => {
      setTasks(t || []);
      setMembers(m || []);
    });
  }, []);

  const now = new Date();
  const active = tasks.filter((t) => !t.archived);
  const done = active.filter((t) => t.status === "Done");
  const overdue = active.filter(
    (t) => t.status !== "Done" && t.due_date && new Date(t.due_date) < now
  );
  const completionRate = active.length
    ? Math.round((done.length / active.length) * 100)
    : 0;

  const statusData = ["To Do", "In Progress", "In Review", "Done"].map((s) => ({
    name: s,
    count: active.filter((t) => t.status === s).length,
  }));

  const catData = [
    "Engineering",
    "Design",
    "Finance",
    "Marketing",
    "Operations",
  ].map((c) => ({
    name: c,
    count: active.filter((t) => t.category === c).length,
  }));

  const memberData = members
    .map((m) => {
      const myTasks = active.filter((t) => t.assignee_id === m.id);
      const myDone = myTasks.filter((t) => t.status === "Done");
      return {
        name: m.full_name?.split(" ")[0],
        total: myTasks.length,
        done: myDone.length,
        rate: myTasks.length
          ? Math.round((myDone.length / myTasks.length) * 100)
          : 0,
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  const delayData = overdue
    .map((t) => ({
      ...t,
      daysLate: Math.floor((now - new Date(t.due_date)) / 86400000),
    }))
    .sort((a, b) => b.daysLate - a.daysLate);

  // Tasks currently In Review where review TAT has been exceeded
  const overdueReviews = active
    .filter(
      (t) =>
        t.status === "In Review" &&
        t.review_started_at &&
        t.review_tat_days &&
        new Date(t.review_started_at).getTime() + t.review_tat_days * 86400000 <
          now.getTime()
    )
    .map((t) => {
      const dueMs =
        new Date(t.review_started_at).getTime() + t.review_tat_days * 86400000;
      const daysLate = Math.floor((now.getTime() - dueMs) / 86400000);
      const reviewer = members.find((m) => m.id === t.reviewer_id);
      return {
        ...t,
        daysLate,
        reviewerName: reviewer?.full_name || "Unknown",
      };
    })
    .sort((a, b) => b.daysLate - a.daysLate);

  function exportCSV() {
    const rows = [
      ["Task", "Category", "Assignee", "Due Date", "Status", "Days Late"],
    ];
    delayData.forEach((t) =>
      rows.push([
        t.title,
        t.category,
        t.assignee?.full_name || "",
        t.due_date || "",
        t.status,
        t.daysLate,
      ])
    );
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `taskflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Task completion and delay analysis</p>
        </div>
        <button className="btn btn-ghost" onClick={exportCSV}>
          ⬇ Export CSV
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{active.length}</div>
          <div className="stat-label">Total active tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#16A34A" }}>
            {done.length}
          </div>
          <div className="stat-label">Completed</div>
          <div className="stat-delta" style={{ color: "#16A34A" }}>
            {completionRate}% rate
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#DC2626" }}>
            {overdue.length}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: overdueReviews.length > 0 ? "#DC2626" : "inherit" }}
          >
            {overdueReviews.length}
          </div>
          <div className="stat-label">Overdue reviews</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{members.length}</div>
          <div className="stat-label">Team members</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div className="card">
          <div className="card-title">Tasks by status</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((d, i) => (
                  <Cell key={i} fill={COLORS[d.name] || "#6B7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">Tasks by category</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={catData.filter((c) => c.count > 0)}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
              >
                {catData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title">Team performance</div>
        {memberData.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            No task data yet
          </p>
        ) : (
          memberData.map((m) => (
            <div
              key={m.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 80,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  flexShrink: 0,
                }}
              >
                {m.name}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 8,
                    background: "var(--border)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${m.rate}%`,
                      height: "100%",
                      background:
                        m.rate >= 80
                          ? "#16A34A"
                          : m.rate >= 50
                          ? "#D97706"
                          : "#DC2626",
                      borderRadius: 4,
                    }}
                  ></div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  width: 40,
                  textAlign: "right",
                }}
              >
                {m.rate}%
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  width: 60,
                }}
              >
                {m.done}/{m.total} done
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            ⚠ Overdue tasks
          </div>
          <button
            className="btn btn-ghost"
            onClick={exportCSV}
            style={{ fontSize: 12 }}
          >
            Export
          </button>
        </div>
        {delayData.length === 0 ? (
          <div className="empty-state">
            <p>🎉 No overdue tasks! Great work.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Category</th>
                <th>Assignee</th>
                <th>Due date</th>
                <th>Days late</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {delayData.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td>
                    <span
                      className={`badge badge-${t.category?.toLowerCase()}`}
                    >
                      {t.category}
                    </span>
                  </td>
                  <td>{t.assignee?.full_name || "—"}</td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>
                    {t.due_date}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>
                    {t.daysLate}d
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.daysLate > 7
                          ? "badge-high"
                          : t.daysLate > 3
                          ? "badge-medium"
                          : "badge-low"
                      }`}
                    >
                      {t.daysLate > 7
                        ? "Critical"
                        : t.daysLate > 3
                        ? "Moderate"
                        : "Minor"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* OVERDUE REVIEWS SECTION */}
      <div className="card" style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            👁 Overdue reviews
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
            }}
          >
            Reviews that have exceeded their TAT
          </span>
        </div>
        {overdueReviews.length === 0 ? (
          <div className="empty-state">
            <p>✓ All reviews are within TAT.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Reviewer</th>
                <th>Review started</th>
                <th>TAT</th>
                <th>Days late</th>
              </tr>
            </thead>
            <tbody>
              {overdueReviews.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td>{t.assignee?.full_name || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{t.reviewerName}</td>
                  <td>
                    {new Date(t.review_started_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td>{t.review_tat_days}d</td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>
                    ⚠ {t.daysLate}d
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
