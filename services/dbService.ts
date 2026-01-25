
import { Snippet } from "../types";

const DB_NAME = "OmniClipDB";
const STORE_NAME = "snippets";
const DB_VERSION = 1;

/**
 * 初始化 IndexedDB 資料庫
 * @returns {Promise<IDBDatabase>} 回傳資料庫實例
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 將筆記列表儲存至本地資料庫
 * @param {Snippet[]} snippets 筆記物件陣列
 * @returns {Promise<boolean>} 儲存成功回傳 true
 */
export const saveSnippetsToDB = async (snippets: Snippet[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  // 先清空再重新存入，或根據 ID 更新
  store.clear();
  snippets.forEach(s => store.put(s));
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
  });
};

/**
 * 從本地資料庫載入所有筆記
 * @returns {Promise<Snippet[]>} 回傳筆記陣列
 */
export const loadSnippetsFromDB = async (): Promise<Snippet[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};
