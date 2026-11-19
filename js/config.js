// 雲端同步設定（可選）。留空時，所有紀錄只存在這個瀏覽器的 localStorage。
// 要啟用：到 Supabase 專案 → Project Settings → API，填入 Project URL 與 anon public key，
// 並先執行 sql/supabase.sql 建立資料表與權限（RLS）。anon key 可以公開放在前端，安全性由 RLS 保證。
window.MEIHUA_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
