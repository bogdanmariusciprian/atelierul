// =========================================================
// Supabase client — single shared instance (DRY).
// Import { supabase } anywhere instead of re-creating it.
//
// Loads the Supabase JS library from a CDN via ES modules,
// so no build step / npm install is required.
// Docs: https://supabase.com/docs/reference/javascript
// =========================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
