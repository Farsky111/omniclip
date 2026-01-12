
import React, { useState, useEffect } from 'react';
import { Snippet } from './types';
import Sidebar from './components/Sidebar';
import FloatingButton from './components/FloatingButton';
import { uploadToCloud, downloadFromCloud } from './services/syncService';
import { saveSnippetsToDB, loadSnippetsFromDB } from './services/dbService';

const SYNC_ID_KEY = 'omniclip_sync_id';

const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [syncId, setSyncId] = useState(localStorage.getItem(SYNC_ID_KEY) || '');
  const isMiniMode = new URLSearchParams(window.location.search).get('mode') === 'mini';

  // 1. 初始化：從 IndexedDB 載入大容量本地資料
  useEffect(() => {
    loadSnippetsFromDB().then(saved => {
      if (saved && saved.length > 0) {
        setSnippets(saved);
      }
    });
  }, []);

  // 2. 雲端同步邏輯
  useEffect(() => {
    if (!syncId) return;
    const performSync = async () => {
      const cloudData = await downloadFromCloud(syncId);
      if (cloudData) {
        setSnippets(prev => {
          // 這裡做簡單的合併：以 ID 為準，雲端有的覆蓋本地，本地新增的保留
          const merged = [...prev];
          cloudData.forEach(cloudSnippet => {
            const index = merged.findIndex(s => s.id === cloudSnippet.id);
            if (index !== -1) {
              merged[index] = cloudSnippet;
            } else {
              merged.unshift(cloudSnippet);
            }
          });
          // 依照時間排序
          return merged.sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    };
    performSync();
    const interval = setInterval(performSync, 30000);
    return () => clearInterval(interval);
  }, [syncId]);

  // 3. 本地變動自動存入 IndexedDB 與雲端上傳 (過濾大檔案)
  useEffect(() => {
    saveSnippetsToDB(snippets);
    if (syncId) {
      const timer = setTimeout(() => {
        // 為了雲端效能，僅同步檔案大小在 5MB 以下的內容到 KVDB
        // 大於 5MB 的維持本地儲存
        const syncableSnippets = snippets.filter(s => s.content.length < 5 * 1024 * 1024);
        uploadToCloud(syncId, syncableSnippets);
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [snippets, syncId]);

  const addSnippet = (snippet: Snippet) => {
    setSnippets(prev => [snippet, ...prev]);
  };

  const deleteSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const updateSyncId = (newId: string) => {
    setSyncId(newId);
    if (newId) localStorage.setItem(SYNC_ID_KEY, newId);
    else localStorage.removeItem(SYNC_ID_KEY);
  };

  const syncFromCloud = (newSnippets: Snippet[]) => {
    setSnippets(newSnippets);
  };

  if (isMiniMode) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <Sidebar isOpen={true} onClose={() => {}} snippets={snippets} onAddSnippet={addSnippet} onDeleteSnippet={deleteSnippet} syncId={syncId} onUpdateSyncId={updateSyncId} onSyncFromCloud={syncFromCloud} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-black mb-4">OmniClip</h1>
        <p className="text-slate-600 mb-8">支援大檔案存儲與智慧同步</p>
        <button onClick={() => setIsOpen(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">開啟筆記板</button>
      </main>
      <FloatingButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} itemCount={snippets.length} />
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} snippets={snippets} onAddSnippet={addSnippet} onDeleteSnippet={deleteSnippet} syncId={syncId} onUpdateSyncId={updateSyncId} onSyncFromCloud={syncFromCloud} />
    </div>
  );
};

export default App;
