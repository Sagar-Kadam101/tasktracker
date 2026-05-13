import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard({ profile }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .then(({ data }) => setTasks(data || []));
  }, []);

  const now = new Date();
  const myTasks = tasks.filter((t) => t.assignee_id === profile?.id);
  const overdue = tasks.filter(
    (t) => t.status !== "Done" && t.due_date && new Date(t.due_date) < now
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            👋 Welcome, {profile?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="page-sub">Here's what's happening today</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Total tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#16A34A" }}>
            {tasks.filter((t) => t.status === "Done").length}
          </div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "#DC2626" }}>
            {overdue.length}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{myTasks.length}</div>
          <div className="stat-label">Assigned to me</div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">My tasks</div>
        {myTasks.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            No tasks assigned to you yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {myTasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                  <td>
                    <span
                      className={`badge badge-${t.status
                        ?.replace(/ /g, "")
                        .toLowerCase()}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${t.priority?.toLowerCase()}`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                      color:
                        t.due_date &&
                        new Date(t.due_date) < now &&
                        t.status !== "Done"
                          ? "var(--danger)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {t.due_date || "—"}
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
