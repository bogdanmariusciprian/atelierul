// =========================================================
// PRIMEȘTE PREZENȚA din tabelul Google (Apps Script, `SITE_SYNC` în Cod.gs).
//
// Apps Script n-are cont pe sit, deci funcția e publicată FĂRĂ verificare JWT
// și se apără cu o parolă, trimisă în antetul `x-prezenta-secret`.
//
// PAROLA NU STĂ AICI (repository-ul e public). În bază, în `prezenta_cheie`
// (migrarea 0110), stă doar amprenta ei SHA-256; tabelul nu-l citește nimeni
// din browser. Funcția face amprenta parolei primite și le compară.
// Cuprins în română, nume în engleză.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparație în timp constant, ca durata să nu spună cât din parolă e bun. */
function laFel(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Doar POST", { status: 405 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const parola = req.headers.get("x-prezenta-secret") ?? "";
  const { data: cheie } = await db.from("prezenta_cheie").select("hash").eq("id", 1).maybeSingle();
  if (!parola || !cheie?.hash || !laFel(await sha256Hex(parola), cheie.hash)) {
    return new Response("Parolă greșită", { status: 401 });
  }

  const date = await req.json().catch(() => null);
  if (date?.versiune !== 1 || !Array.isArray(date.ore)) {
    return new Response("Format necunoscut", { status: 400 });
  }

  const { error } = await db.from("prezenta_export").upsert({
    id: 1,
    date,
    actualizat: date.actualizat ?? new Date().toISOString(),
  });
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ ok: true, ore: date.ore.length });
});
