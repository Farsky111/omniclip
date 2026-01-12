
import { Snippet } from "../types";

const DB_NAME = "OmniClipDB";
const STORE_NAME = "snippets";
const DB_VERSION = 1;

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

export const loadSnippetsFromDB = async (): Promise<Snippet[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};
