-- Add posts.user_id so list/detail responses can include
-- author { name, username, profilePic }.
-- Paste into the SQL Editor after 001. Do not apply from CI.
-- Nullable so existing posts without an author still load.

alter table public.posts
  add column if not exists user_id uuid references public.users (id) on delete set null;

create index if not exists posts_user_id_idx on public.posts (user_id);
