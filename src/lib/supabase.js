import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wvnfauyimzrofxjdjaxt.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bmZhdXlpbXpyb2Z4amRqYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTMwNzIsImV4cCI6MjA5NDIyOTA3Mn0.-9_yrfwoHVZ9JC5FUJikUDvrJBegno_q0p9YP6tZY_M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
