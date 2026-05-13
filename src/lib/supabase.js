import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wvnfauyimzrofxjdjaxt.supabase.co/rest/v1/";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bmZhdXlpbXpyb2Z4amRqYXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY1MzA3MiwiZXhwIjoyMDk0MjI5MDcyfQ._mcLtjBz3hlk-QsgRa9M3yAQmCMyg-dS5QsrZxFMmRE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
