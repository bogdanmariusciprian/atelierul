// =========================================================
// Semnul „BAC" pe lecții (0103). Un rând în `lectii_bac` = o lecție marcată,
// după slug-ul ei stabil. Îl citește oricine (e conținut de sit), îl pune și
// îl scoate doar adminul; regula o ține baza, nu pagina.
// =========================================================
import { supabase } from "./supabase-client.js";

/** Slug-urile lecțiilor marcate „BAC". Gol dacă nu se poate citi (ori dacă
 *  0103 nu e încă rulată): lista arată atunci lecțiile fără semn, nu crapă. */
export async function bacSlugs() {
  const { data, error } = await supabase.from("lectii_bac").select("slug");
  if (error) { console.warn("bacSlugs:", error.message); return new Set(); }
  return new Set((data || []).map((r) => r.slug));
}

/**
 * Pune (`da = true`) ori scoate semnul. Întoarce ce a rămas în bază, nu ce s-a
 * cerut: dacă baza refuză, pagina arată adevărul.
 */
export async function puneBac(slug, da) {
  const s = String(slug || "").trim();
  if (!s) return { ok: false, bac: false };
  const { error } = da
    ? await supabase.from("lectii_bac").upsert({ slug: s }, { onConflict: "slug", ignoreDuplicates: true })
    : await supabase.from("lectii_bac").delete().eq("slug", s);
  if (error) console.warn("puneBac:", error.message);

  const { data } = await supabase.from("lectii_bac").select("slug").eq("slug", s).maybeSingle();
  const bac = !!data;
  return { ok: !error && bac === da, bac };
}
