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
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
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
            <Route path="/" element={<Navigate to="/board" />} />
            <Route
              path="/dashboard"
              element={<Dashboard profile={profile} />}
            />
            <Route path="/board" element={<Board profile={profile} />} />
            <Route
              path="/calendar"
              element={<CalendarView profile={profile} />}
            />
            <Route path="/reports" element={<Reports profile={profile} />} />
            <Route path="/archive" element={<Archive profile={profile} />} />
            <Route path="/admin" element={<AdminPanel profile={profile} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
