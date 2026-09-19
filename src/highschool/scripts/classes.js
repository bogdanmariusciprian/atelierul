// =========================================================
// CLASELE DE LICEU ALE LUI MARIUS, într-un singur loc.
//
// Șapte clase, fiecare cu nuanța ei. Nuanțele sunt alese depărtate una de alta
// pe roata culorilor (în jur de 50 de grade între vecine), ca să se deosebească
// de la câțiva metri, de pe tabla din clasă, nu doar de la treizeci de
// centimetri.
//
// `hue` e un unghi OKLCH, nu o culoare scrisă de-a gata: cartonașul își face
// din el și fundalul, și marginea, și umbra, toate cu aceeași luminozitate. Cu
// șapte culori scrise de mână, una ar fi ieșit mai închisă decât celelalte și
// cartonașul ei ar fi părut apăsat.
//
// NU SE ȚINE ȘI NUMELE ÎN LITERE („a X-a D"): codul clasei îl spune deja.
// Scris pe același cartonaș, era același lucru de două ori.
// Cuprins în română, nume în engleză.
// =========================================================

/* `faraOre` = la clasa asta nu se înșiră orele din planificare. E scris ca
   însușire, nu ghicit din cifra clasei, ca să se poată pune pe una singură fără
   să umble nimeni prin ecrane.
   Acum nu-l poartă nicio clasă: clasele a 12-a l-au avut cât timp mergeau pe
   planificarea oficială, pe care n-o mai folosesc. Din migrarea 0093 orele lor
   sunt lecțiile de bacalaureat, iar acelea se înșiră ca la toate celelalte. */
/* NUANȚELE CELOR ȘAPTE N-AU FOST MIȘCATE când au venit 11F și 12F. Șirul lor
   mergea din cincizeci în cincizeci de grade; împărțit din nou la nouă, ar fi
   ieșit mai rânduit, dar toate cartonașele și-ar fi schimbat culoarea peste
   noapte, iar tu le știi deja. Cele două noi s-au strecurat în cele mai largi
   goluri rămase: 67 între 40 și 95, 125 între 95 și 155. */
export const CLASE = [
  { cod: "9B",  hue: 250 },
  { cod: "10D", hue: 300 },
  { cod: "11B", hue: 350 },
  { cod: "11C", hue: 40 },
  { cod: "11D", hue: 95 },
  { cod: "11F", hue: 125 },
  { cod: "12C", hue: 155 },
  { cod: "12D", hue: 205 },
  { cod: "12F", hue: 67 },
];

export const clasaDupaCod = (cod) =>
  CLASE.find((c) => c.cod.toLowerCase() === String(cod || "").toLowerCase()) || null;
