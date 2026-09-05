-- ============================================================
-- 安装日报平台 · Supabase 数据库与存储 schema
-- 在 Supabase 控制台 → SQL Editor 中执行本文件
-- ============================================================

-- 项目表（可复用：支持多个项目）
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

-- 日报表
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  tech_name text,
  report_date date,
  weekday text,
  weather text,
  today_work text,
  tomorrow_plan text,
  progress text,
  issues text,
  photo_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists daily_reports_project_idx on public.daily_reports(project_id);
create index if not exists daily_reports_date_idx on public.daily_reports(report_date);

-- 行级安全策略（演示级：匿名可读写）。
-- ⚠️ 正式上线请改为「需登录」或「仅服务端 key 可写」：把 using(true)/with check(true)
--    换成 using(auth.uid() is not null) 或配合一张 members 表校验项目权限。
alter table public.projects enable row level security;
alter table public.daily_reports enable row level security;

create policy "allow anon read projects"   on public.projects      for select using (true);
create policy "allow anon insert projects" on public.projects      for insert with check (true);
-- 改名/删项目需要（缺这两条时，DELETE 会返回 204 但实际没删掉，PostgREST 静默行为）
drop policy if exists "allow anon update projects" on public.projects;
create policy "allow anon update projects" on public.projects for update using (true) with check (true);
drop policy if exists "allow anon delete projects" on public.projects;
create policy "allow anon delete projects" on public.projects for delete using (true);
create policy "allow anon read reports"    on public.daily_reports for select using (true);
create policy "allow anon insert reports" on public.daily_reports for insert with check (true);
create policy "allow anon update reports" on public.daily_reports for update using (true) with check (true);
create policy "allow anon delete reports" on public.daily_reports for delete using (true);

-- ============================================================
-- 存储桶（Storage Bucket）—— 用 SQL 直接建，无需去 Storage UI 点
-- ============================================================
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do update set public = true;

-- 允许匿名上传/读取 report-photos 桶内照片
drop policy if exists "anon upload report-photos" on storage.objects;
create policy "anon upload report-photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'report-photos');

drop policy if exists "public read report-photos" on storage.objects;
create policy "public read report-photos"
  on storage.objects for select to anon
  using (bucket_id = 'report-photos');

drop policy if exists "anon delete report-photos" on storage.objects;
create policy "anon delete report-photos"
  on storage.objects for delete to anon
  using (bucket_id = 'report-photos');

