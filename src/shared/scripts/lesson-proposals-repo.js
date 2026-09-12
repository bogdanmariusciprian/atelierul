// =========================================================
// LECȚIILE PROPUSE DE ELEVI (migrarea 0089).
//
// Elevul cu dreptul dat de profesor scrie o lecție; profesorul o citește, o
// îndreaptă dacă vrea și o publică. Lecția publicată se vede pe sit, la
// `/lectii/propuse/#adresa-ei`, fără commit.
//
// DE CE E UN FIȘIER AL LUI, și nu încă o bucată în `events-repo.js`: acolo stă
// marcarea elevului la meditații, care e altă treabă. Drepturile care se dau
// din aceeași pagină nu sunt, prin asta, aceeași funcționalitate.
//
// TOATE SCRIERILE ÎȘI ÎNTORC SOARTA, nu o înghit. Un buton care se aprinde pe
// ecran peste o scriere care n-a avut loc e felul în care un elev rămâne fără
// dreptul pe care crezi că i l-ai dat (pățit la marcarea de la meditații, vezi
// `events-repo.js`).
//
// PAZA NU E AICI. Baza verifică singură cine cere: `set_lesson_access` și
// coada cer rolul de profesor, iar scrierea elevului trece prin RLS, care cere
// dreptul. Dacă ar ocoli cineva pagina, tot ar fi refuzat.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "./supabase-client.js";

/* ---------- dreptul, pe cont ---------- */

/** Cine are voie să propună lecții. Cerere SEPARATĂ de lista de conturi,
 *  dinadins: `admin_list_users()` are coloane fixe, iar dacă i-aș fi adăugat
 *  una, pagina Conturi ar fi rămas fără listă între push și aplicarea
 *  migrării. Așa, până se aplică, doar butoanele rămân stinse. */
export async function fetchLessonAuthors() {
  const { data, error } = await supabase.rpc("admin_lesson_authors");
  if (error) {
    console.warn("fetchLessonAuthors:", error.message);
    return new Set();
  }
  return new Set(data || []);
}

/** Pornește ori oprește dreptul unui cont. */
export async function setLessonAccess(userUuid, on) {
  const { data, error } = await supabase.rpc("set_lesson_access", {
    p_user: userUuid, p_on: !!on,
  });
  if (error) {
    console.warn("setLessonAccess:", error.message);
    return { ok: false, message: "N-am putut salva dreptul. Încearcă din nou." };
  }
  /* Funcția întoarce `false` când n-a găsit contul: altfel butonul s-ar aprinde
     peste o scriere care n-a atins pe nimeni. */
  if (data === false) {
    return { ok: false, message: "N-am găsit contul acesta. Reîncarcă pagina." };
  }
  return { ok: true };
}

/** Am eu voie să propun lecții? Întrebat de bază, nu ghicit din profil. */
export async function canProposeLesson() {
  const { data, error } = await supabase.rpc("poate_propune_lectie");
  if (error) { console.warn("canProposeLesson:", error.message); return false; }
  return !!data;
}

/* ---------- propunerile elevului ---------- */

/** Lecțiile mele, cu tot cu cele hotărâte: elevul trebuie să vadă și ce i s-a
 *  respins, și de ce. */
export async function myLessonProposals() {
  const { data, error } = await supabase
    .from("learn_lesson_proposals")
    .select("id, title, domain, body, status, slug, note, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("myLessonProposals:", error.message);
    throw new Error(error.message || "nu s-am putut citi propunerile tale");
  }
  return data || [];
}

export async function createLessonProposal({ title, domain, body } = {}) {
  const { data: sesiune } = await supabase.auth.getUser();
  const authId = sesiune?.user?.id;
  if (!authId) return { ok: false, message: "Trebuie să fii autentificat." };

  const { data, error } = await supabase
    .from("learn_lesson_proposals")
    .insert({ author_id: authId, title: String(title || "").trim(),
              domain: String(domain || "").trim(), body: String(body || "").trim() })
    .select("id").single();
  if (error) {
    console.warn("createLessonProposal:", error.message);
    /* 42501 = RLS a refuzat. Aproape mereu înseamnă că dreptul n-a fost dat
       ori a fost retras între timp; e singurul mesaj care ajută. */
    if (error.code === "42501") {
      return { ok: false, message: "Nu ai (încă) dreptul de a propune lecții." };
    }
    if (error.code === "23514") {
      return { ok: false, message: "Titlul ori textul nu se încadrează în măsuri." };
    }
    return { ok: false, message: "N-am putut trimite propunerea. Încearcă din nou." };
  }
  return { ok: true, id: data?.id };
}

export async function updateLessonProposal(id, { title, domain, body } = {}) {
  const schimbari = {};
  if (title !== undefined) schimbari.title = String(title).trim();
  if (domain !== undefined) schimbari.domain = String(domain).trim();
  if (body !== undefined) schimbari.body = String(body).trim();
  const { error } = await supabase
    .from("learn_lesson_proposals").update(schimbari).eq("id", id);
  if (error) {
    console.warn("updateLessonProposal:", error.message);
    return { ok: false, message: "N-am putut salva schimbarea." };
  }
  return { ok: true };
}

/** Retragerea propriei propuneri, cât n-a fost citită. */
export async function deleteLessonProposal(id) {
  const { error } = await supabase
    .from("learn_lesson_proposals").delete().eq("id", id);
  if (error) {
    console.warn("deleteLessonProposal:", error.message);
    return { ok: false, message: "N-am putut retrage propunerea." };
  }
  return { ok: true };
}

/* ---------- coada profesorului ---------- */

/** Propunerile în așteptare, cu numele autorului. Prin funcție: numele stă în
 *  `profiles`, de unde clientul n-are voie să ceară orice coloană. */
export async function pendingLessons() {
  const { data, error } = await supabase.rpc("admin_pending_lessons");
  if (error) { console.warn("pendingLessons:", error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id, authorId: r.author_id, authorName: r.author_name,
    title: r.title, domain: r.domain, body: r.body,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

/** Publică lecția. Titlul și textul se pot îndrepta chiar aici: de cele mai
 *  multe ori asta se și face, iar un drum în doi pași s-ar rupe la mijloc. */
export async function publishLesson(id, { title, body, slug } = {}) {
  const { data, error } = await supabase.rpc("publish_lesson", {
    p_id: id,
    p_title: title ?? null,
    p_body: body ?? null,
    p_slug: slug ?? null,
  });
  if (error) {
    console.warn("publishLesson:", error.message);
    return { ok: false, message: "N-am putut publica lecția." };
  }
  if (data?.error) return { ok: false, message: data.error };
  return { ok: true, slug: data?.slug, title: data?.title };
}

export async function rejectLesson(id, note) {
  const { data, error } = await supabase.rpc("reject_lesson", {
    p_id: id, p_note: note ?? null,
  });
  if (error) {
    console.warn("rejectLesson:", error.message);
    return { ok: false, message: "N-am putut respinge propunerea." };
  }
  if (data?.error) return { ok: false, message: data.error };
  return { ok: true };
}

/** Scoate lecția de pe sit fără s-o piardă: se întoarce în așteptare. */
export async function unpublishLesson(id) {
  const { data, error } = await supabase.rpc("unpublish_lesson", { p_id: id });
  if (error) {
    console.warn("unpublishLesson:", error.message);
    return { ok: false, message: "N-am putut scoate lecția de pe sit." };
  }
  if (data?.error) return { ok: false, message: data.error };
  return { ok: true };
}

/* ---------- lecțiile publicate ---------- */

/** Toate lecțiile publicate, pentru lista de lecții. Citibile de oricine,
 *  inclusiv de un vizitator nelogat: sunt conținut de sit. */
export async function publishedLessons() {
  const { data, error } = await supabase
    .from("learn_lesson_proposals")
    .select("id, title, domain, slug, published_at, author_id")
    .eq("status", "publicata")
    .order("published_at", { ascending: false });
  if (error) { console.warn("publishedLessons:", error.message); return []; }
  return data || [];
}

/** O lecție publicată, după adresa ei. `null` dacă nu există ori nu e publicată
 *  (pagina spune atunci limpede că lecția nu se găsește). */
export async function publishedLessonBySlug(slug) {
  const s = String(slug || "").trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("learn_lesson_proposals")
    .select("id, title, domain, body, slug, published_at, author_id")
    .eq("slug", s).eq("status", "publicata").maybeSingle();
  if (error) { console.warn("publishedLessonBySlug:", error.message); return null; }
  return data || null;
}
