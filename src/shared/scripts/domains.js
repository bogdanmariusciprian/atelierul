// =========================================================
// Lesson domains — single source of truth (DRY).
// Reused on Home, Lessons page, menus, filters, etc.
// `slug` = code-safe id (English-style, no diacritics);
// `label` = what the user sees (Romanian).
// =========================================================
export const LESSON_DOMAINS = [
  { slug: "morfologie", label: "Morfologie", color: "#6d28d9", icon: "🔤", watermark: "assets/icons/group-arrows-rotate.svg" },
  { slug: "vocabular", label: "Vocabular", color: "#16a34a", icon: "💬", watermark: "assets/icons/notebook.svg" },
  { slug: "fonetica", label: "Fonetică", color: "#dc2626", icon: "🔊", watermark: "assets/icons/phone-flip.svg" },
  { slug: "sintaxa-frazei", label: "Sintaxa frazei", color: "#2563eb", icon: "🧩", watermark: "assets/icons/calendar-lines-pen.svg" },
  { slug: "redactare", label: "Redactare", color: "#0891b2", icon: "✍️", watermark: "assets/icons/pencil.svg" },
  { slug: "lectura", label: "Lectură", color: "#ea580c", icon: "📖", watermark: "assets/icons/book-open-cover.svg" },
];
