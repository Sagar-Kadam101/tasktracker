// src/pages/PersonalList.js
// Private personal task list. Each user sees only their own — including admins.
// Strictly separate from team tasks. Never appears in team reports.
//
// Features:
//   - Inline editable grid (Google Sheets style, auto-save on blur)
//   - Start date (optional) + End date columns
//   - Priority dropdown, tags, status checkbox
//   - "Promote to team task" button — converts personal task into team task
//   - Stats strip + filter tabs (Active / Completed / All)

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function PersonalList({ profile }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("active");
  const [rowSaveStatus, setRowSaveStatus] = useState({});
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // Promote-to-team modal state
  const [promoteItem, setPromoteItem] = useState(null);
  const [promoteForm, setPromoteForm] = useState(null);
  const [promoteSaving, setPromoteSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetchItems();
    fetchMeta();
    // eslint-disable-next-line
  }, [profile?.id]);

  async function fetchItems() {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("personal_tasks")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    else setItems(data || []);
    setLoading(false);
  }

  async function fetchMeta() {
    const [mRes, cRes, pRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role"),
      supabase.from("categories").select("*"),
      supabase
        .from("projects")
        .select("id, name, status")
        .eq("status", "Active"),
    ]);
    setMembers(mRes.data || []);
    setCategories(cRes.data || []);
    setProjects(pRes.data || []);
  }

  async function saveCell(itemId, field, value) {
    const current = items.find((i) => i.id === itemId);
    if (current && current[field] === value) return;

    setRowSaveStatus((s) => ({ ...s, [itemId]: "saving" }));
    const updates = { [field]: value === "" ? null : value };

    if (field === "status") {
      if (value === "Done") updates.completed_at = new Date().toISOString();
      else updates.completed_at = null;
    }

    const { error } = await supabase
      .from("personal_tasks")
      .update(updates)
      .eq("id", itemId);

    if (error) {
      console.error(error);
      setRowSaveStatus((s) => ({ ...s, [itemId]: "error" }));
      showToast("Save failed: " + error.message, "warn");
      return;
    }
    setRowSaveStatus((s) => ({ ...s, [itemId]: "saved" }));
    setTimeout(() => {
      setRowSaveStatus((s) => {
        const next = { ...s };
        if (next[itemId] === "saved") delete next[itemId];
        return next;
      });
    }, 1500);

    setItems((arr) =>
      arr.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
  }

  async function toggleDone(itemId, isDone) {
    await saveCell(itemId, "status", isDone ? "Done" : "To Do");
  }

  async function addNewItem() {
    setAdding(true);
    const payload = {
      user_id: profile.id,
      title: "Untitled",
      status: "To Do",
      priority: "Medium",
    };
    const { data, error } = await supabase
      .from("personal_tasks")
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error(error);
      showToast("Could not add: " + error.message, "warn");
    } else {
      setItems((arr) => [...arr, data]);
      setTimeout(() => {
        const el = document.getElementById("pl-title-" + data.id);
        if (el) {
          el.focus();
          el.select();
        }
      }, 50);
    }
    setAdding(false);
  }

  async function deleteItem(itemId) {
    if (!window.confirm("Delete this personal task?")) return;
    const { error } = await supabase
      .from("personal_tasks")
      .delete()
      .eq("id", itemId);
    if (error) {
      showToast("Delete failed: " + error.message, "warn");
    } else {
      setItems((arr) => arr.filter((i) => i.id !== itemId));
      showToast("Deleted");
    }
  }

  // ═════════════════════════════════════════════
  //  PROMOTE TO TEAM TASK
  // ═════════════════════════════════════════════
  function openPromote(item) {
    setPromoteItem(item);
    setPromoteForm({
      assignee_id: profile.id, // Default: delegate to self
      reviewer_id: "",
      project_id: "",
      category: "",
      visibility: "public",
    });
  }

  async function handlePromote(e) {
    e.preventDefault();
    if (!promoteItem || !promoteForm) return;
    setPromoteSaving(true);

    // Create the team task with personal task's data + promote form selections
    const teamPayload = {
      title: promoteItem.title,
      description: promoteItem.notes || null,
      assignee_id: promoteForm.assignee_id || null,
      reviewer_id: promoteForm.reviewer_id || null,
      project_id: promoteForm.project_id || null,
      category: promoteForm.category || null,
      priority: promoteItem.priority || "Medium",
      status: promoteItem.status || "To Do",
      start_date: promoteItem.start_date || null,
      due_date: promoteItem.due_date || null,
      tags: promoteItem.tags || null,
      visibility: promoteForm.visibility || "public",
      task_type: "One-time",
      recurrence: "None",
      created_by: profile.id,
      archived: false,
    };

    const { error: insertError } = await supabase
      .from("tasks")
      .insert(teamPayload);

    if (insertError) {
      console.error(insertError);
      showToast("Promote failed: " + insertError.message, "warn");
      setPromoteSaving(false);
      return;
    }

    // Delete the personal task — it's now a team task
    const { error: deleteError } = await supabase
      .from("personal_tasks")
      .delete()
      .eq("id", promoteItem.id);

    if (deleteError) {
      console.error(deleteError);
      showToast(
        "Team task created, but personal task could not be deleted. Delete it manually.",
        "warn"
      );
    } else {
      setItems((arr) => arr.filter((i) => i.id !== promoteItem.id));
      const assigneeName =
        promoteForm.assignee_id === profile.id
          ? "yourself"
          : members.find((m) => m.id === promoteForm.assignee_id)?.full_name ||
            "team";
      showToast(`✓ Promoted to team task — assigned to ${assigneeName}`);
    }
    setPromoteItem(null);
    setPromoteForm(null);
    setPromoteSaving(false);
  }

  // ═════════════════════════════════════════════
  //  DERIVED STATE
  // ═════════════════════════════════════════════
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  const dayOfWeek = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
  weekStart.setDate(weekStart.getDate() - dayOfWeek);

  const stats = {
    open: items.filter((i) => i.status !== "Done").length,
    overdue: items.filter(
      (i) => i.due_date && new Date(i.due_date) < today && i.status !== "Done"
    ).length,
    weekDone: items.filter(
      (i) =>
        i.status === "Done" &&
        i.completed_at &&
        new Date(i.completed_at) >= weekStart
    ).length,
  };

  const filtered = items.filter((i) => {
    if (filter === "active") return i.status !== "Done";
    if (filter === "completed") return i.status === "Done";
    return true;
  });

  const firstName = profile?.full_name?.split(" ")[0] || "you";

  // ═════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════
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
          <h1 className="page-title">My List</h1>
          <p
            className="page-sub"
            style={{ fontStyle: "italic", color: "var(--text-secondary)" }}
          >
            Private tasks just for {firstName}. Hidden from team reports.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={addNewItem}
          disabled={adding}
        >
          {adding ? "Adding..." : "+ New item"}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--primary)" }}>
            {stats.open}
          </div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: stats.overdue > 0 ? "var(--danger)" : "inherit" }}
          >
            {stats.overdue}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {stats.weekDone}
          </div>
          <div className="stat-label">Done this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{items.length}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 4, marginBottom: 16, fontSize: 12.5 }}
      >
        {[
          { id: "active", label: "Active", count: stats.open },
          {
            id: "completed",
            label: "Completed",
            count: items.filter((i) => i.status === "Done").length,
          },
          { id: "all", label: "All", count: items.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`filter-dropdown-btn${
              filter === tab.id ? " has-value" : ""
            }`}
          >
            {tab.label}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                marginLeft: 6,
                opacity: 0.7,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="card"
          style={{
            padding: 30,
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            {filter === "active"
              ? "Nothing on your personal list right now. Add something only you'll see."
              : filter === "completed"
              ? "No completed personal tasks yet."
              : "Your personal list is empty."}
          </p>
          {filter !== "completed" && (
            <button
              className="btn btn-primary"
              onClick={addNewItem}
              disabled={adding}
            >
              + Add your first item
            </button>
          )}
        </div>
      ) : (
        <div
          className="card"
          style={{ padding: 0, overflowX: "auto", overflowY: "visible" }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 900,
              borderCollapse: "collapse",
              fontSize: 13,
              fontFamily: "var(--font)",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--bg-soft)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {[
                  { label: "", width: 40 },
                  { label: "Title", width: 250 },
                  { label: "Priority", width: 100 },
                  { label: "Start", width: 130 },
                  { label: "End", width: 130 },
                  { label: "Tags", width: 140 },
                  { label: "", width: 140 },
                ].map((c, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      width: c.width,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const overdue =
                  item.due_date &&
                  new Date(item.due_date) < today &&
                  item.status !== "Done";
                const done = item.status === "Done";
                const savingState = rowSaveStatus[item.id];

                const cellStyle = {
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--border)",
                  verticalAlign: "middle",
                };
                const inputBase = {
                  border: "1px solid transparent",
                  background: "transparent",
                  padding: "5px 8px",
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: "var(--font)",
                  color: done ? "var(--text-tertiary)" : "var(--text-primary)",
                  width: "100%",
                  outline: "none",
                  textDecoration: done ? "line-through" : "none",
                };
                const inputFocus = {
                  borderColor: "var(--primary)",
                  background: "var(--bg-card)",
                };

                return (
                  <tr
                    key={item.id}
                    style={{
                      background:
                        savingState === "saving"
                          ? "rgba(91, 76, 245, 0.04)"
                          : savingState === "error"
                          ? "rgba(220, 38, 38, 0.04)"
                          : "transparent",
                      transition: "background 0.2s",
                      opacity: done ? 0.65 : 1,
                    }}
                  >
                    <td style={cellStyle}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => toggleDone(item.id, e.target.checked)}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: "pointer",
                          accentColor: "var(--success)",
                        }}
                      />
                    </td>

                    <td style={cellStyle}>
                      <input
                        id={"pl-title-" + item.id}
                        type="text"
                        defaultValue={item.title}
                        style={inputBase}
                        onFocus={(e) =>
                          Object.assign(e.target.style, inputFocus)
                        }
                        onBlur={(e) => {
                          e.target.style.border = "1px solid transparent";
                          e.target.style.background = "transparent";
                          if (e.target.value !== item.title)
                            saveCell(item.id, "title", e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.target.blur();
                          if (e.key === "Escape") {
                            e.target.value = item.title;
                            e.target.blur();
                          }
                        }}
                      />
                    </td>

                    <td style={cellStyle}>
                      <select
                        value={item.priority || "Medium"}
                        onChange={(e) =>
                          saveCell(item.id, "priority", e.target.value)
                        }
                        style={{
                          ...inputBase,
                          cursor: "pointer",
                          appearance: "none",
                          color:
                            item.priority === "High"
                              ? "var(--danger)"
                              : item.priority === "Low"
                              ? "var(--text-tertiary)"
                              : "var(--text-primary)",
                          fontWeight: item.priority === "High" ? 600 : 400,
                        }}
                        onFocus={(e) =>
                          Object.assign(e.target.style, inputFocus)
                        }
                        onBlur={(e) => {
                          e.target.style.border = "1px solid transparent";
                          e.target.style.background = "transparent";
                        }}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </td>

                    {/* Start date */}
                    <td style={cellStyle}>
                      <input
                        type="date"
                        defaultValue={item.start_date || ""}
                        style={inputBase}
                        onFocus={(e) =>
                          Object.assign(e.target.style, inputFocus)
                        }
                        onBlur={(e) => {
                          e.target.style.border = "1px solid transparent";
                          e.target.style.background = "transparent";
                          if (e.target.value !== (item.start_date || ""))
                            saveCell(item.id, "start_date", e.target.value);
                        }}
                      />
                    </td>

                    {/* End date (renamed from Due) */}
                    <td style={cellStyle}>
                      <input
                        type="date"
                        defaultValue={item.due_date || ""}
                        style={{
                          ...inputBase,
                          color: overdue
                            ? "var(--danger)"
                            : done
                            ? "var(--text-tertiary)"
                            : "var(--text-primary)",
                          fontWeight: overdue ? 600 : 400,
                        }}
                        onFocus={(e) =>
                          Object.assign(e.target.style, inputFocus)
                        }
                        onBlur={(e) => {
                          e.target.style.border = "1px solid transparent";
                          e.target.style.background = "transparent";
                          if (e.target.value !== (item.due_date || ""))
                            saveCell(item.id, "due_date", e.target.value);
                        }}
                      />
                    </td>

                    <td style={cellStyle}>
                      <input
                        type="text"
                        defaultValue={item.tags || ""}
                        placeholder="comma, separated"
                        style={inputBase}
                        onFocus={(e) =>
                          Object.assign(e.target.style, inputFocus)
                        }
                        onBlur={(e) => {
                          e.target.style.border = "1px solid transparent";
                          e.target.style.background = "transparent";
                          if (e.target.value !== (item.tags || ""))
                            saveCell(item.id, "tags", e.target.value);
                        }}
                      />
                    </td>

                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {savingState === "saving" && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--primary)",
                            marginRight: 6,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          Saving…
                        </span>
                      )}
                      {savingState === "saved" && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--success)",
                            marginRight: 6,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          ✓
                        </span>
                      )}
                      <button
                        onClick={() => openPromote(item)}
                        title="Promote to team task — delegate to yourself or someone else"
                        style={{
                          background:
                            "var(--primary-light, rgba(91, 76, 245, 0.10))",
                          border: "1px solid var(--primary)",
                          borderRadius: 5,
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--primary)",
                          fontWeight: 600,
                          marginRight: 4,
                        }}
                      >
                        ↗ Promote
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        title="Delete"
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: 5,
                          padding: "3px 7px",
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--danger)",
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-soft)",
            }}
          >
            <button
              onClick={addNewItem}
              disabled={adding}
              style={{
                background: "none",
                border: "1px dashed var(--border-strong)",
                borderRadius: 6,
                padding: "6px 14px",
                cursor: adding ? "wait" : "pointer",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--primary)",
                fontFamily: "var(--font)",
              }}
            >
              {adding ? "Adding…" : "+ Add row"}
            </button>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginLeft: 10,
              }}
            >
              Edits save automatically. Only you can see this list.
            </span>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════
          PROMOTE-TO-TEAM MODAL
          ═════════════════════════════════════════════ */}
      {promoteItem && promoteForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPromoteItem(null);
              setPromoteForm(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2 className="modal-title">↗ Promote to team task</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setPromoteItem(null);
                  setPromoteForm(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePromote}>
              <div className="modal-body">
                <div
                  style={{
                    background: "var(--bg-soft)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginBottom: 14,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Converting
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {promoteItem.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      marginTop: 4,
                    }}
                  >
                    Personal task data (priority, dates, tags) will carry over.
                    Once promoted, this leaves your personal list.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign to</label>
                  <select
                    className="form-select"
                    value={promoteForm.assignee_id}
                    onChange={(e) =>
                      setPromoteForm({
                        ...promoteForm,
                        assignee_id: e.target.value,
                      })
                    }
                  >
                    <option value={profile.id}>
                      Myself ({profile.full_name})
                    </option>
                    {members
                      .filter((m) => m.id !== profile.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reviewer (optional)</label>
                  <select
                    className="form-select"
                    value={promoteForm.reviewer_id}
                    onChange={(e) =>
                      setPromoteForm({
                        ...promoteForm,
                        reviewer_id: e.target.value,
                      })
                    }
                  >
                    <option value="">— No reviewer —</option>
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
                    <label className="form-label">Project (optional)</label>
                    <select
                      className="form-select"
                      value={promoteForm.project_id}
                      onChange={(e) =>
                        setPromoteForm({
                          ...promoteForm,
                          project_id: e.target.value,
                        })
                      }
                    >
                      <option value="">— No project —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={promoteForm.category}
                      onChange={(e) =>
                        setPromoteForm({
                          ...promoteForm,
                          category: e.target.value,
                        })
                      }
                    >
                      <option value="">— None —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Visibility</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["public", "private"].map((v) => (
                      <label
                        key={v}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 12px",
                          border: `2px solid ${
                            promoteForm.visibility === v
                              ? "var(--primary)"
                              : "var(--border)"
                          }`,
                          borderRadius: 8,
                          cursor: "pointer",
                          background:
                            promoteForm.visibility === v
                              ? "var(--primary-light, rgba(91, 76, 245, 0.08))"
                              : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name="promote-visibility"
                          value={v}
                          checked={promoteForm.visibility === v}
                          onChange={(e) =>
                            setPromoteForm({
                              ...promoteForm,
                              visibility: e.target.value,
                            })
                          }
                        />
                        <span style={{ fontSize: 13 }}>
                          <strong>
                            {v === "public" ? "🌐 Public" : "🔒 Private"}
                          </strong>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-tertiary)",
                              marginTop: 2,
                            }}
                          >
                            {v === "public"
                              ? "Everyone in the team sees it"
                              : "Only assignee, reviewer & admin see it"}
                          </div>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setPromoteItem(null);
                    setPromoteForm(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={promoteSaving}
                >
                  {promoteSaving ? "Promoting..." : "Promote to team task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
