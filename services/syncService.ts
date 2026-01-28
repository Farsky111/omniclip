
import { Snippet } from "../types";

const SYNC_API_URL = import.meta.env.VITE_SYNC_API_URL || '/api/sync';

/**
 * 將筆記資料上傳至雲端儲存空間 (模擬)
 * @param {string} syncId 同步辨別碼
 * @param {Snippet[]} snippets 筆記陣列
 */
export const uploadToCloud = async (syncId: string, snippets: Snippet[]) => {
  if (!syncId) return;
  const code = syncId.trim();
  if (!code) return;
  try {
    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, snippets })
    });
    if (!response.ok) {
      throw new Error(`雲端上傳失敗 (${response.status})`);
    }
  } catch (error) {
    console.error("同步失敗:", error);
    throw error;
  }
};

/**
 * 從雲端儲存空間下載筆記資料 (模擬)
 * @param {string} syncId 同步辨別碼
 * @returns {Promise<Snippet[] | null>} 成功則回傳筆記陣列，失敗回傳 null
 */
export const downloadFromCloud = async (syncId: string): Promise<Snippet[]> => {
  if (!syncId) return [];
  const code = syncId.trim();
  if (!code) return [];
  try {
    const response = await fetch(`${SYNC_API_URL}?code=${encodeURIComponent(code)}`);
    if (response.ok) {
      const json = await response.json();
      return (json?.snippets || []) as Snippet[];
    }
    if (response.status === 404) {
      return [];
    }
    throw new Error(`雲端下載失敗 (${response.status})`);
  } catch (error) {
    console.error("下載失敗:", error);
    throw error;
  }
};
