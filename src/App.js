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

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        await supabase.from("profiles").insert({
          id: userId,
          full_name:
            (
              await supabase.auth.getUser()
            ).data.user?.user_metadata?.full_name || "Team Member",
          email: (await supabase.auth.getUser()).data.user?.email,
          role: "admin",
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
