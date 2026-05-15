// src/pages/Team.js — NEW FILE
// Team directory. Cards for each member showing their workload.

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AVATAR_COLORS = [
  "#5B4CF5",
  "#0E9F6E",
  "#D97706",
  "#E11D48",
  "#0EA5A4",
  "#A855F7",
  "#06B6D4",
  "#84CC16",
];

function initialsOf(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function colorFor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function Team({ profile }) {
  const [people, setPeople] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .then(({ data }) => setPeople(data || []));
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .then(({ data }) => setTasks(data || []));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-sub">
            {people.length} member{people.length === 1 ? "" : "s"} in this
            workspace
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {people.map((p) => {
          const open = tasks.filter(
            (t) => t.assignee_id === p.id && t.status !== "Done"
          ).length;
          const wip = tasks.filter(
            (t) => t.assignee_id === p.id && t.status === "In Progress"
          ).length;
          const done = tasks.filter(
            (t) => t.assignee_id === p.id && t.status === "Done"
          ).length;
          const isMe = p.id === profile?.id;
          return (
            <div key={p.id} className="card" style={{ position: "relative" }}>
              {isMe && (
                <span
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--primary)",
                    background: "var(--primary-light)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  You
                </span>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <div
                  className="avatar"
                  style={{
                    width: 48,
                    height: 48,
                    fontSize: 16,
                    background: colorFor(p.full_name),
                  }}
                >
                  {initialsOf(p.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.full_name || "Team Member"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.email}
                  </div>
                </div>
                {p.role === "admin" && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Admin
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      letterSpacing: 0.6,
                      fontWeight: 600,
                    }}
                  >
                    Open
                  </div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: 24,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: -0.5,
                    }}
                  >
                    {open}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      letterSpacing: 0.6,
                      fontWeight: 600,
                    }}
                  >
                    In progress
                  </div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: 24,
                      color: "var(--primary)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: -0.5,
                    }}
                  >
                    {wip}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      letterSpacing: 0.6,
                      fontWeight: 600,
                    }}
                  >
                    Done
                  </div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: 24,
                      color: "var(--success)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: -0.5,
                    }}
                  >
                    {done}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {people.length === 0 && (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <p>
              No team members yet. Invite your team by sharing the app URL —
              they'll show up here once they sign in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
