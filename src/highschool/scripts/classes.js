// =========================================================
// CLASELE DE LICEU ALE LUI MARIUS, într-un singur loc.
//
// Șapte clase, fiecare cu nuanța ei. Nuanțele sunt ales depărtate una de alta pe
// roata culorilor (în jur de 50 de grade între vecine), ca să se deosebească de
// la câțiva metri, de pe tabla din clasă, nu doar de la treizeci de centimetri.
//
// `hue` e un unghi OKLCH, nu o culoare scrisă de-a gata: cardul își face din el
// și fundalul, și marginea, și umbra, toate cu aceeași luminozitate. Cu șapte
// culori scrise de mână, una ar fi ieșit mai închisă decât celelalte și cardul
// ei ar fi părut apăsat.
// Cuprins în română, nume în engleză.
// =========================================================

/** Cifra din capul clasei, cu numeral românesc: „11B" → „a XI-a B". */
const ROMANE = { 9: "a IX-a", 10: "a X-a", 11: "a XI-a", 12: "a XII-a" };

export const CLASE = [
  { cod: "9B",  hue: 250 },
  { cod: "10D", hue: 300 },
  { cod: "11B", hue: 350 },
  { cod: "11C", hue: 40 },
  { cod: "11D", hue: 95 },
  { cod: "12C", hue: 155 },
  { cod: "12D", hue: 205 },
].map((c) => {
  const m = c.cod.match(/^(\d+)([A-Z])$/);
  const an = m ? Number(m[1]) : 0;
  return {
    ...c,
    an,
    litera: m ? m[2] : "",
    /* „a XI-a B", cum se scrie în catalog. */
    nume: m ? `${ROMANE[an] || an} ${m[2]}` : c.cod,
  };
});

export const clasaDupaCod = (cod) =>
  CLASE.find((c) => c.cod.toLowerCase() === String(cod || "").toLowerCase()) || null;
