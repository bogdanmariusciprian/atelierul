# Atelierul-LRO

Platformă de învățare pentru **Limba și literatura română**, live pe
[atelierulderomana.ro](https://atelierulderomana.ro).

## Zone
1. **Lecții** interactive pe domenii (morfologie, sintaxă, vocabular, fonetică,
   redactare, lectură), cu exerciții cu feedback instant și progres salvat pe cont.
2. **Teste** — modele pentru examene și admitere (mini-joc cheat-safe pe banca de itemi).
3. **Comunitate** — login cu Google, profiluri, forum (postări, comentarii indentate,
   like-uri, insigne, notificări realtime, exerciții propuse), puncte, clasament,
   grupuri, provocarea zilei, mesagerie și caiet personal.

## Tehnologii
- HTML, CSS și JavaScript **vanilla** cu **module ES** (fără build step).
- [Supabase](https://supabase.com) (Postgres + RLS + Auth Google) pentru date și autentificare.
- Găzduire pe **GitHub Pages**, domeniu custom (CNAME).

## Structura
Paginile LIVE sunt folderele cu **URL curat** din rădăcină; logica (scripturi,
stiluri, componente) trăiește sub `src/`, scrisă o singură dată (**DRY**).
```
Atelierul-LRO/
├── index.html                     # Home
├── lectii/  teste/  comunitate/  despre/  confidentialitate/  termeni/
│                                  # paginile live; comunitate/ are login/ + descopera/
├── in-curand/  404.html           # poartă pre-lansare + router URL-uri curate
├── src/
│   ├── site/{scripts,styles}/         # lecții + teste
│   ├── community/{scripts,styles}/    # forum, profiluri, hub
│   └── shared/
│       ├── components/                # header + footer (site-chrome.js)
│       ├── styles/                    # variables, base, layout, main
│       └── scripts/                   # config, supabase-client, auth, repo-uri, utilitare
├── assets/                        # imagini, logo, iconițe, avataruri
├── supabase/migrations/           # schema + migrări (0001…)
├── manifest.webmanifest  sw.js  robots.txt  sitemap.xml  CNAME  .nojekyll
└── config/.env.example
```

## Rulare locală
Module ES → deschide printr-un server local (nu direct din fișier):
```bash
python -m http.server 8000   # apoi http://localhost:8000
```

## Configurare Supabase
1. Proiect pe supabase.com; aplică migrările din `supabase/migrations/` **în ordine**.
2. Copiază `config/.env.example` în `.env` (valori reale; `.env` e git-ignorat).
3. Pune valorile publice (URL + publishable key) în `src/shared/scripts/config.js`.

## Status
**Live**, în dezvoltare activă. Poarta de pre-lansare e pornită (doar conturile echipei
intră până la lansare; restul văd „în curând").
