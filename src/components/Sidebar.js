// src/components/Sidebar.js — drop-in replacement
// Adds "Projects" nav item between Board and Calendar.
// Still fetches workspace name from settings table.

import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const NAV = [
  { to: "/dashboard", label: "My Tasks", icon: <HomeIcon /> },
  { to: "/personal", label: "My List", icon: <ListIcon /> },
  { to: "/board", label: "Board", icon: <KanbanIcon /> },
  { to: "/projects", label: "Projects", icon: <FolderIcon /> },
  { to: "/calendar", label: "Calendar", icon: <CalIcon /> },
  { to: "/team", label: "Team", icon: <PeopleIcon /> },
  { to: "/reports", label: "Reports", icon: <ChartIcon /> },
  { to: "/archive", label: "Archive", icon: <ArchiveIcon /> },
];

export default function Sidebar({ profile }) {
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("TaskFlow");
  const [workspaceInitial, setWorkspaceInitial] = useState("T");

  useEffect(() => {
    async function loadWorkspaceName() {
      try {
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "workspace")
          .single();
        if (data && data.value) {
          const parsed = JSON.parse(data.value);
          if (parsed.workspace_name) {
            setWorkspaceName(parsed.workspace_name);
            setWorkspaceInitial(parsed.workspace_name.charAt(0).toUpperCase());
          }
        }
      } catch (e) {
        // No settings yet — keep default
      }
    }
    loadWorkspaceName();
    function onFocus() {
      loadWorkspaceName();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";
  const colors = [
    "#5B4CF5",
    "#1D9E75",
    "#D97706",
    "#DC2626",
    "#0369A1",
    "#7C3AED",
  ];
  const color =
    colors[(profile?.full_name || "").charCodeAt(0) % colors.length];

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-row">
          <div className="sidebar-logo-icon">{workspaceInitial}</div>
          <span className="sidebar-logo-text">{workspaceName}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section">Main</div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-item${isActive ? " active" : ""}`
            }
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
        {profile?.role === "admin" && (
          <>
            <div className="sidebar-section">Admin</div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-item${isActive ? " active" : ""}`
              }
            >
              <SettingsIcon /> Admin Panel
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: color }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">
              {profile?.full_name || "Team Member"}
            </div>
            <div className="sidebar-user-role">{profile?.role || "member"}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-7h4v7h4a1 1 0 001-1V10" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.5" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="4.5" cy="18" r="1.5" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="11" rx="1" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M14.5 21c0-2.5 2-4.5 4.5-4.5" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
