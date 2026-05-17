// src/pages/ProjectDetail.js
// Full project detail page with:
//   - Quick add (one task at a time)
//   - Bulk paste (multi-line shortcuts: @assignee !priority #category ^reviewer -date)
//   - CSV/Excel import with preview, validation, and template downloads
//   - Editable task list
//
// Schema is centralized in src/lib/taskSchema.js — update that file when adding fields.

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import {
  TASK_SCHEMA,
  getColumnNames,
  getRequiredColumns,
  validateRow,
} from "../lib/taskSchema";

export default function ProjectDetail({ profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tasks");
  const [toast, setToast] = useState(null);

  const [quickForm, setQuickForm] = useState(quickDefaults());
  const [quickSaving, setQuickSaving] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [importPreview, setImportPreview] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importFileName, setImportFileName] = useState("");

  // Tracks save state per row in the grid: { taskId: 'saving' | 'saved' | 'error' }
  const [rowSaveStatus, setRowSaveStatus] = useState({});
  const [addingRow, setAddingRow] = useState(false);

  // Permission check — can current user edit this task?
  function canEditRow(t) {
    if (!t || !profile) return false;
    if (profile.role === "admin") return true;
    if (t.created_by === profile.id) return true;
    if (t.assignee_id === profile.id) return true;
    if (t.reviewer_id === profile.id) return true;
    return false;
  }

  // Save a single field change for a row. Updates DB, refreshes the row from server.
  async function saveCell(taskId, field, value) {
    // Don't bother if value is unchanged
    const current = tasks.find((t) => t.id === taskId);
    if (current && current[field] === value) return;

    setRowSaveStatus((s) => ({ ...s, [taskId]: "saving" }));
    const updates = { [field]: value === "" ? null : value };

    // If TAT changes but no reviewer, clear TAT
    if (field === "review_tat_days" && current && !current.reviewer_id) {
      updates.review_tat_days = null;
    }
    // If status moves to In Review and no review_started_at, set it
    if (
      field === "status" &&
      value === "In Review" &&
      current &&
      current.status !== "In Review"
    ) {
      updates.review_started_at = new Date().toISOString();
      updates.review_completed_at = null;
    }
    if (
      field === "status" &&
      current &&
      current.status === "In Review" &&
      value !== "In Review"
    ) {
      updates.review_completed_at = new Date().toISOString();
    }
    if (field === "status" && value === "Done") {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      console.error(error);
      setRowSaveStatus((s) => ({ ...s, [taskId]: "error" }));
      showToast("⚠ Save failed: " + error.message, "warn");
      return;
    }
    setRowSaveStatus((s) => ({ ...s, [taskId]: "saved" }));
    // Clear "saved" indicator after 2 seconds
    setTimeout(() => {
      setRowSaveStatus((s) => {
        const next = { ...s };
        if (next[taskId] === "saved") delete next[taskId];
        return next;
      });
    }, 2000);
    // Refresh just this row in local state to keep it in sync
    const { data: refreshed } = await supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)")
      .eq("id", taskId)
      .single();
    if (refreshed) {
      setTasks((ts) => ts.map((t) => (t.id === taskId ? refreshed : t)));
    }
  }

  // Add a new empty row to the grid (creates a task with placeholder title)
  async function addNewRow() {
    setAddingRow(true);
    const payload = {
      title: "Untitled task",
      status: "To Do",
      priority: "Medium",
      visibility: "public",
      task_type: "One-time",
      recurrence: "None",
      project_id: id,
      created_by: profile?.id,
      archived: false,
    };
    const { data, error } = await supabase
      .from("tasks")
      .insert(payload)
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)")
      .single();
    if (error) {
      console.error(error);
      showToast("Could not add row: " + error.message, "warn");
    } else {
      setTasks((ts) => [...ts, data]);
      // Try to focus the new row's title cell
      setTimeout(() => {
        const el = document.getElementById("grid-title-" + data.id);
        if (el) el.focus();
      }, 50);
    }
    setAddingRow(false);
  }

  function quickDefaults() {
    return {
      title: "",
      assignee_id: "",
      reviewer_id: "",
      priority: "Medium",
      category: "",
      due_date: "",
      review_tat_days: 2,
      visibility: "public",
    };
  }

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    fetchAll();
  }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [pRes, tRes, mRes, cRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)")
        .eq("project_id", id)
        .eq("archived", false)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, role"),
      supabase.from("categories").select("*"),
    ]);
    setProject(pRes.data || null);
    setTasks(tRes.data || []);
    setMembers(mRes.data || []);
    setCategories(cRes.data || []);
    setLoading(false);
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickForm.title.trim()) return;
    setQuickSaving(true);
    const payload = {
      title: quickForm.title.trim(),
      assignee_id: quickForm.assignee_id || null,
      reviewer_id: quickForm.reviewer_id || null,
      priority: quickForm.priority,
      category: quickForm.category || null,
      due_date: quickForm.due_date || null,
      review_tat_days: quickForm.review_tat_days
        ? parseInt(quickForm.review_tat_days, 10)
        : null,
      visibility: quickForm.visibility,
      status: "To Do",
      task_type: "One-time",
      recurrence: "None",
      project_id: id,
      created_by: profile?.id,
      archived: false,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) {
      console.error(error);
      showToast("Error: " + error.message, "warn");
    } else {
      showToast("Task added");
      setQuickForm(quickDefaults());
      await fetchAll();
    }
    setQuickSaving(false);
  }

  function parseBulkLine(line) {
    let title = line;
    const parsed = {
      assignee_id: null,
      reviewer_id: null,
      priority: "Medium",
      category: null,
      due_date: null,
      review_tat_days: null,
      warnings: [],
    };
    const findMember = (handle) => {
      const lower = handle.toLowerCase();
      return members.find((m) => {
        const first = (m.full_name || "").split(" ")[0].toLowerCase();
        const email = (m.email || "").toLowerCase();
        return (
          first === lower || email === lower || email.startsWith(lower + "@")
        );
      });
    };
    const assigneeMatch = title.match(/@(\S+)/);
    if (assigneeMatch) {
      const handle = assigneeMatch[1];
      const m = findMember(handle);
      if (m) parsed.assignee_id = m.id;
      else parsed.warnings.push("@" + handle + " not found, unassigned");
      title = title.replace(assigneeMatch[0], "");
    }
    const reviewerMatch = title.match(/\^(\S+)/);
    if (reviewerMatch) {
      const handle = reviewerMatch[1];
      const m = findMember(handle);
      if (m) parsed.reviewer_id = m.id;
      else parsed.warnings.push("^" + handle + " not found, no reviewer");
      title = title.replace(reviewerMatch[0], "");
    }
    const priMatch = title.match(/!(high|medium|med|low)/i);
    if (priMatch) {
      const p = priMatch[1].toLowerCase();
      parsed.priority = p === "high" ? "High" : p === "low" ? "Low" : "Medium";
      title = title.replace(priMatch[0], "");
    }
    const catMatch = title.match(/#(\S+)/);
    if (catMatch) {
      const handle = catMatch[1];
      const c = categories.find(
        (c) => c.name.toLowerCase() === handle.toLowerCase()
      );
      if (c) parsed.category = c.name;
      else parsed.warnings.push("#" + handle + " not a known category");
      title = title.replace(catMatch[0], "");
    }
    const dateMatch = title.match(/-(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      parsed.due_date = dateMatch[1];
      title = title.replace(dateMatch[0], "");
    }
    const tatMatch = title.match(/\+(\d+)/);
    if (tatMatch) {
      parsed.review_tat_days = parseInt(tatMatch[1], 10);
      title = title.replace(tatMatch[0], "");
    }
    parsed.title = title.trim().replace(/\s+/g, " ");
    return parsed;
  }

  useEffect(() => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    setBulkPreview(lines.map(parseBulkLine));
    // eslint-disable-next-line
  }, [bulkText, members, categories]);

  async function handleBulkSave() {
    const valid = bulkPreview.filter((p) => p.title);
    if (valid.length === 0) return;
    setBulkSaving(true);
    const payload = valid.map((p) => ({
      title: p.title,
      assignee_id: p.assignee_id,
      reviewer_id: p.reviewer_id,
      priority: p.priority,
      category: p.category,
      due_date: p.due_date,
      review_tat_days: p.review_tat_days,
      visibility: "public",
      status: "To Do",
      task_type: "One-time",
      recurrence: "None",
      project_id: id,
      created_by: profile?.id,
      archived: false,
    }));
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) {
      console.error(error);
      showToast("Error: " + error.message, "warn");
    } else {
      showToast("Added " + valid.length + " tasks");
      setBulkText("");
      setBulkPreview([]);
      setActiveTab("tasks");
      await fetchAll();
    }
    setBulkSaving(false);
  }

  function csvEscape(val) {
    if (val == null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadCsvTemplate() {
    const columns = getColumnNames();
    const required = getRequiredColumns();
    const commentParts = columns.map((c) => {
      const f = TASK_SCHEMA.find((x) => x.column === c);
      let label = c + (required.includes(c) ? "*" : "");
      if (f.type === "enum") label += " [" + f.values.join("|") + "]";
      else if (f.type === "date") label += " [YYYY-MM-DD]";
      else if (f.type === "email") label += " [email]";
      else if (f.type === "number") label += " [number]";
      return label;
    });
    const commentRow =
      "# " + commentParts.join(" | ") + "   (columns marked * are required)";
    const headerRow = columns.join(",");
    const example1 = columns
      .map((c) => {
        const f = TASK_SCHEMA.find((x) => x.column === c);
        return csvEscape(f.example || "");
      })
      .join(",");
    const example2 = columns
      .map((c) =>
        c === "title" ? csvEscape("Another task — only title is mandatory") : ""
      )
      .join(",");
    const csv = [commentRow, headerRow, example1, example2].join("\n");
    downloadBlob(csv, "task-template.csv", "text/csv");
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/);
    const dataLines = lines.filter(
      (l) => l.trim() && !l.trim().startsWith("#")
    );
    if (dataLines.length === 0) return [];
    const headers = splitCsvLine(dataLines[0]);
    return dataLines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = (values[i] || "").trim();
      });
      return obj;
    });
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImportFileName(file.name);
    setImportPreview({ status: "parsing" });
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      } else {
        const text = await file.text();
        rows = parseCsv(text);
      }
      rows = rows.map((r) => {
        const clean = {};
        Object.keys(r).forEach((k) => {
          const cleanKey = k.replace(/\*$/, "").trim();
          clean[cleanKey] = r[k];
        });
        return clean;
      });
      const lookup = {
        findMemberByEmail: (email) => {
          const low = email.toLowerCase().trim();
          return members.find((m) => (m.email || "").toLowerCase() === low);
        },
      };
      const validated = rows.map((row, i) => {
        const v = validateRow(row, lookup);
        return { rowNum: i + 1, ...v, row };
      });
      const errors = validated.filter((v) => !v.ok).length;
      const warnings = validated.filter((v) => v.warnings.length > 0).length;
      setImportPreview({
        status: "ready",
        rows: validated,
        totalRows: validated.length,
        errors,
        warnings,
      });
    } catch (err) {
      console.error(err);
      setImportPreview({
        status: "error",
        error: err.message || "Could not parse file",
      });
    }
  }

  async function handleImportSave() {
    if (!importPreview || importPreview.status !== "ready") return;
    if (importPreview.errors > 0) {
      showToast("Fix errors before importing", "warn");
      return;
    }
    setImportSaving(true);
    const inserts = importPreview.rows.map((r) => {
      const p = r.payload;
      return {
        title: p.title,
        description: p.description || null,
        assignee_id: p.assignee_id || null,
        reviewer_id: p.reviewer_id || null,
        priority: p.priority || "Medium",
        category: p.category || null,
        status: p.status || "To Do",
        due_date: p.due_date || null,
        review_tat_days: p.review_tat_days || null,
        visibility: p.visibility || "public",
        task_type: p.task_type || "One-time",
        recurrence: p.recurrence || "None",
        tags: p.tags || null,
        project_id: id,
        created_by: profile?.id,
        archived: false,
      };
    });
    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert(inserts)
      .select();
    if (error) {
      console.error(error);
      showToast("Error: " + error.message, "warn");
      setImportSaving(false);
      return;
    }
    const titleToId = {};
    inserted.forEach((t) => {
      titleToId[t.title] = t.id;
    });
    const blockUpdates = [];
    importPreview.rows.forEach((r, i) => {
      const blockTitle = r.payload.blocked_by_title;
      if (blockTitle && titleToId[blockTitle]) {
        blockUpdates.push({
          id: inserted[i].id,
          blocked_by: titleToId[blockTitle],
        });
      }
    });
    for (const upd of blockUpdates) {
      await supabase
        .from("tasks")
        .update({ blocked_by: upd.blocked_by })
        .eq("id", upd.id);
    }
    showToast("Imported " + inserted.length + " tasks");
    setImportPreview(null);
    setImportFileName("");
    setActiveTab("tasks");
    await fetchAll();
    setImportSaving(false);
  }

  async function handleDeleteTask(taskId) {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      console.error(error);
      showToast("Error: " + error.message, "warn");
    } else {
      showToast("Task deleted");
      await fetchAll();
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading project...</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Project not found, or you don't have access.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/projects")}
          style={{ marginTop: 12 }}
        >
          ← Back to Projects
        </button>
      </div>
    );
  }

  const owner = members.find((m) => m.id === project.owner_id);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < today && t.status !== "Done"
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const hiddenCount =
    profile?.role === "admin"
      ? tasks.filter((t) => t.visibility === "private").length
      : 0;

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
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 360,
            lineHeight: 1.45,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/projects")}
          style={{ fontSize: 12, padding: "4px 8px" }}
        >
          ← Projects
        </button>
      </div>

      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{project.name}</h1>
          {project.description && (
            <p className="page-sub" style={{ color: "var(--text-secondary)" }}>
              {project.description}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-primary)",
            background: "var(--bg-soft)",
            padding: "5px 12px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {project.status}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {done}
          </div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: overdue > 0 ? "var(--danger)" : "inherit" }}
          >
            {overdue}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--primary)" }}>
            {pct}%
          </div>
          <div className="stat-label">Progress</div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
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
            Owner
          </div>
          <div style={{ fontSize: 13 }}>{owner?.full_name || "—"}</div>
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
            Start
          </div>
          <div style={{ fontSize: 13 }}>{project.start_date || "—"}</div>
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
            End
          </div>
          <div style={{ fontSize: 13 }}>
            {project.end_date || "—"}
            {project.end_date && project.deadline_type === "hard" && (
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 6,
                  color: "var(--danger)",
                  fontWeight: 700,
                }}
              >
                🚨 HARD
              </span>
            )}
            {project.end_date && project.deadline_type === "target" && (
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 6,
                  color: "var(--primary)",
                  fontWeight: 700,
                }}
              >
                🎯 TARGET
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        {[
          { id: "tasks", label: "📋 Tasks (" + total + ")" },
          { id: "quick", label: "➕ Quick add" },
          { id: "bulk", label: "📝 Bulk paste" },
          { id: "import", label: "📥 Import CSV/Excel" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background:
                activeTab === tab.id
                  ? "var(--primary-light, rgba(91, 76, 245, 0.10))"
                  : "transparent",
              color:
                activeTab === tab.id
                  ? "var(--primary)"
                  : "var(--text-secondary)",
              border: "none",
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: "pointer",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "var(--font)",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "tasks" && (
        <div>
          {tasks.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
                No tasks yet in this project.
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginBottom: 16,
                }}
              >
                Add a row below, or use the other tabs to bulk paste or import.
              </p>
              <button
                className="btn btn-primary"
                onClick={addNewRow}
                disabled={addingRow}
              >
                {addingRow ? "Adding..." : "+ Add first task"}
              </button>
            </div>
          ) : (
            <div
              className="card"
              style={{
                padding: 0,
                overflowX: "auto",
                overflowY: "visible",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 1100,
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
                      { label: "Title", width: 240 },
                      { label: "Status", width: 110 },
                      { label: "Assignee", width: 130 },
                      { label: "Reviewer", width: 130 },
                      { label: "Priority", width: 90 },
                      { label: "Category", width: 110 },
                      { label: "Due", width: 130 },
                      { label: "TAT", width: 60 },
                      { label: "Vis.", width: 80 },
                      { label: "", width: 110 },
                    ].map((c) => (
                      <th
                        key={c.label}
                        style={{
                          padding: "10px 12px",
                          textAlign: "left",
                          fontWeight: 600,
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          width: c.width,
                          minWidth: c.width,
                        }}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const editable = canEditRow(t);
                    const savingState = rowSaveStatus[t.id];
                    const taskOverdue =
                      t.due_date &&
                      new Date(t.due_date) < today &&
                      t.status !== "Done";

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
                      color: "var(--text-primary)",
                      width: "100%",
                      outline: "none",
                      cursor: editable ? "text" : "not-allowed",
                    };
                    const inputFocusStyle = {
                      borderColor: "var(--primary)",
                      background: "var(--bg-card)",
                    };
                    const selectStyle = {
                      ...inputBase,
                      cursor: editable ? "pointer" : "not-allowed",
                      appearance: "none",
                    };

                    return (
                      <tr
                        key={t.id}
                        style={{
                          background:
                            savingState === "saving"
                              ? "rgba(91, 76, 245, 0.04)"
                              : savingState === "error"
                              ? "rgba(220, 38, 38, 0.04)"
                              : "transparent",
                          transition: "background 0.2s",
                        }}
                      >
                        {/* Title */}
                        <td style={cellStyle}>
                          <input
                            id={"grid-title-" + t.id}
                            type="text"
                            defaultValue={t.title}
                            disabled={!editable}
                            style={inputBase}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                              if (e.target.value !== t.title)
                                saveCell(t.id, "title", e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                              if (e.key === "Escape") {
                                e.target.value = t.title;
                                e.target.blur();
                              }
                            }}
                          />
                        </td>

                        {/* Status */}
                        <td style={cellStyle}>
                          <select
                            value={t.status || "To Do"}
                            disabled={!editable}
                            style={selectStyle}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "status", e.target.value)
                            }
                          >
                            {["To Do", "In Progress", "In Review", "Done"].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        {/* Assignee */}
                        <td style={cellStyle}>
                          <select
                            value={t.assignee_id || ""}
                            disabled={!editable}
                            style={selectStyle}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "assignee_id", e.target.value)
                            }
                          >
                            <option value="">— Unassigned —</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Reviewer */}
                        <td style={cellStyle}>
                          <select
                            value={t.reviewer_id || ""}
                            disabled={!editable}
                            style={selectStyle}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "reviewer_id", e.target.value)
                            }
                          >
                            <option value="">— No reviewer —</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Priority */}
                        <td style={cellStyle}>
                          <select
                            value={t.priority || "Medium"}
                            disabled={!editable}
                            style={{
                              ...selectStyle,
                              color:
                                t.priority === "High"
                                  ? "var(--danger)"
                                  : t.priority === "Low"
                                  ? "var(--text-tertiary)"
                                  : "var(--text-primary)",
                              fontWeight: t.priority === "High" ? 600 : 400,
                            }}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "priority", e.target.value)
                            }
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>

                        {/* Category */}
                        <td style={cellStyle}>
                          <select
                            value={t.category || ""}
                            disabled={!editable}
                            style={selectStyle}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "category", e.target.value)
                            }
                          >
                            <option value="">—</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Due date */}
                        <td style={cellStyle}>
                          <input
                            type="date"
                            defaultValue={t.due_date || ""}
                            disabled={!editable}
                            style={{
                              ...inputBase,
                              color: taskOverdue
                                ? "var(--danger)"
                                : "var(--text-primary)",
                              fontWeight: taskOverdue ? 600 : 400,
                            }}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                              if (e.target.value !== (t.due_date || ""))
                                saveCell(t.id, "due_date", e.target.value);
                            }}
                          />
                        </td>

                        {/* TAT */}
                        <td style={cellStyle}>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            defaultValue={t.review_tat_days || ""}
                            disabled={!editable || !t.reviewer_id}
                            placeholder={t.reviewer_id ? "2" : "—"}
                            style={inputBase}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                              const v = e.target.value
                                ? parseInt(e.target.value, 10)
                                : null;
                              if (v !== t.review_tat_days)
                                saveCell(t.id, "review_tat_days", v);
                            }}
                          />
                        </td>

                        {/* Visibility */}
                        <td style={cellStyle}>
                          <select
                            value={t.visibility || "public"}
                            disabled={!editable}
                            style={selectStyle}
                            onFocus={(e) =>
                              Object.assign(e.target.style, inputFocusStyle)
                            }
                            onBlur={(e) => {
                              e.target.style.border = "1px solid transparent";
                              e.target.style.background = "transparent";
                            }}
                            onChange={(e) =>
                              saveCell(t.id, "visibility", e.target.value)
                            }
                          >
                            <option value="public">🌐 Public</option>
                            <option value="private">🔒 Private</option>
                          </select>
                        </td>

                        {/* Actions */}
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
                              ✓ Saved
                            </span>
                          )}
                          {savingState === "error" && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--danger)",
                                marginRight: 6,
                                fontFamily: "var(--font-mono)",
                              }}
                              title="Save failed — try editing the cell again"
                            >
                              ⚠ Error
                            </span>
                          )}
                          <button
                            onClick={() => navigate("/board")}
                            title="Open in Board (for comments, subtasks, files)"
                            style={{
                              background: "none",
                              border: "1px solid var(--border)",
                              borderRadius: 5,
                              padding: "3px 7px",
                              cursor: "pointer",
                              fontSize: 11,
                              marginRight: 4,
                              color: "var(--text-secondary)",
                            }}
                          >
                            ↗
                          </button>
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            disabled={!editable}
                            title="Delete task"
                            style={{
                              background: "none",
                              border: "1px solid var(--border)",
                              borderRadius: 5,
                              padding: "3px 7px",
                              cursor: editable ? "pointer" : "not-allowed",
                              fontSize: 11,
                              color: "var(--danger)",
                              opacity: editable ? 1 : 0.4,
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

              {/* Add row button */}
              <div
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-soft)",
                }}
              >
                <button
                  onClick={addNewRow}
                  disabled={addingRow}
                  style={{
                    background: "none",
                    border: "1px dashed var(--border-strong)",
                    borderRadius: 6,
                    padding: "6px 14px",
                    cursor: addingRow ? "wait" : "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--primary)",
                    fontFamily: "var(--font)",
                  }}
                >
                  {addingRow ? "Adding…" : "+ Add row"}
                </button>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginLeft: 10,
                  }}
                >
                  Edits save automatically. Click any cell to edit.
                </span>
              </div>

              {hiddenCount > 0 && (
                <div
                  style={{
                    padding: "10px 18px",
                    borderTop: "1px solid var(--border)",
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                    background: "var(--bg-soft)",
                  }}
                >
                  🔒 {hiddenCount} private task
                  {hiddenCount > 1 ? "s" : ""} in this project (visible to you
                  as admin).
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "quick" && (
        <div className="card">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 14,
              marginTop: 0,
            }}
          >
            Add one task
          </h3>
          <form onSubmit={handleQuickAdd}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                value={quickForm.title}
                onChange={(e) =>
                  setQuickForm({ ...quickForm, title: e.target.value })
                }
                placeholder="What needs to be done?"
                required
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
                <label className="form-label">Assignee</label>
                <select
                  className="form-select"
                  value={quickForm.assignee_id}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, assignee_id: e.target.value })
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
                <label className="form-label">Reviewer</label>
                <select
                  className="form-select"
                  value={quickForm.reviewer_id}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, reviewer_id: e.target.value })
                  }
                >
                  <option value="">No reviewer</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={quickForm.priority}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, priority: e.target.value })
                  }
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={quickForm.category}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, category: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due date</label>
                <input
                  type="date"
                  className="form-input"
                  value={quickForm.due_date}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, due_date: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Review TAT (days)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="30"
                  value={quickForm.review_tat_days}
                  onChange={(e) =>
                    setQuickForm({
                      ...quickForm,
                      review_tat_days: e.target.value,
                    })
                  }
                  disabled={!quickForm.reviewer_id}
                />
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
                      border:
                        "2px solid " +
                        (quickForm.visibility === v
                          ? "var(--primary)"
                          : "var(--border)"),
                      borderRadius: 8,
                      cursor: "pointer",
                      background:
                        quickForm.visibility === v
                          ? "var(--primary-light, rgba(91, 76, 245, 0.08))"
                          : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="quick-visibility"
                      value={v}
                      checked={quickForm.visibility === v}
                      onChange={(e) =>
                        setQuickForm({
                          ...quickForm,
                          visibility: e.target.value,
                        })
                      }
                    />
                    <span style={{ fontSize: 13 }}>
                      {v === "public" ? "🌐 Public" : "🔒 Private"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={quickSaving || !quickForm.title.trim()}
              >
                {quickSaving ? "Adding..." : "+ Add task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "bulk" && (
        <div className="card">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 4,
              marginTop: 0,
            }}
          >
            Paste a list of tasks
          </h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 12,
            }}
          >
            One task per line. Optional shortcuts you can append:
          </p>
          <div
            style={{
              background: "var(--bg-soft)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
              fontSize: 11,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
            }}
          >
            <code>@name</code> assign | <code>^name</code> reviewer |{" "}
            <code>!high</code>/<code>!medium</code>/<code>!low</code> |{" "}
            <code>#category</code> | <code>-2026-08-15</code> due |{" "}
            <code>+3</code> TAT days
          </div>
          <textarea
            className="form-input"
            rows="10"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={
              "Collect bank statements @sagar !high #Finance -2026-08-01\nReconcile cash book @rahul -2026-08-05\nPrepare schedule of fixed assets @anita ^sagar +3 -2026-08-10"
            }
            style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          {bulkPreview.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                Preview ({bulkPreview.length}{" "}
                {bulkPreview.length === 1 ? "task" : "tasks"})
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {bulkPreview.map((p, i) => {
                  const assignee = p.assignee_id
                    ? members.find((m) => m.id === p.assignee_id)
                    : null;
                  const reviewer = p.reviewer_id
                    ? members.find((m) => m.id === p.reviewer_id)
                    : null;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        {p.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          marginTop: 3,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        {assignee && <span>👤 {assignee.full_name}</span>}
                        {reviewer && <span>👁 {reviewer.full_name}</span>}
                        {p.priority !== "Medium" && <span>{p.priority}</span>}
                        {p.category && <span>{p.category}</span>}
                        {p.due_date && <span>📅 {p.due_date}</span>}
                        {p.review_tat_days && (
                          <span>TAT {p.review_tat_days}d</span>
                        )}
                      </div>
                      {p.warnings.length > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--warning)",
                            marginTop: 3,
                          }}
                        >
                          ⚠ {p.warnings.join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={() => setBulkText("")}
              disabled={!bulkText}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBulkSave}
              disabled={bulkSaving || bulkPreview.length === 0}
            >
              {bulkSaving
                ? "Adding..."
                : "+ Add " +
                  bulkPreview.length +
                  " task" +
                  (bulkPreview.length === 1 ? "" : "s")}
            </button>
          </div>
        </div>
      )}

      {activeTab === "import" && (
        <div className="card">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 4,
              marginTop: 0,
            }}
          >
            Import from CSV or Excel
          </h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 14,
            }}
          >
            Download a template, fill in your tasks, and upload it back.
            Templates are generated from the live schema, so they always match
            the current app.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <button className="btn btn-ghost" onClick={downloadCsvTemplate}>
              ⬇ CSV template
            </button>
          </div>
          <div
            style={{
              border: "2px dashed var(--border)",
              background: "var(--bg-soft)",
              borderRadius: 10,
              padding: 20,
              textAlign: "center",
              marginBottom: 14,
              cursor: "pointer",
            }}
            onClick={() =>
              document.getElementById("import-file-input")?.click()
            }
          >
            <input
              id="import-file-input"
              type="file"
              accept=".csv,.xlsx"
              style={{ display: "none" }}
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
            <div style={{ fontSize: 28, marginBottom: 4 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {importFileName || "Click to choose a CSV or Excel file"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 3,
              }}
            >
              Supports .csv and .xlsx
            </div>
          </div>
          {importPreview && importPreview.status === "parsing" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p>Parsing...</p>
            </div>
          )}
          {importPreview && importPreview.status === "error" && (
            <div
              style={{
                background: "rgba(220, 38, 38, 0.10)",
                color: "var(--danger)",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              ⚠ {importPreview.error}
            </div>
          )}
          {importPreview && importPreview.status === "ready" && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 10,
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {importPreview.totalRows} rows
                </span>
                {importPreview.errors > 0 && (
                  <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                    ⚠ {importPreview.errors} errors
                  </span>
                )}
                {importPreview.warnings > 0 && (
                  <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                    {importPreview.warnings} warnings
                  </span>
                )}
                {importPreview.errors === 0 && (
                  <span style={{ color: "var(--success)", fontWeight: 600 }}>
                    ✓ Ready to import
                  </span>
                )}
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {importPreview.rows.map((r) => (
                  <div
                    key={r.rowNum}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 12,
                      background:
                        r.errors.length > 0
                          ? "rgba(220, 38, 38, 0.04)"
                          : r.warnings.length > 0
                          ? "rgba(217, 119, 6, 0.04)"
                          : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        Row {r.rowNum}:{" "}
                        {r.payload.title || r.row.title || "(no title)"}
                      </span>
                      {r.errors.length === 0 && r.warnings.length === 0 && (
                        <span style={{ color: "var(--success)" }}>✓</span>
                      )}
                    </div>
                    {r.errors.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--danger)",
                          marginTop: 3,
                        }}
                      >
                        ⚠ {r.errors.join("; ")}
                      </div>
                    )}
                    {r.warnings.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--warning)",
                          marginTop: 3,
                        }}
                      >
                        {r.warnings.join("; ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setImportPreview(null);
                    setImportFileName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImportSave}
                  disabled={importSaving || importPreview.errors > 0}
                >
                  {importSaving
                    ? "Importing..."
                    : "Import " + importPreview.totalRows + " tasks"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
