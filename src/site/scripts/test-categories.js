// =========================================================
// Test categories — ONE source of truth (DRY), shared by:
//   • the /teste/ hub grid (tests-hub.js), and
//   • the five dedicated category pages (test-category.js).
// Each page borrows its category's colour, so the symbol and the page agree.
// Content Romanian, identifiers English.
// =========================================================
export const TEST_CATEGORIES = [
  { slug: "clasa-6", icon: "📘", color: "#0284c7", live: false,
    title: "Clasa a 6-a", desc: "Evaluarea Națională la clasa a VI-a — limbă și comunicare." },
  { slug: "clasa-8", icon: "📗", color: "#15803d", live: false,
    title: "Clasa a 8-a", desc: "Evaluarea Națională — limba și literatura română." },
  { slug: "clasa-12", icon: "🎓", color: "#6d28d9", live: false,
    title: "Clasa a 12-a", desc: "Bacalaureat — proba de limba și literatura română." },
  { slug: "admitere-politie", icon: "🛡️", color: "#1d4ed8", live: false,
    title: "Admitere Poliție", desc: "Subiecte de limba română pentru admiterea la Academia de Poliție." },
  { slug: "admitere-drept", icon: "⚖️", color: "#b45309", live: true,
    title: "Admitere Drept", desc: "Itemi de limba română de la admiterea la Facultatea de Drept (2002–2026)." },
];

export const TEST_CAT_BY_SLUG = Object.fromEntries(TEST_CATEGORIES.map((c) => [c.slug, c]));
