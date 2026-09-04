# 安装日报平台（Installation Daily Report Platform）

面向海外现场技术员与国内管理方的轻量日报协作工具。技术员在当地用手机浏览器上报每日工作、进度与现场照片；管理方在网页端查看、审查修改、批量下载照片、导出 Excel。

## 两种运行模式

| 模式 | 数据存储 | 适用场景 |
|------|----------|----------|
| **演示模式**（默认） | 本机浏览器 IndexedDB | 先体验完整流程、做原型验证，无需后端。数据只存当前浏览器。 |
| **云端模式** | Supabase（数据库 + 对象存储） | 技术员在当地手机实时上传，管理方随时查看/下载/导出。需联网。 |

## 一、演示模式（零配置，立即体验）

1. 进入本目录，启动一个静态服务器：
   ```bash
   python -m http.server 8080
   ```
2. 浏览器打开 `http://localhost:8080`。
3. 「技术员上报」页填一条日报、选几张图提交；切到「管理后台」（访问码见下）即可查看、编辑、导出 Excel、下载照片。

> 手机体验：把电脑和手机连同一 WiFi，手机访问 `http://<电脑局域网IP>:8080` 即可模拟现场手机上传。

## 二、云端模式（技术员当地实时上传）

### 1. 准备 Supabase
- 用你现有的 Supabase 项目（或新建一个）。
- 打开 Supabase 控制台 → SQL Editor，执行 `supabase/schema.sql`。
- Storage → New bucket：名称 `report-photos`，勾选 **Public**。

### 2. 填入凭证
编辑 `config.js`：
```js
USE_SUPABASE: true,
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "你的 anon public key（Project Settings → API）",
```
> anon key 是公开密钥，可放前端；但不要放 service_role key。正式上线请在 schema.sql 里把 RLS 策略改为需要登录。

### 3. 管理访问码
`config.js` 里的 `ADMIN_CODE` 是管理后台口令（默认 `admin888`）。上线前请改成强口令，或在 schema 中改为基于 Supabase Auth 的登录。

## 三、部署到 GitHub Pages（技术员用手机公网访问）

1. 把整个 `installation-daily-platform` 目录推到 GitHub 仓库（例如 `installation-daily`）。
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save。
3. 几分钟后访问 `https://<你的用户名>.github.io/installation-daily/`。
4. 把该网址发给现场技术员，他们用手机浏览器打开即可上报。

> 若用云端模式，记得先按上面「二」填好 `config.js` 再部署。

## 四、数据导出

- **导出 Excel**：管理后台 → 筛选条件 → 「导出 Excel」，生成 `安装日报_项目名_日期.xlsx`（含日期/星期/天气/技术员/今日工作/明日计划/进度/问题/照片数/照片文件名）。
- **下载照片**：「下载全部照片」按当前筛选打包成 zip，目录结构为 `日期_技术员/照片.jpg`；单条日报也可在「查看/编辑」里单独下载。

## 五、目录结构

```
installation-daily-platform/
├─ index.html          # 单页应用（技术员上报 + 管理后台）
├─ style.css           # 移动端优先样式
├─ config.js           # 模式/凭证/访问码配置
├─ db.js               # 数据层（IndexedDB 演示 / Supabase 云端）
├─ export.js           # Excel 导出 + 照片打包
├─ app.js              # 界面逻辑
├─ vendor/
│  ├─ xlsx.full.min.js # SheetJS（Excel 导出）
│  └─ jszip.min.js     # JSZip（照片打包）
└─ supabase/
   └─ schema.sql       # 建表与存储策略
```

## 六、安全提示（上线前必读）

- 当前管理后台仅靠 `ADMIN_CODE` 前端口令保护，可被绕过。**正式用于真实项目前**，请接入 Supabase Auth 登录，并在 `schema.sql` 把 `using(true)` 改为 `using(auth.uid() is not null)` 等真实鉴权。
- 演示模式数据存浏览器本地，清缓存或换设备会丢失，仅用于验证流程。
