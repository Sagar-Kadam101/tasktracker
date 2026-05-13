import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ICONS = [
  "📁",
  "⚙️",
  "🎨",
  "💰",
  "📣",
  "🔧",
  "📊",
  "🏆",
  "🚀",
  "💡",
  "🔥",
  "⭐",
  "🎯",
  "📱",
  "🖥️",
  "📝",
  "🤝",
  "🏗️",
  "🎪",
  "🔬",
];
const COLORS = [
  "#0369A1",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#6B7280",
  "#5B4CF5",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#065F46",
];

export default function AdminPanel({ profile }) {
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [msg, setMsg] = useState("");
  const [catMsg, setCatMsg] = useState("");
  const [settings, setSettings] = useState({
    workspace_name: "TaskFlow",
    primary_color: "#5B4CF5",
  });
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({
    name: "",
    color: "#0369A1",
    icon: "📁",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [{ data: m }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("categories").select("*").order("created_at"),
      supabase.from("settings").select("*").eq("key", "workspace").single(),
    ]);
    setMembers(m || []);
    setCategories(c || []);
    if (s) setSettings(JSON.parse(s.value));
  }

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

  function openNewCat() {
    setEditCat(null);
    setCatForm({ name: "", color: "#0369A1", icon: "📁" });
    setShowCatModal(true);
  }

  function openEditCat(cat) {
    setEditCat(cat);
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon });
    setShowCatModal(true);
  }

  async function saveCat() {
    if (!catForm.name.trim()) {
      setCatMsg("Name is required");
      return;
    }
    if (editCat) {
      const { error } = await supabase
        .from("categories")
        .update({
          name: catForm.name.trim(),
          color: catForm.color,
          icon: catForm.icon,
        })
        .eq("id", editCat.id);
      if (error) {
        setCatMsg("Error: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("categories").insert({
        name: catForm.name.trim(),
        color: catForm.color,
        icon: catForm.icon,
      });
      if (error) {
        setCatMsg("Error: " + error.message);
        return;
      }
    }
    setShowCatModal(false);
    setCatMsg("");
    fetchAll();
  }

  async function deleteCat(catId) {
    await supabase.from("categories").delete().eq("id", catId);
    setDeleteConfirm(null);
    fetchAll();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-sub">Manage workspace, categories, and team</p>
        </div>
      </div>

      {/* Appearance */}
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
              {COLORS.map((c) => (
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

      {/* Category Manager */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            🗂 Task Categories ({categories.length})
          </div>
          <button className="btn btn-primary" onClick={openNewCat}>
            + Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">
            <p>No categories yet. Add your first one!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--bg)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: cat.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {cat.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {cat.color}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => openEditCat(cat)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => setDeleteConfirm(cat)}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Members */}
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
          💡 Share your app URL with team members. They sign in with Google and
          appear here automatically.
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      {showCatModal && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowCatModal(false)
          }
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editCat ? "Edit Category" : "New Category"}
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowCatModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Category name *</label>
              <input
                className="form-input"
                value={catForm.name}
                onChange={(e) =>
                  setCatForm({ ...catForm, name: e.target.value })
                }
                placeholder="e.g. Legal, HR, Sales, Product..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Colour</label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setCatForm({ ...catForm, color: c })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c,
                      cursor: "pointer",
                      border:
                        catForm.color === c
                          ? "3px solid #1E1B4B"
                          : "2px solid transparent",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) =>
                    setCatForm({ ...catForm, color: e.target.value })
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

            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ICONS.map((icon) => (
                  <div
                    key={icon}
                    onClick={() => setCatForm({ ...catForm, icon })}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      cursor: "pointer",
                      background:
                        catForm.icon === icon
                          ? "var(--primary-light)"
                          : "var(--bg)",
                      border:
                        catForm.icon === icon
                          ? "2px solid var(--primary)"
                          : "1px solid var(--border)",
                    }}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              style={{
                background: "var(--bg)",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: catForm.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                {catForm.icon}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {catForm.name || "Category name preview"}
              </div>
            </div>

            {catMsg && (
              <div
                style={{
                  color: "var(--danger)",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {catMsg}
              </div>
            )}

            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setShowCatModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveCat}>
                {editCat ? "Save changes" : "Create category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setDeleteConfirm(null)
          }
        >
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete category?</h2>
              <button
                className="modal-close"
                onClick={() => setDeleteConfirm(null)}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 16,
              }}
            >
              Are you sure you want to delete{" "}
              <strong>{deleteConfirm.name}</strong>? Tasks using this category
              will not be deleted but will lose their category label.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteCat(deleteConfirm.id)}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
