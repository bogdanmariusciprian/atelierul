// =========================================================
// DESENAREA UNUI PDF, ca să poată fi tăiat în fâșii.
//
// Un PDF nu se lasă tăiat cât timp e PDF: fiecare pagină se desenează întâi
// într-o pânză, la o lățime mare, și abia poza aceea se plimbă prin fereastra
// 16:9 (vezi `pdf-pagina.js`).
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
// prin care aduce același cod și-l rulează pe firul paginii. Mai încet, dar la
// o fișă de două-trei pagini nu se simte.
//
// DACĂ TOTUȘI NU MERGE, funcția aruncă, iar ecranul fișei arată limpede că
// desenul n-a ieșit și lasă la vedere descărcarea și deschiderea într-o filă
// nouă. Ora se ține mai departe; nu rămâi cu un dreptunghi alb în fața clasei.
//
// POZELE SUNT `data:`, nu `blob:`. O adresă `blob:` e mai ușoară, dar trăiește
// în cuprinsul care a făcut-o, iar pozele astea ajung într-o altă pagină, pusă
// tot dintr-un `blob:`. Merge, probabil, în toate browserele – „probabil" e
// prea puțin pentru opt dimineața.
// Cuprins în română, nume în engleză.
// =========================================================

const PDFJS = "https://esm.sh/pdfjs-dist@6.3.289/build/pdf.mjs";
const LUCRATOR = "https://esm.sh/pdfjs-dist@6.3.289/build/pdf.worker.mjs";

/* Lățimea la care se desenează o pagină. O A4 iese 1800 × 2546, adică peste 200
   de puncte pe țol: pe o tablă de 1920 fâșia umple lățimea fără să se vadă
   pixelii. Mai mult ar fi îngreunat pagina fără să se câștige nimic la ochi. */
const LATIME = 1800;

/* Peste atâtea pagini nu se mai desenează. O fișă de clasă are două-trei; o
   carte de o sută ar fi umflat pagina până la a îngheța fila, și e mai bine să
   se spună pe față decât să se blocheze tabla în timpul orei. */
const MAX_PAGINI = 40;

let biblioteca = null;

/** Aduce pdf.js o singură dată, cât ține fila. */
async function adubiblioteca() {
  if (biblioteca) return biblioteca;
  const pdfjs = await import(/* @vite-ignore */ PDFJS);
  try { pdfjs.GlobalWorkerOptions.workerSrc = LUCRATOR; }
  catch { /* fără worker, pdf.js merge pe firul paginii */ }
  biblioteca = pdfjs;
  return pdfjs;
}

/**
 * Desenează toate paginile unui PDF.
 *
 * @param {ArrayBuffer} octeti
 * @returns {Promise<{pagini: string[], masuri: {latime:number,inaltime:number}[]}>}
 */
export async function desenezaPdf(octeti) {
  const pdfjs = await adubiblioteca();
  /* Octeții se dau într-o copie: pdf.js și-i ia în stăpânire, iar dacă cineva
     deschide fișa a doua oară din aceiași octeți, ar găsi o mână goală. */
  const doc = await pdfjs.getDocument({ data: new Uint8Array(octeti.slice(0)) }).promise;

  const cate = Math.min(doc.numPages, MAX_PAGINI);
  const pagini = [];
  const masuri = [];

  for (let i = 1; i <= cate; i++) {
    const pagina = await doc.getPage(i);
    const fara = pagina.getViewport({ scale: 1 });
    const scara = LATIME / fara.width;
    const vedere = pagina.getViewport({ scale: scara });

    const panza = document.createElement("canvas");
    panza.width = Math.round(vedere.width);
    panza.height = Math.round(vedere.height);
    const desen = panza.getContext("2d", { alpha: false });
    /* Alb dedesubt: paginile de PDF sunt de obicei străvezii, iar o pânză goală
       e neagră la salvare. Fără rândul ăsta, fișa iese scris alb pe negru. */
    desen.fillStyle = "#ffffff";
    desen.fillRect(0, 0, panza.width, panza.height);

    await pagina.render({ canvasContext: desen, viewport: vedere }).promise;
    /* JPEG, nu PNG: la o pagină de text, PNG-ul iese de câteva ori mai mare, iar
       pagina ar fi ajuns la zeci de megaocteți. 0.85 e pragul de la care nu se
       mai vede deosebirea pe o tablă. */
    pagini.push(panza.toDataURL("image/jpeg", 0.85));
    masuri.push({ latime: panza.width, inaltime: panza.height });

    /* Pânza se golește imediat: altfel rămân în memorie zeci de megaocteți de
       pixeli pe care nu-i mai folosește nimeni. */
    panza.width = 0; panza.height = 0;
    pagina.cleanup();
  }

  try { await doc.destroy(); } catch { /* s-a dus oricum */ }
  return { pagini, masuri, sarite: doc.numPages - cate };
}
