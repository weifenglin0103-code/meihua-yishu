-- 梅花易數排盤：Supabase 資料表與權限
-- 在 Supabase 後台 SQL Editor 整段貼上執行即可。
-- 設計：每筆紀錄屬於登入使用者本人（user_id = auth.uid()），開啟 RLS 後只有本人能讀、寫、刪自己的紀錄。

create table if not exists public.divination_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  question    text,
  method      text,
  record      jsonb not null          -- 完整紀錄（起卦輸入、上下卦、動爻、時間、結果摘要）
);

create index if not exists divination_logs_user_created_idx
  on public.divination_logs (user_id, created_at desc);

alter table public.divination_logs enable row level security;

drop policy if exists "own select" on public.divination_logs;
drop policy if exists "own insert" on public.divination_logs;
drop policy if exists "own delete" on public.divination_logs;

create policy "own select" on public.divination_logs
  for select to authenticated using (user_id = auth.uid());

create policy "own insert" on public.divination_logs
  for insert to authenticated with check (user_id = auth.uid());

create policy "own delete" on public.divination_logs
  for delete to authenticated using (user_id = auth.uid());

-- 未登入（anon）完全沒有任何政策，因此讀不到也寫不進任何資料。
-- 登入方式：Authentication → Providers 啟用 Email（Magic Link / OTP 即可，不必設密碼）。
-- 並在 Authentication → URL Configuration 的 Site URL / Redirect URLs 填入你放網站的網址。
