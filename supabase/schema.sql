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
create policy "allow anon read reports"    on public.daily_reports for select using (true);
create policy "allow anon insert reports" on public.daily_reports for insert with check (true);
create policy "allow anon update reports" on public.daily_reports for update using (true) with check (true);
create policy "allow anon delete reports" on public.daily_reports for delete using (true);

-- ============================================================
-- 存储桶（Storage Bucket）
-- 请在 Supabase 控制台 → Storage → New bucket：
--   名称:  report-photos
--   公开(Public):  勾选 ✅
-- 本平台会把照片上传到  report-photos/{projectId}/{时间戳}_{随机}.jpg
-- 公开读策略在 bucket 设为 Public 后默认生效，无需额外 SQL。
-- ============================================================
