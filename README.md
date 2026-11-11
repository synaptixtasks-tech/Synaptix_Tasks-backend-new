# Synaptix Tasks — backend

API zadań (todo) na **Cloudflare Workers**: Hono + Drizzle ORM + Cloudflare D1 (SQLite).
Port oryginalnego API z FastAPI — zachowuje kształt odpowiedzi (błędy walidacji w formacie Pydantic, daty jako `isoformat()` z offsetem `+00:00`).

## Wymagania

- Node.js 18+
- `npm install`

## Konfiguracja

Zmienne środowiskowe:

| Zmienna | Gdzie | Opis |
| --- | --- | --- |
| `SECRET_KEY` | sekret (`wrangler secret put` / `.dev.vars`) | klucz do podpisu JWT (np. `openssl rand -hex 32`) |
| `ALGORITHM` | `vars` w `wrangler.jsonc` | algorytm JWT (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `vars` w `wrangler.jsonc` | czas życia tokenu w minutach |

Sekret lokalnie — plik `.dev.vars` (jest w `.gitignore`):

```
SECRET_KEY=...
```

Na produkcji: `npx wrangler secret put SECRET_KEY`.

Hasła są hashowane PBKDF2-SHA256 (100k iteracji, natywne WebCrypto — brak zależności od bcrypt).

Baza D1 — w `wrangler.jsonc` ustaw `database_id` ze swojej instancji:

```sh
npx wrangler d1 create synaptix-tasks
```

## Migracje

```sh
npm run db:migrate:local    # lokalna baza (wrangler dev)
npm run db:migrate:remote   # produkcyjna baza D1
npm run db:generate         # nowa migracja po zmianie src/schema.ts
```

## Uruchomienie

```sh
npm run dev       # wrangler dev (lokalnie)
npm run deploy    # wrangler deploy --minify
```

## API

Wszystkie ścieżki poza `register`/`login` wymagają nagłówka `Authorization: Bearer <token>`.
Format odpowiedzi: camelCase, daty ISO 8601 (`toISOString()`).

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| `GET` | `/` | health check |
| `POST` | `/v1/auth/register` | rejestracja, body: `{ username, password }` → `{ accessToken, tokenType }` |
| `POST` | `/v1/auth/login` | logowanie, body: `{ username, password }` → `{ accessToken, tokenType }` |
| `GET` | `/v1/user` | dane aktualnego użytkownika |
| `PUT` | `/v1/user` | zmiana profilu, body: `{ username?, password? }` (minimum jedno pole) |
| `DELETE` | `/v1/user` | usunięcie konta (zadania usuwa kaskada FK) |
| `POST` | `/v1/tasks` | utworzenie zadania, body: `{ title, description?, completed?, id? }` |
| `GET` | `/v1/tasks?lastSync=<iso-datetime>` | lista niezdeletowanych zadań; z `lastSync` — tylko zmienione po tym czasie (sync) |
| `GET` | `/v1/tasks/:id` | pojedyncze zadanie |
| `PUT` | `/v1/tasks/:id` | aktualizacja (partial update — tylko przesłane pola) |
| `DELETE` | `/v1/tasks/:id` | soft delete (ustawia `isDeleted`) |

Kody błędów: `400` błąd walidacji (`{ error: { formErrors, fieldErrors } }` — `z.flattenError`), `401` brak/złe uwierzytelnienie, `404` brak zasobu, `409` konflikt (duplikat username / istniejące `task.id`).

## Struktura

```
src/
├── index.ts          # aplikacja: CORS, middleware, montowanie rout
├── routes/user.ts    # auth (register/login) + profil
├── routes/tasks.ts   # CRUD zadań + lista (sync przez lastSync)
├── middleware.ts     # dbMiddleware, authMiddleware (JWT Bearer)
├── auth.ts           # PBKDF2 + tworzenie tokenu JWT
├── http.ts           # błędy 409, helper runQuery, serializacja odpowiedzi
├── models.ts         # schematy Zod + wrapper validator (zValidator + flattenError)
├── schema.ts         # tabele Drizzle (D1/SQLite)
└── database.ts       # instancja Drizzle na bindingu D1
```
