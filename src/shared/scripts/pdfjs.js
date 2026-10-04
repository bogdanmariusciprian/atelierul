// =========================================================
// pdf.js, adus o singură dată, pentru tot situl: fișele PDF din modulul Liceu
// (`pdf-desen.js`) și lecțiile PDF de la Literatură (liceu) (`pdf-lesson.js`).
//
// BIBLIOTECA VINE DIN AFARĂ, de pe `esm.sh`, de unde vine deja și Supabase.
// Versiunea e scrisă pe de-a-ntregul, nu „ultima din familia 6": o lecție nu
// are voie să se strice într-o dimineață fiindcă a urcat cineva o versiune nouă
// peste noapte. Când vrem alta, o schimbăm aici, cu ochii pe ea.
//
// DESPRE LUCRĂTORUL LUI PDF.JS. Biblioteca își face treaba grea într-un
// „worker", iar un worker NU poate fi pornit de la o adresă de pe alt domeniu –
// browserul o refuză. Nu ne luptăm cu asta: îi spunem unde e fișierul și lăsăm
// pdf.js să aleagă. Dacă nu poate porni workerul, are singur o cale de rezervă
// prin care aduce același cod și-l rulează pe firul paginii. Mai încet, dar
// merge.
// =========================================================

const PDFJS = "https://esm.sh/pdfjs-dist@6.3.289/build/pdf.mjs";
const LUCRATOR = "https://esm.sh/pdfjs-dist@6.3.289/build/pdf.worker.mjs";

let biblioteca = null;

/** Aduce pdf.js o singură dată, cât ține fila. */
export async function aduPdfjs() {
  if (biblioteca) return biblioteca;
  const pdfjs = await import(/* @vite-ignore */ PDFJS);
  try { pdfjs.GlobalWorkerOptions.workerSrc = LUCRATOR; }
  catch { /* fără worker, pdf.js merge pe firul paginii */ }
  biblioteca = pdfjs;
  return pdfjs;
}
