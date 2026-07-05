# Atelierul-LRO

Platformă de învățare pentru **Limba și literatura română**, cu trei zone:

1. **Site** (`src/site/`) — lecții interactive și subiecte de examen.
2. **Comunitate** (`src/community/`) — login cu Google, profiluri editabile, forum
   (postări, comentarii indentate, like-uri, badges, abonări/notificări, exerciții).
3. **Planificator** (`src/planner/`) — planificarea meditațiilor; acces acordat de profesor.

Cod partajat (header, footer, stiluri, auth, client Supabase) trăiește în
`src/shared/` și este scris o singură dată (principiul **DRY**).

## Tehnologii
- HTML, CSS și JavaScript **vanilla** cu **module ES** (fără build step).
- [Supabase](https://supabase.com) pentru bază de date și autentificare.

## Structura folderelor
```
Atelierul-LRO/
├── index.html                 # pagina Home
├── src/
│   ├── site/                  # (1) lecții + subiecte de examen
│   │   ├── pages/  styles/  scripts/
│   ├── community/             # (2) forum, profiluri, login
│   │   ├── pages/  styles/  scripts/
│   ├── planner/               # (3) planificator meditații
│   │   ├── pages/  styles/  scripts/
│   └── shared/                # cod comun (DRY)
│       ├── components/        # header + footer (site-chrome.js)
│       ├── styles/            # variables, base, layout, main
│       └── scripts/           # config, supabase-client, auth
├── assets/                    # images, logo, icons, fonts
├── supabase/                  # plan bază de date + migrations
├── config/                    # .env.example
└── docs/                      # documentație
```

## Rulare locală
Fiind module ES, deschide printr-un server local (nu direct din fișier):
```bash
# din folderul proiectului
python -m http.server 8000
# apoi deschide http://localhost:8000
```

## Configurare Supabase
1. Creează un proiect pe supabase.com.
2. Copiază `config/.env.example` în `.env` și completează valorile.
3. Pune valorile publice (URL + anon key) în `src/shared/scripts/config.js`.
4. Detalii despre schema bazei de date: `supabase/README.md`.

## Status
Structură **macro** inițială. Conținutul concret (lecții, forum, planificator)
se adaugă pe parcurs, de la macro la micro.
