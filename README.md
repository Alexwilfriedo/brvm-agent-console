# BRVM Agent — Console d'administration

Interface web pour superviser et piloter le service FastAPI [`brvm-agent`](../brvm-agent).

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind v4** (tokens CSS custom, navy `#0A2540` + or `#C9A961`)
- **Lexend** (UI) + **JetBrains Mono** (données) — cohérent avec l'email
- **TanStack Query** pour le cache/refetch
- **React Router** côté client
- Auth via header `X-Admin-Token` (stocké en localStorage)

Pas de SSR, pas de SEO — c'est un admin authentifié.

## Développement local

```bash
npm install
npm run dev        # http://localhost:5173
```

Le dev server proxifie `/api`, `/health` et `/preview` vers `http://localhost:8000`
(backend FastAPI local). Pas de config CORS nécessaire en dev.

Pré-requis :
- Backend `brvm-agent` qui tourne sur `:8000`
- Postgres local accessible (la DB backend doit répondre)

## Déploiement

SPA statique → Vercel / Netlify / Cloudflare Pages.

```bash
npm run build      # produit dist/
```

Définir `VITE_API_URL=https://brvm-agent.up.railway.app` côté hébergeur.
Le backend doit activer CORS pour l'origine du front (voir `brvm-agent/src/main.py`).

## Structure

```
src/
├── components/
│   ├── layout/       # Layout, sidebar, PageHeader
│   └── ui/           # Button, Card, Badge, Input (primitives maison)
├── features/
│   └── auth/         # token storage + guard
├── lib/
│   ├── api.ts        # fetch wrapper + ApiError
│   ├── cn.ts         # tailwind-merge helper
│   └── types.ts      # types miroirs de l'API
├── pages/            # routes top-level
├── App.tsx           # router + QueryClientProvider
└── main.tsx          # entry
```

## À faire

- [ ] Pages Briefs / Runs / Sources / Recipients / Schedule (stubs pour l'instant)
- [ ] Détail brief avec aperçu inline (iframe)
- [ ] Graphes historiques (recharts) sur le dashboard
- [ ] Auto-refresh en cas de run en cours (polling serré)
