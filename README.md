# backend-express-server

Express API for the personal blog. Postgres is queried with `pg`; Auth and Storage use `@supabase/supabase-js`.

Schema for a fresh Supabase project:

1. Paste `db/migrations/001_init.sql` into the SQL Editor (already applied on the new project).
2. Paste `db/migrations/002_posts_user_id.sql` next (adds `posts.user_id`). Do not apply from CI.

## API contract

Base URL: the Vercel deployment. Auth header: `Authorization: Bearer <access_token>`.

### Auth

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | `{ email, password, username, name }` | `201 { message, user }` |
| POST | `/auth/login` | public | `{ email, password }` | `200 { message, access_token, user }` — token field is **`access_token` only** (no `accessToken`) |
| GET | `/auth/get-user` | user | — | `200 { id, email, username, name, role, profilePic }` from `public.users` (+ email from Auth) |
| PUT | `/auth/update-profile` | user | JSON or multipart: `name`, `username`, optional `imageFile` → Storage `my-personal-blog/profiles/` | `200 { id, email, username, name, role, profilePic }` |
| PUT | `/auth/reset-password` | user | `{ oldPassword, newPassword }` | `200 { message }` |

### Categories

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/categories` | public | — | `200 [{ id, name }, ...]` |
| GET | `/categories/:id` | public | — | `200 { id, name }` |
| POST | `/categories` | admin | `{ name }` | `201 { id, name }` |
| PUT | `/categories/:id` | admin | `{ name }` | `200 { id, name }` |
| DELETE | `/categories/:id` | admin | — | `200 { id, name }` |

### Posts

Every post object:

```json
{
  "id": 1,
  "image": "https://...",
  "category": "Cat",
  "title": "...",
  "description": "...",
  "date": "...",
  "content": "...",
  "status": "published",
  "likes_count": 0,
  "author": { "name": "...", "username": "...", "profilePic": null }
}
```

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/posts` | public | Only `status_id = 2` (published). Query: `page`, `limit`, `category` (name), `keyword`. |
| GET | `/posts?status=all` | admin JWT (`role=admin`) | All statuses. Non-admins are still limited to published. |
| GET | `/posts?status=draft` | admin JWT | Only `status_id = 1`. |
| GET | `/posts/:id` | public | Published only. Admin JWT can read drafts. |
| POST | `/posts` | admin | JSON or multipart (`imageFile`). Sets `posts.user_id` from the admin. `201 { message, id }` |
| PUT | `/posts/:id` | admin | JSON body of post fields. |
| DELETE | `/posts/:id` | admin | — |

### Comments

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/posts/:id/comments` | public | — | `200` array of `{ id, post_id, user_id, comment_text, created_at, name, username, profilePic }` |
| POST | `/posts/:id/comments` | user | `{ comment }` | `201` same comment shape |

### Likes

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| POST | `/posts/:id/likes` | user | `201 { likes_count, liked: true }` |
| DELETE | `/posts/:id/likes` | user | `200 { likes_count, liked: false }` |

Post list/detail already include `likes_count`.

Statuses: `1 = draft`, `2 = published`. After first register, promote an admin:

```sql
update public.users set role = 'admin' where username = 'YOUR_USERNAME';
```

## Environment variables (Vercel)

Set these in the Vercel project **Settings → Environment Variables**. Placeholders only — never put real secrets in git.

| Variable | Placeholder | Notes |
| --- | --- | --- |
| `CONNECTION_STRING` | `postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` | **Pooled** URI (Supavisor / pgBouncer, port **6543**). Do **not** use the direct URI `db.[PROJECT_REF].supabase.co:5432` — IPv6-only; Vercel is IPv4. |
| `SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | Project URL for Auth and Storage. |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[PAYLOAD].[SIGNATURE]` | Anon / publishable key. Do **not** set `service_role`. |
| `PORT` | `4000` | Optional locally. Vercel sets `PORT`. |

`VERCEL` is set automatically by Vercel.
