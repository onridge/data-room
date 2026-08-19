# Data Room — Web

React + TypeScript + Vite frontend, styled with Tailwind v4 and shadcn/ui. Architecture and
design decisions live in the [root README](../../README.md); this file covers running and
working on the frontend itself.

## Running locally

```bash
pnpm install
cp .env.example .env.local   # VITE_API_URL must point at a running API
pnpm dev                     # http://localhost:5173
```

Vite inlines `VITE_*` variables into the bundle at build time, so they are public by design and
must be set *before* the build. On Vercel, changing one requires a redeploy to take effect.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Type-check, then production build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` | ESLint |

## Layout

```
src/
  pages/        one component per route
  components/   dialogs and shared pieces; ui/ holds shadcn primitives
  hooks/        useFileUpload — validation, progress, drag & drop, post-upload polling
  lib/          API clients (one module per resource), auth context, formatters
```

**Routes:** `/login`, `/register`, `/` (data rooms), `/data-rooms/:id` (browser),
`/share/:token` (public read-only view). Everything except the auth pages and the public share
view sits behind `ProtectedRoute`.

## Conventions

- Arrow functions throughout.
- Dialogs own their own state and data fetching, and are rendered only when they have a target —
  so state initialises straight from props with no seeding effect. Pages track just which dialog
  is open.
- Shared where the shapes genuinely match: one `RenameDialog` serves folders and files, and one
  `DeleteConfirmDialog` backs all three delete flows.
- API errors surface as `ApiError` with the server's message, unwrapped by an axios interceptor
  in `lib/api.ts`, so components can show the real reason rather than a generic failure.

## PDF viewing

Rendered in-app with `react-pdf` (pdf.js). The worker is committed as a static asset at
`public/pdf.worker.min.mjs` rather than imported, because this Vite/Rolldown setup cannot
resolve a `?url` import of a file inside `node_modules`. If `react-pdf` is upgraded, replace
that file with the `pdf.worker.min.mjs` from the matching `pdfjs-dist` version — a mismatch
fails at runtime, not at build time.
