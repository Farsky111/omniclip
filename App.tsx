
import React, { useState, useEffect, useMemo } from 'react';
import { Snippet, Workspace } from './types';
import Sidebar from './components/Sidebar';
import FloatingButton from './components/FloatingButton';
import { uploadToCloud, downloadFromCloud } from './services/syncService';
import { saveSnippetsToDB, loadSnippetsFromDB } from './services/dbService';

const WORKSPACES_KEY = 'omniclip_workspaces';
const ACTIVE_WORKSPACE_ID_KEY = 'omniclip_active_workspace_id';

const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem(WORKSPACES_KEY);
    if (saved) return JSON.parse(saved);
    const defaultWS: Workspace = { id: 'default', name: '預設工作區', syncId: '' };
    return [defaultWS];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY) || workspaces[0]?.id || 'default';
  });

  const activeWorkspace = useMemo(() =>
    workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0],
    [workspaces, activeWorkspaceId]);

  const isMiniMode = new URLSearchParams(window.location.search).get('mode') === 'mini';

  // 1. 持久化工作區列表與當前 ID
  useEffect(() => {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, activeWorkspaceId);
  }, [activeWorkspaceId]);

  // 2. 初始化/切換：從對應工作區的 IndexedDB 載入資料
  useEffect(() => {
    loadSnippetsFromDB(activeWorkspaceId).then(saved => {
      setSnippets(saved || []);
    });
  }, [activeWorkspaceId]);

  // 3. 雲端同步邏輯 (與工作區綁定)
  useEffect(() => {
    const syncId = activeWorkspace?.syncId;
    if (!syncId) return;

    const performSync = async () => {
      const cloudData = await downloadFromCloud(syncId);
      if (cloudData) {
        setSnippets(prev => {
          const merged = [...prev];
          cloudData.forEach(cloudSnippet => {
            const index = merged.findIndex(s => s.id === cloudSnippet.id);
            if (index !== -1) {
              merged[index] = cloudSnippet;
            } else {
              merged.unshift(cloudSnippet);
            }
          });
          return merged.sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    };
    performSync();
    const interval = setInterval(performSync, 30000);
    return () => clearInterval(interval);
  }, [activeWorkspace?.syncId]);

  // 4. 本地變動存入對應資料庫與雲端 (過濾大檔案)
  useEffect(() => {
    if (!activeWorkspaceId) return;
    saveSnippetsToDB(activeWorkspaceId, snippets);

    const syncId = activeWorkspace?.syncId;
    if (syncId) {
      const timer = setTimeout(() => {
        const syncableSnippets = snippets.filter(s => s.content.length < 5 * 1024 * 1024);
        uploadToCloud(syncId, syncableSnippets);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [snippets, activeWorkspaceId, activeWorkspace?.syncId]);

  const addSnippet = (snippet: Snippet) => {
    setSnippets(prev => [snippet, ...prev]);
  };

  const deleteSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const updateActiveWorkspaceSyncId = (newId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === activeWorkspaceId ? { ...w, syncId: newId } : w
    ));
  };

  const addWorkspace = (name: string) => {
    const newWS: Workspace = { id: crypto.randomUUID(), name, syncId: '' };
    setWorkspaces(prev => [...prev, newWS]);
    setActiveWorkspaceId(newWS.id);
  };

  const deleteWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;
    const newWorkspaces = workspaces.filter(w => w.id !== id);
    setWorkspaces(newWorkspaces);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[0].id);
    }
    // 注意：這裡沒刪除 IndexedDB 資料庫，僅移除列表索引
  };

  const syncFromCloud = (newSnippets: Snippet[]) => {
    setSnippets(newSnippets);
  };

  if (isMiniMode) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <Sidebar
          isOpen={true}
          onClose={() => { }}
          snippets={snippets}
          onAddSnippet={addSnippet}
          onDeleteSnippet={deleteSnippet}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
          onAddWorkspace={addWorkspace}
          onDeleteWorkspace={deleteWorkspace}
          onUpdateSyncId={updateActiveWorkspaceSyncId}
          onSyncFromCloud={syncFromCloud}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-black mb-4">OmniClip</h1>
        <p className="text-slate-600 mb-2">支援大檔案存儲與智慧同步</p>
        <p className="text-indigo-600 font-bold mb-8">目前工作區：{activeWorkspace?.name}</p>
        <button onClick={() => setIsOpen(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">開啟筆記板</button>
      </main>
      <FloatingButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} itemCount={snippets.length} />
      <Sidebar
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        snippets={snippets}
        onAddSnippet={addSnippet}
        onDeleteSnippet={deleteSnippet}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={setActiveWorkspaceId}
        onAddWorkspace={addWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        onUpdateSyncId={updateActiveWorkspaceSyncId}
        onSyncFromCloud={syncFromCloud}
      />
    </div>
  );
};

export default App;
