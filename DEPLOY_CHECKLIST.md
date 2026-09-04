# 安装日报平台 · GitHub Pages 部署清单（可照做）

> 目标：把平台发布成一个公网网址，现场技术员用手机浏览器每天打开就能上报、传照片；你在后台随时查看、修改、下载照片、导出 Excel。
>
> ⚠️ **关于"数据不能丢"**：只部署静态网页（不接 Supabase）= 仍是**演示模式**，数据只存在技术员手机浏览器里，清缓存/换手机就会丢。**要让数据真正安全保存，必须完成下面「B. 接入云端」那一步**（数据存到 Supabase 云上）。A 步是网页发布，B 步才是数据安全。

---

## A. 发布网页到 GitHub Pages（约 5 分钟）

### A1. 在 GitHub 新建仓库
- 打开 https://github.com/new
- Repository name 填：`installation-daily`（或你喜欢的名字）
- 选 **Public**
- 不要勾选 "Add a README"（我们已有文件）
- 点 **Create repository**

### A2. 把平台文件推上去
电脑上打开终端，进入平台目录后执行（把 `<你的用户名>` 换成实际 GitHub 用户名）：

```bash
cd installation-daily-platform
git init
git add .
git commit -m "installation daily report platform"
git branch -M main
git remote add origin https://github.com/<你的用户名>/installation-daily.git
git push -u origin main
```

> 不会用命令？用 **GitHub Desktop**：File → Add Local Repository 选本目录 → Publish 到上面的仓库即可。

### A3. 开启 GitHub Pages
- 进仓库 → **Settings** → 左侧 **Pages**
- Source 选 **Deploy from a branch**
- Branch 选 **main**，目录选 **/ (root)**
- 点 **Save**
- 等 1–2 分钟，访问：`https://<你的用户名>.github.io/installation-daily/`

✅ 到此网页已上线。把这条网址发给技术员即可用手机打开。

---

## B. 接入云端（让数据真正保存、不丢失）—— 必做

### B1. 准备 Supabase（复用你现有项目或新建一个）
- 登录 https://supabase.com ，打开你 personal workbench 用的项目（或 New project 新建一个专用项目）
- 控制台 → **SQL Editor** → New query → 把 `supabase/schema.sql` 全文粘进去 → **Run**
  - 这会建好 `projects` / `daily_reports` 两张表 + 索引 + 匿名读写策略
- 控制台 → **Storage** → **New bucket**
  - Name：`report-photos`
  - 勾选 **Public**（公开读，技术员和管理端都能看图）
  - 点 **Create bucket**

### B2. 拿到凭证
- 控制台 → **Project Settings** → **API**
- 复制：
  - **Project URL**（形如 `https://xxxx.supabase.co`）
  - **anon public key**（Project API keys 里的 `anon` / `public`）

### B3. 填进配置
编辑 `config.js`：
```js
USE_SUPABASE: true,
SUPABASE_URL: "https://xxxx.supabase.co",          // 你的 Project URL
SUPABASE_ANON_KEY: "eyJhb...你的anon key",          // 你的 anon public key
ADMIN_CODE: "改成你自己的强口令",                    // 见 B5
```
保存后，重新走 A2 推一次代码（`git add config.js && git commit -m "enable cloud" && git push`）。

> 上线的 `config.js` 里只会含 **anon key**（本就是公开密钥，可放前端）。**绝不要**放 `service_role` key。

### B4. 验证云端连通
- 手机/电脑打开网址，进「技术员上报」填一条带图日报提交
- 进「管理后台」（访问码）→ 能看到刚提交的那条、能看图
- 换一台设备/清缓存再打开，数据还在 = 云端成功

### B5. 上线前安全（重要）
- 改 `config.js` 的 `ADMIN_CODE` 为强口令（默认 `admin888` 会被猜到）
- 当前策略允许匿名读写，适合内部小范围。**若要更严**：在 `schema.sql` 把 `using(true)` 改成 `using(auth.uid() is not null)` 并给技术员/你开通 Supabase 账号登录（README 第六节有说明）

---

## C. 日常使用
- **技术员（手机）**：打开网址 → 选/填项目、姓名、日期、天气 → 写今日完成/明日计划/进度/问题 → 拍照或相册多选传图 → 提交。每天收工后一条。
- **你（管理端）**：网址 → 管理后台（访问码）→ 按项目/日期/技术员筛选 → 查看、改文字、删、单张或批量下载照片 → 安装结束点「导出 Excel」生成汇总表。

---

## D. 部署后检查清单（勾选）
- [ ] A1 仓库已建（Public）
- [ ] A2 代码已推到 main
- [ ] A3 Pages 已开，能打开公网网址
- [ ] B1 已跑 schema.sql、已建 report-photos 公开桶
- [ ] B3 config.js 已填 URL/key 并重新推送
- [ ] B4 跨设备验证数据仍在（云端生效）
- [ ] B5 ADMIN_CODE 已改为强口令
- [ ] 已把网址发给技术员，并说明"每天一条、收工提交"

---

## 常见问题
- **页面打不开？** Pages 首次生效要 1–2 分钟；确认仓库是 Public、分支选对。
- **提交后管理端看不到？** 多半是 `USE_SUPABASE` 还是 false（演示模式，数据在提交那台设备）。确认 B3 已填且重新推送。
- **照片传不上去？** 确认 Storage 里 `report-photos` 桶是 Public，且 schema.sql 已 Run。
- **想换网址/绑自己域名？** GitHub Pages 支持 Custom domain，在 Settings → Pages 里填。
