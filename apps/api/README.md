# Data Room — API

NestJS + Prisma + PostgreSQL backend. Architecture, design decisions and the data model live in
the [root README](../../README.md); this file covers running and working on the API itself.

## Running locally

```bash
pnpm install                 # postinstall runs `prisma generate`
cp .env.example .env         # fill in the values — every variable is documented in the file
pnpm prisma migrate deploy   # apply migrations
pnpm start:dev               # watch mode on http://localhost:3000
```

`JWT_SECRET` is mandatory: the API refuses to boot without it rather than falling back to a
default. Generate one with `openssl rand -hex 32`.

Uploads cannot complete against `localhost` — the Vercel Blob callback has no route back to your
machine, so files stay `PENDING`. See the note in the root README.

## Scripts

| Command | What it does |
|---|---|
| `pnpm start:dev` | Watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run the compiled build |
| `pnpm lint` | ESLint with `--fix` |
| `pnpm prisma migrate dev --name <name>` | Create and apply a migration |
| `pnpm prisma studio` | Browse the database |

## Layout

```
src/
  auth/         registration, login, Google Sign-In, JWT strategy and guard
  data-rooms/   top-level rooms, contents listing, delete summary
  folders/      folder CRUD, breadcrumb path, recursive subtree summary
  files/        upload authorisation, blob streaming, rename/move/delete
  shares/       share CRUD and grants, access resolution, public link routes
  prisma/       PrismaService (global module)
  common/       shared decorators
```

## Endpoints

All routes require a bearer token except `/auth/*` and `/public/*`.

| Method | Path | |
|---|---|---|
| `POST` | `/auth/register` `/auth/login` `/auth/google` | issue a JWT |
| `GET` | `/auth/me` | current user |
| `GET/POST` | `/data-rooms` | list, create |
| `GET/PATCH/DELETE` | `/data-rooms/:id` | read, rename, delete |
| `GET` | `/data-rooms/:id/contents` | folders + files at a node |
| `GET` | `/data-rooms/:id/summary` | counts and size, for the delete warning |
| `GET/POST` | `/data-rooms/:id/folders` | list all, create |
| `GET/PATCH/DELETE` | `/data-rooms/:id/folders/:folderId` | read, rename, delete |
| `GET` | `/data-rooms/:id/folders/:folderId/path` | breadcrumb chain |
| `GET` | `/data-rooms/:id/folders/:folderId/summary` | recursive subtree totals |
| `POST` | `/data-rooms/:id/files/upload` | issue upload token / receive Vercel callback |
| `GET` | `/data-rooms/:id/files/search?q=` | file-name search across the whole room |
| `GET` | `/data-rooms/:id/files/:fileId/content` | stream the PDF |
| `PATCH` | `/data-rooms/:id/files/:fileId` `/…/move` | rename, move |
| `DELETE` | `/data-rooms/:id/files/:fileId` | delete file and blob |
| `GET/POST` | `/shares` | list for a resource, create |
| `DELETE` | `/shares/:shareId` | revoke |
| `POST/DELETE` | `/shares/:shareId/grants[/:grantId]` | add, remove a person |
| `GET` | `/public/:token` `/…/contents` `/…/files/:fileId/content` | unauthenticated read |

`POST /data-rooms/:id/files/upload` is intentionally not behind the auth guard: the same URL
also receives Vercel's upload-completed callback, which carries no JWT. That request is verified
by the SDK against the blob token; the user's own request is authenticated by hand inside the
service.

## Conventions

- Arrow functions throughout, except class methods.
- Not-found and not-authorised both return 404, so responses never confirm that a resource
  exists to someone who cannot see it.
- Read access accepts ownership *or* an active share (`getAccessible*`); writes are strictly
  owner-only (`getOwned*`). The two are separate helpers so a share can never satisfy a write.
- Prisma is pinned to 6.x — see the comment in `prisma/schema.prisma` before upgrading.
- Rate limited with `@nestjs/throttler`: 120 req/min globally, tightened to 5/min on the auth
  routes, 30/min on public share links, and 20/min on share creation. Over the limit returns
  429. The counters are in-memory, so with more than one API instance each would count
  separately — a shared store is the fix at that point.
- Uploads are capped at 50 MB, enforced inside the signed upload token so the blob store itself
  rejects an oversized file. The frontend checks the same limit only to fail fast.
- Configuration that would be dangerous to guess at fails closed: `JWT_SECRET`, `WEB_ORIGIN`
  and `GOOGLE_CLIENT_ID` all throw rather than falling back to a default.
