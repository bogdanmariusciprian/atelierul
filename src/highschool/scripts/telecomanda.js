// =========================================================
// TELECOMANDA: laptopul conduce, tabla urmează.
//
// Un canal Supabase Realtime, pe care scrie numai profesorul, dar îl poate
// asculta oricine intră în modul – și tabla, care nu e logată în niciun cont, și
// un elev care vrea lecția pe ecranul lui (migrarea 0100). Situl stă pe GitHub
// Pages, fără server al lui, deci ăsta e singurul drum pe care poate veni o
// împingere din afară într-o filă deschisă.
//
// 1. ÎNTR-O SINGURĂ DIRECȚIE, DINADINS. Cine conduce trimite; cine urmează
//    numai pune. Tabla nu răspunde niciodată înapoi – așa nu există ecou, nici
//    întrebarea „cine are dreptate", nici două aparate care se trag unul pe
//    altul. Cerut de Marius, și e alegerea bună. Acum, când poate asculta
//    oricine, e și paza: un ascultător n-are ce trimite.
//
// 2. CEL CARE URMEAZĂ NU SCOATE NICIO VORBĂ. Nici măcar „am intrat, unde
//    ești?" – fiindcă vorba aia ar fi o scriere, iar scrierea e numai a
//    profesorului. Așa, ascultătorul e mut pe bune, nu doar din bună purtare.
//    Tabla pornită după laptop n-ar fi știut de una singură la ce slide e, așa
//    că nu întreabă ea: SPUNE CEL CARE CONDUCE, din când în când, chiar dacă
//    nu s-a schimbat nimic. Costă un mesaj la trei secunde și scapă de
//    întrebare cu totul.
//
// 3. PE CANAL NU TRECE NIMIC DE ASCUNS – fișa, numărul slide-ului și locurile
//    apăsate („al treilea copil al lui…"). Notițele se citesc din tabelul lor,
//    de către aparatul care conduce, și nu pleacă mai departe niciodată.
//
// 4. MESAJELE VECHI SE ARUNCĂ. Fiecare poartă ceasul la care a fost trimis; pe
//    o rețea de școală, două mesaje se pot întoarce pe dos, iar tabla ar fi
//    sărit înapoi cu un slide fără să priceapă nimeni de ce.
//
// 5. JURNALUL MERGE ÎNTREG DE FIECARE DATĂ, nu doar apăsarea de acum. Pare
//    risipă și nu e: așa, un mesaj pierdut nu lasă tabla în urmă pe tăcute. Ea
//    își vede lista, o compară cu a ta, și dacă a rămas în urmă ia fișa de la
//    capăt și reface apăsările în ordine. Tot de-aici se pune la punct și o
//    tablă pornită la mijlocul orei: prinde toată ora din primul mesaj.
//    O oră are zeci de apăsări, nu mii; un drum are vreo cincisprezece litere.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "../../shared/scripts/supabase-client.js";

const SUBIECT = "liceu:telecomanda";

/* Oprire de siguranță pentru jurnal. Nicio oră n-are atâtea apăsări; e pusă ca
   un mesaj să nu crească niciodată spre pragul de 256 KB al canalului, orice
   s-ar întâmpla (o apăsare ținută apăsată, un aparat luat razna). */
export const MAX_JURNAL = 2000;

/**
 * Deschide legătura.
 *
 * @param {object} cfg
 * @param {"conduc"|"urmez"} cfg.rol
 * @param {(s: {fisa: string, slide: number, jurnal: string[]}) => void} cfg.peStare  numai la „urmez"
 * @param {() => ({fisa: string, slide: number, jurnal: string[]} | null)} cfg.stareaMea  numai la „conduc"
 * @param {(cum: "leg"|"legat"|"rupt", vina?: string) => void} cfg.peLegatura
 */
export function telecomanda({ rol, peStare, stareaMea, peLegatura }) {
  let canal = null;
  let ultimulCeas = 0;
  let oprit = false;

  const spune = (cum, vina) => { try { peLegatura?.(cum, vina); } catch { /* n-are ce strica */ } };

  async function porneste() {
    spune("leg");
    try {
      /* Canalul privat cere ca Realtime să știe cine ești. `setAuth` fără
         argument ia chiar cheia sesiunii de acum; fără ea, intrarea pe canal e
         refuzată de politici și n-ai înțelege de ce. */
      await supabase.realtime.setAuth();
    } catch { /* clienții mai vechi o fac singuri */ }

    canal = supabase.channel(SUBIECT, { config: { private: true } });

    if (rol === "urmez") {
      canal.on("broadcast", { event: "stare" }, ({ payload }) => {
        if (!payload || typeof payload.ceas !== "number") return;
        if (payload.ceas < ultimulCeas) return;   // mesaj întors pe dos
        ultimulCeas = payload.ceas;
        peStare?.({
          fisa: payload.fisa,
          slide: Number(payload.slide) || 0,
          /* Jurnalul se curăță AICI, la intrare: mai departe se apasă după el,
             iar un rând care nu e text ar fi umblat prin pagina fișei. */
          jurnal: Array.isArray(payload.jurnal)
            ? payload.jurnal.filter((c) => typeof c === "string")
            : [],
        });
      });
    }

    canal.subscribe((stare, vina) => {
      if (oprit) return;
      if (stare === "SUBSCRIBED") {
        spune("legat");
        return;
      }
      if (stare === "CHANNEL_ERROR" || stare === "TIMED_OUT" || stare === "CLOSED") {
        spune("rupt", vina?.message || stare);
      }
    });
  }

  /**
   * Trimite starea de acum. Numai cel care conduce.
   *
   * Trimite când s-a schimbat ceva – și, pe deasupra, o dată la trei secunde
   * chiar dacă nu s-a schimbat nimic. Repetarea aia e tot rostul: cine intră pe
   * canal la mijlocul orei află singur unde suntem, fără să ceară, fiindcă n-are
   * voie să ceară. `silit` o trimite pe loc, oricum ar fi.
   */
  const REPETA = 3000;
  let ultimaTrimisa = "";
  let ultimaClipa = 0;
  function trimite(silit = false) {
    if (rol !== "conduc" || !canal) return;
    const s = stareaMea?.();
    if (!s) return;
    const acum = Date.now();
    const jurnal = Array.isArray(s.jurnal) ? s.jurnal.slice(0, MAX_JURNAL) : [];
    /* În amprentă intră și CÂTE apăsări sunt, nu și care: o apăsare nouă se
       vede în număr, iar numărul e de o mie de ori mai ieftin de comparat de
       trei ori pe secundă decât toată lista. */
    const amprenta = `${s.fisa}|${s.slide}|${jurnal.length}`;
    const seRepeta = acum - ultimaClipa >= REPETA;
    if (!silit && !seRepeta && amprenta === ultimaTrimisa) return;
    ultimaTrimisa = amprenta;
    ultimaClipa = acum;
    canal.send({
      type: "broadcast", event: "stare",
      payload: { fisa: s.fisa, slide: s.slide, jurnal, ceas: acum },
    }).catch(() => {});
  }

  /* Pornirea e asincronă; orice cădere de-a ei se spune pe bară, nu se scapă
     ca respingere neprinsă în mijlocul orei. */
  porneste().catch((e) => spune("rupt", e?.message || String(e)));

  return {
    trimite,
    opreste() {
      oprit = true;
      try { canal && supabase.removeChannel(canal); } catch { /* deja dus */ }
      canal = null;
    },
  };
}
