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
// 3. PE CANAL NU TRECE NIMIC DE ASCUNS – doar fișa și numărul slide-ului.
//    Notițele se citesc din tabelul lor, de către aparatul care conduce, și nu
//    pleacă mai departe niciodată.
//
// 4. MESAJELE VECHI SE ARUNCĂ. Fiecare poartă ceasul la care a fost trimis; pe
//    o rețea de școală, două mesaje se pot întoarce pe dos, iar tabla ar fi
//    sărit înapoi cu un slide fără să priceapă nimeni de ce.
// Cuprins în română, nume în engleză.
// =========================================================
import { supabase } from "../../shared/scripts/supabase-client.js";

const SUBIECT = "liceu:telecomanda";

/**
 * Deschide legătura.
 *
 * @param {object} cfg
 * @param {"conduc"|"urmez"} cfg.rol
 * @param {(s: {fisa: string, slide: number}) => void} cfg.peStare  numai la „urmez"
 * @param {() => ({fisa: string, slide: number} | null)} cfg.stareaMea  numai la „conduc"
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
        peStare?.({ fisa: payload.fisa, slide: Number(payload.slide) || 0 });
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
    const amprenta = `${s.fisa}|${s.slide}`;
    const seRepeta = acum - ultimaClipa >= REPETA;
    if (!silit && !seRepeta && amprenta === ultimaTrimisa) return;
    ultimaTrimisa = amprenta;
    ultimaClipa = acum;
    canal.send({
      type: "broadcast", event: "stare",
      payload: { fisa: s.fisa, slide: s.slide, ceas: acum },
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
