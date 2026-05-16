// src/App.js — drop-in replacement
// Fixes the role bug: first user = admin, everyone after = member.

import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import CalendarView from "./pages/CalendarView";
import Reports from "./pages/Reports";
import Archive from "./pages/Archive";
import AdminPanel from "./pages/AdminPanel";
import Team from "./pages/Team";
import Sidebar from "./components/Sidebar";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadWorkspaceSettings();
  }, []);

  async function loadWorkspaceSettings() {
    try {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("key", "workspace")
        .single();
      if (data) {
        const settings = JSON.parse(data.value);
        if (settings.primary_color) {
          document.documentElement.style.setProperty(
            "--primary",
            settings.primary_color
          );
        }
      }
    } catch (e) {
      console.log("No workspace settings yet");
    }
  }

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        const { data: userData } = await supabase.auth.getUser();

        // First user to ever sign up becomes admin. Everyone else is a member.
        // Admin can later promote someone via the Admin Panel.
        const { count: adminCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");

        const assignedRole = adminCount && adminCount > 0 ? "member" : "admin";

        await supabase.from("profiles").insert({
          id: userId,
          full_name:
            userData.user?.user_metadata?.full_name ||
            userData.user?.user_metadata?.name ||
            userData.user?.email?.split("@")[0] ||
            "Team Member",
          email: userData.user?.email,
          role: assignedRole,
        });
        const { data: newProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading TaskFlow...</p>
      </div>
    );

  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar profile={profile} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={<Dashboard profile={profile} />}
            />
            <Route path="/board" element={<Board profile={profile} />} />
            <Route
              path="/calendar"
              element={<CalendarView profile={profile} />}
            />
            <Route path="/team" element={<Team profile={profile} />} />
            <Route path="/reports" element={<Reports profile={profile} />} />
            <Route path="/archive" element={<Archive profile={profile} />} />
            <Route path="/admin" element={<AdminPanel profile={profile} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
