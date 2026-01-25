
import { Snippet } from "../types";

// 這裡模擬一個簡易的雲端儲存空間 (實際應用中應連結至後端資料庫)
// 我們使用一個公共 API 服務來演示同步邏輯
const SYNC_API_URL = "https://kvdb.io/A4Cun6TzC9R9K7hU3Xj1mY/";

/**
 * 將筆記資料上傳至雲端儲存空間 (模擬)
 * @param {string} syncId 同步辨別碼
 * @param {Snippet[]} snippets 筆記陣列
 */
export const uploadToCloud = async (syncId: string, snippets: Snippet[]) => {
  if (!syncId) return;
  try {
    await fetch(`${SYNC_API_URL}${syncId}`, {
      method: 'POST',
      body: JSON.stringify(snippets)
    });
  } catch (error) {
    console.error("同步失敗:", error);
  }
};

/**
 * 從雲端儲存空間下載筆記資料 (模擬)
 * @param {string} syncId 同步辨別碼
 * @returns {Promise<Snippet[] | null>} 成功則回傳筆記陣列，失敗回傳 null
 */
export const downloadFromCloud = async (syncId: string): Promise<Snippet[] | null> => {
  if (!syncId) return null;
  try {
    const response = await fetch(`${SYNC_API_URL}${syncId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("下載失敗:", error);
  }
  return null;
};
