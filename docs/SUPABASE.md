# Supabase 設定教學（雲端同步歷史紀錄）

不設定也能用：紀錄會存在這支手機／瀏覽器裡。設定後，換手機或重灌也能用 Email 登入取回紀錄。
全程免費方案即可，約 10 分鐘。

> 畫面名稱可能隨 Supabase 改版略有不同，以官方文件為準：
> - 登入方式（Magic Link／Email OTP）：https://supabase.com/docs/guides/auth/auth-email-passwordless
> - 重新導向網址：https://supabase.com/docs/guides/auth/redirect-urls
> - API 金鑰：https://supabase.com/docs/guides/api/api-keys
> - Row Level Security：https://supabase.com/docs/guides/database/postgres/row-level-security

## 1. 建立專案
1. 到 https://supabase.com 用 GitHub 或 Email 註冊、登入。
2. **New project**（第一次會先要你建立 Organization，名稱隨意，類型選 Personal）。
3. 填：
   - **Name**：例如 `meihua`
   - **Database Password**：按「Generate」產生並**存到密碼管理員**（本程式用不到，但之後遇到問題會需要）
   - **Region**：選離你近的（例如 Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)）
   - 方案選 **Free**
4. 按 **Create new project**，等 1–2 分鐘。

## 2. 建立資料表與權限（最重要的一步）
1. 左邊選單 **SQL Editor** → **New query**。
2. 把本專案 `sql/supabase.sql` 的內容整段貼上 → **Run**。
3. 看到 `Success` 即可。到左邊 **Table Editor** 應該會看到 `divination_logs`，旁邊有 **RLS enabled** 標示。

這段 SQL 做了兩件事：建表；並開啟 RLS，規定「只有登入者本人」能讀、寫、刪自己的紀錄。沒登入的人什麼都看不到。

## 3. 設定登入
1. **Authentication** → **Sign In / Providers**（舊版叫 Providers）→ 確認 **Email** 是啟用狀態（預設就是）。
   - 本程式用「寄信、不用密碼」登入，所以密碼相關選項不用管。
2. **Authentication** → **URL Configuration**：
   - **Site URL**：填你網站的正式網址（例如 `https://你的帳號.github.io/你的repo/`）
   - **Redirect URLs**：加入同一個網址；想在自己電腦測試的話，再加 `http://localhost:8000/**`
3. **Authentication** → **Emails**（或 Email Templates）→ **Magic Link** 範本：
   在內容裡**加一行驗證碼**，例如：
   ```html
   <p>登入連結：<a href="{{ .ConfirmationURL }}">點此登入</a></p>
   <p>手機 App 請輸入驗證碼：<strong>{{ .Token }}</strong></p>
   ```
   為什麼要加：iPhone 把網站「加到主畫面」變成 App 後，點信裡的連結會在 Safari 開啟，登入狀態不會回到 App；
   改成在 App 裡輸入驗證碼就沒有這個問題。

## 4. 把金鑰填進程式
1. **Project Settings**（左下齒輪）→ **API**（新版可能在 **API Keys**）。
2. 複製兩樣東西：
   - **Project URL**：`https://xxxxxxxx.supabase.co`
   - **anon public key**（新版可能叫 **Publishable key**，開頭是 `sb_publishable_`；舊版是很長的 `eyJ...`，兩種都能用）
3. 打開 `js/config.js`，填入：
   ```js
   window.MEIHUA_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "你複製的 anon/publishable key"
   };
   ```
4. 把 `sw.js` 第一行的 `VERSION` 改成新的（例如 `meihua-v4`），重新部署。

**安全提醒**
- ✅ anon／publishable key 可以公開放在網頁裡，因為真正的保護是第 2 步的 RLS。
- ❌ **絕對不要**把 `service_role` 或 `secret` 開頭的金鑰放進程式或 GitHub，那把鑰匙能繞過 RLS。

## 5. 測試
1. 開網站 → 右上「帳號」→ 輸入 Email → **寄送登入信**。
2. 收信（沒收到先看垃圾郵件）→ 在 App 輸入驗證碼 → **驗證並登入**，看到「已登入」。
3. 起卦一次 → 開「歷史紀錄」，上方應顯示「資料來源：雲端」。
4. 回 Supabase **Table Editor → divination_logs**，應該看到一筆資料。

## 常見問題
- **收不到信 / 寄信失敗**：Supabase 內建寄信服務有很嚴格的寄送次數上限，只適合測試。
  之後想穩定使用，到 **Project Settings → Authentication → SMTP Settings** 接自己的寄信服務。
- **登入時說 redirect 不被允許**：第 3 步的 Redirect URLs 沒有包含你目前的網址。
- **歷史是空的，但確定存過**：確認有登入；未登入時看的是本機紀錄。
- **免費專案閒置會被暫停**：長時間沒使用，專案可能被暫停，到 Supabase 後台按 Restore 即可（細節以官方說明為準）。
- **想把本機舊紀錄搬上雲端**：登入後，歷史紀錄面板會出現「上傳本機紀錄到雲端」。
