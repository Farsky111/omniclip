# Directive: Environment Setup (omniclip)

## 1. 核心環境需求

| 技術棧 | 最低版本 | 建議版本 | 狀態 |
| :--- | :--- | :--- | :--- |
| **Node.js** | 18.0.0 | 20.x (LTS) | ✅ v24.13.0 |
| **npm** | 9.0.0 | 10.x | ✅ v11.6.2 |
| **Vite** | 6.0.0 | 6.2.0 | ✅ v6.4.1 |

## 2. 環境檢測腳本 (Execution)

若要執行自檢，請在終端機運作：
```powershell
node -v; npm -v
```

## 3. 安裝與設定步驟

### 3.1 若 Node.js 缺失
1. 前往 [nodejs.org](https://nodejs.org/) 下載 LTS 版本。
2. 安裝後重啟終端機。
3. 執行 `npm install` 安裝相依性。

### 3.2 啟用 API Key
1. 確保 `c:\Users\farsk\.gemini\antigravity\scratch\omniclip\.env.local` 檔案存在。
2. 設定 `VITE_GEMINI_API_KEY` (根據 package.json 推斷可能需要)。

## 4. 自修復規則
- 若 `npm run dev` 失敗 → 檢查 `node_modules` 完整性 → 重新執行 `npm install`。
- 若發生連線錯誤 → 檢查 `.env.local` 與網路代理。
