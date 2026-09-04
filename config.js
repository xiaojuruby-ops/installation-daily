// ============ 安装日报平台 配置 ============
// 演示模式：USE_SUPABASE=false，数据存在本机浏览器 IndexedDB，无需后端，先体验完整流程。
// 云端模式：把 USE_SUPABASE 改为 true，并填入你的 Supabase 项目 URL 与 anon key，
//           技术员在当地用手机打开网页即可实时上传，你随时查看/下载/导出。
const CONFIG = {
  USE_SUPABASE: false,
  SUPABASE_URL: "",          // 例：https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "",     // 你的 anon public key（Project Settings → API）
  ADMIN_CODE: "admin888",    // 管理后台访问口令（上线前请改成强口令，或接入正式登录）
  APP_NAME: "安装日报平台",
  VERSION: "1.0",
};
