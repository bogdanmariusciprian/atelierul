// =========================================================
// TABLA ALBĂ (0113): clasele, lecțiile, paginile și canalul live.
//
// Adminul citește și scrie direct în tabele (le păzește `is_admin_user()`).
// Vizitatorul, logat ori nu, primește doar prin funcții, și doar cât e
// vizibilă tabla clasei: profesorul a lăsat-o deschisă, e deschis Liceul și e
// ora clasei după orar, ±2 minute (0115; codurile din 0113 nu mai există).
// Pe canalul `tabla-alba:<id>` scrie numai profesorul; ascultă doar cine vede
// acum tabla clasei.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "./supabase-client.js";

const UUID = /^[0-9a-f-]{36}$/i;
const eroare = (unde, e) => { console.warn(`tabla albă, ${unde}:`, e?.message || e); };

/* ---------- adminul ---------- */

/** Clasele, cu lecțiile lor (fără materialul HTML). */
export async function clasele() {
  const { data, error } = await supabase.from("tabla_alba_clase")
    .select("id, nume, ordine, stare, acces, lectii:tabla_alba_lectii(id, titlu, ordine, material, creat_la)")
    .order("ordine").order("creat_la");
  if (error) { eroare("clasele", error); throw error; }
  for (const c of data) c.lectii.sort((a, b) => a.ordine - b.ordine || String(a.creat_la).localeCompare(String(b.creat_la)));
  return data;
}

export async function claseNoua(nume, ordine) {
  const { data, error } = await supabase.from("tabla_alba_clase")
    .insert({ nume, ordine }).select("id, nume, ordine, stare, acces").single();
  if (error) { eroare("clasă nouă", error); return { eroare: error.message }; }
  return { clasa: { ...data, lectii: [] } };
}

export async function schimbaClasa(id, ce) {
  const { error } = await supabase.from("tabla_alba_clase").update({ ...ce, actualizat_la: new Date().toISOString() }).eq("id", id);
  if (error) { eroare("schimbă clasa", error); return error.message; }
  return "";
}

export async function stergeClasa(id) {
  const { error } = await supabase.from("tabla_alba_clase").delete().eq("id", id);
  if (error) { eroare("șterge clasa", error); return false; }
  return true;
}

/** Lecție nouă, cu o pagină goală în ea (cu fundalul tău implicit). */
export async function lectieNoua(clasaId, titlu, ordine, desen = null) {
  const { data, error } = await supabase.from("tabla_alba_lectii")
    .insert({ clasa_id: clasaId, titlu, ordine }).select("id, titlu, ordine, material, creat_la").single();
  if (error) { eroare("lecție nouă", error); return null; }
  await paginaNoua(data.id, 0, desen);
  return data;
}

export async function schimbaLectia(id, ce) {
  const { error } = await supabase.from("tabla_alba_lectii").update({ ...ce, actualizat_la: new Date().toISOString() }).eq("id", id);
  if (error) { eroare("schimbă lecția", error); return false; }
  return true;
}

export async function stergeLectia(id) {
  const { error } = await supabase.from("tabla_alba_lectii").delete().eq("id", id);
  if (error) { eroare("șterge lecția", error); return false; }
  return true;
}

export async function paginileAdmin(lectieId) {
  const { data, error } = await supabase.from("tabla_alba_pagini")
    .select("id, ordine, desen").eq("lectie_id", lectieId).order("ordine").order("actualizat_la");
  if (error) { eroare("paginile", error); throw error; }
  return data;
}

export async function paginaNoua(lectieId, ordine, desen = null) {
  const { data, error } = await supabase.from("tabla_alba_pagini")
    .insert({ lectie_id: lectieId, ordine, ...(desen ? { desen } : {}) }).select("id, ordine, desen").single();
  if (error) { eroare("pagină nouă", error); return null; }
  return data;
}

export async function salveazaPagina(id, desen) {
  const { error } = await supabase.from("tabla_alba_pagini")
    .update({ desen, actualizat_la: new Date().toISOString() }).eq("id", id);
  if (error) { eroare("salvează pagina", error); return false; }
  return true;
}

export async function ordineaPaginilor(pagini) {
  const r = await Promise.all(pagini.map((p, i) => supabase.from("tabla_alba_pagini").update({ ordine: i }).eq("id", p.id)));
  return r.every((x) => !x.error);
}

export async function stergePagina(id) {
  const { error } = await supabase.from("tabla_alba_pagini").delete().eq("id", id);
  if (error) { eroare("șterge pagina", error); return false; }
  return true;
}

export async function materialulAdmin(lectieId) {
  const { data, error } = await supabase.from("tabla_alba_lectii").select("material_html").eq("id", lectieId).maybeSingle();
  if (error) { eroare("materialul", error); return null; }
  return data?.material_html ?? null;
}

/* ---------- implicitele profesorului (0117) ---------- */

/** Culorile, grosimea, fundalul paginilor noi: ce a ales profesorul ultima oară. */
export async function setarileMele() {
  const { data, error } = await supabase.from("tabla_alba_setari").select("setari").maybeSingle();
  if (error) { eroare("setările", error); return null; }
  return data?.setari && typeof data.setari === "object" ? data.setari : null;
}
export async function salveazaSetarile(setari) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return false;
  const { error } = await supabase.from("tabla_alba_setari")
    .upsert({ user_id: u.user.id, setari, actualizat_la: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { eroare("salvează setările", error); return false; }
  return true;
}

/* ---------- vizitatorul (0115) ---------- */

/** Numele claselor cu tabla deschisă acum; `null` dacă nu se poate afla. */
export async function tableDeschise() {
  const { data, error } = await supabase.rpc("tabla_alba_deschise");
  if (error) { eroare("tablele deschise", error); return null; }
  return (Array.isArray(data) ? data : []).map((x) => String(x?.nume || "")).filter(Boolean);
}

/** Clasa după nume („10D"), cu starea și lecțiile ei, doar cât e vizibilă:
 *  `{ clasa }`, `{ clasa: null }` (închisă) ori `{ eroare }` (fără net). */
export async function intraCuClasa(nume) {
  const { data, error } = await supabase.rpc("tabla_alba_intra_clasa", { p_nume: nume });
  if (error) { eroare("intră", error); return { eroare: "fără legătură" }; }
  return data && UUID.test(String(data.id)) ? { clasa: data } : { clasa: null };
}

/** Mai e vizibilă tabla clasei? `null` dacă nu se poate afla (fără net). */
export async function tablaVizibila(clasaId) {
  const { data, error } = await supabase.rpc("tabla_alba_vizibila", { p_clasa: clasaId });
  if (error) { eroare("vizibilă", error); return null; }
  return data === true;
}

export async function paginileClasei(clasaId, lectieId) {
  const { data, error } = await supabase.rpc("tabla_alba_pagini_clasei", { p_clasa: clasaId, p_lectie: lectieId });
  if (error) { eroare("paginile", error); return null; }
  return Array.isArray(data) ? data : null;
}

export async function materialulClasei(clasaId, lectieId) {
  const { data, error } = await supabase.rpc("tabla_alba_material_clasei", { p_clasa: clasaId, p_lectie: lectieId });
  if (error) { eroare("materialul", error); return null; }
  return typeof data === "string" ? data : null;
}

/* ---------- canalul live ---------- */

/**
 * Deschide canalul clasei. `laMesaj(fel, payload)` primește tot ce vine (doar
 * la cine ascultă); `laLegatura(legat)` spune dacă e în picioare.
 * Întoarce `{ trimite(fel, payload), opreste() }`.
 */
export function canalul(clasaId, laMesaj, laLegatura = () => {}) {
  let canal = null;
  let oprit = false;
  /* Se trimite doar pe canalul intrat (SUBSCRIBED). Înainte de intrare, ori
     după o cădere, `send()` ar fi plecat pe REST, cu un avertisment că drumul
     acela se închide; ce e de trimis atunci așteaptă aici și pleacă la intrare. */
  let intrat = false;
  const asteapta = [];
  const pleaca = (fel, payload) => canal.send({ type: "broadcast", event: fel, payload }).catch(() => {});
  (async () => {
    try { await supabase.realtime.setAuth(); } catch { /* clienții vechi o fac singuri */ }
    if (oprit) return;
    canal = supabase.channel(`tabla-alba:${clasaId}`, { config: { private: true, broadcast: { self: false } } });
    canal.on("broadcast", { event: "*" }, (m) => { try { laMesaj(m.event, m.payload || {}); } catch (e) { eroare("mesaj", e); } });
    canal.subscribe((stare) => {
      if (oprit) return;
      intrat = stare === "SUBSCRIBED";
      if (intrat) while (asteapta.length) pleaca(...asteapta.shift());
      laLegatura(intrat);
    });
  })().catch((e) => { eroare("canal", e); laLegatura(false); });
  return {
    trimite(fel, payload) {
      if (canal && intrat) { pleaca(fel, payload); return; }
      /* Starea și desenul în curs contează doar ultimele; restul, în ordine. */
      if (fel === "stare" || fel === "tras") {
        const i = asteapta.findIndex(([f]) => f === fel);
        if (i >= 0) asteapta.splice(i, 1);
      }
      asteapta.push([fel, payload]);
      if (asteapta.length > 200) asteapta.shift();
    },
    opreste() {
      oprit = true;
      try { canal && supabase.removeChannel(canal); } catch { /* deja dus */ }
      canal = null;
    },
  };
}
