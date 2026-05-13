import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminPanel({ profile }) {
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState({
    workspace_name: "TaskFlow",
    primary_color: "#5B4CF5",
  });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => setMembers(data || []));
    supabase
      .from("settings")
      .select("*")
      .eq("key", "workspace")
      .single()
      .then(({ data }) => {
        if (data) setSettings(JSON.parse(data.value));
      });
  }, []);

  if (profile?.role !== "admin")
    return (
      <div className="empty-state">
        <p>⛔ Admin access only</p>
      </div>
    );

  async function changeRole(userId, newRole) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
    );
  }

  async function saveSettings() {
    await supabase
      .from("settings")
      .upsert({ key: "workspace", value: JSON.stringify(settings) });
    document.documentElement.style.setProperty(
      "--primary",
      settings.primary_color
    );
    setMsg("Settings saved!");
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-sub">Manage workspace, team and appearance</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title">🎨 Appearance</div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <div className="form-group">
            <label className="form-label">Workspace name</label>
            <input
              className="form-input"
              value={settings.workspace_name}
              onChange={(e) =>
                setSettings({ ...settings, workspace_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Brand colour</label>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {[
                "#5B4CF5",
                "#1D9E75",
                "#D97706",
                "#DC2626",
                "#0369A1",
                "#7C3AED",
                "#DB2777",
              ].map((c) => (
                <div
                  key={c}
                  onClick={() => setSettings({ ...settings, primary_color: c })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: c,
                    cursor: "pointer",
                    border:
                      settings.primary_color === c
                        ? "3px solid #1E1B4B"
                        : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                />
              ))}
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) =>
                  setSettings({ ...settings, primary_color: e.target.value })
                }
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "50%",
                }}
                title="Custom colour"
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-primary" onClick={saveSettings}>
            Save appearance
          </button>
          {msg && (
            <span style={{ color: "#16A34A", fontSize: 13, fontWeight: 600 }}>
              {msg}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">👥 Team members ({members.length})</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Change role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.full_name || "—"}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {m.email || "—"}
                </td>
                <td>
                  <span
                    className={`badge ${
                      m.role === "admin" ? "badge-inprogress" : "badge-todo"
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td>
                  {m.id !== profile?.id && (
                    <select
                      className="form-select"
                      style={{ width: 120, padding: "4px 8px", fontSize: 12 }}
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: "var(--bg)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          💡 To invite new members: share your app URL with them. They sign in
          with Google and their profile is created automatically. Then set their
          role here.
        </div>
      </div>
    </div>
  );
}
