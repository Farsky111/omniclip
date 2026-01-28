
import React, { useState, useEffect, useMemo } from 'react';
import { Snippet, Workspace } from './types';
import Sidebar from './components/Sidebar';
import FloatingButton from './components/FloatingButton';
import { uploadToCloud, downloadFromCloud } from './services/syncService';
import { saveSnippetsToDB, loadSnippetsFromDB } from './services/dbService';

const WORKSPACES_KEY = 'omniclip_workspaces';
const ACTIVE_WORKSPACE_ID_KEY = 'omniclip_active_workspace_id';
const SNIPPETS_KEY_PREFIX = 'omniclip_snippets_';

const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string>('');
  const [lastSyncCount, setLastSyncCount] = useState<number>(0);
  const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };
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
    setSyncStatus('idle');
    setSyncError('');
    setLastSyncAt(null);
    setLastSyncCount(0);
    setSnippets([]);
    loadSnippetsFromDB(activeWorkspaceId).then(saved => {
      if (saved && saved.length) {
        setSnippets(saved);
        return;
      }
      const fallback = localStorage.getItem(`${SNIPPETS_KEY_PREFIX}${activeWorkspaceId}`);
      if (fallback) {
        try {
          const parsed = JSON.parse(fallback) as Snippet[];
          setSnippets(parsed || []);
          return;
        } catch {
          setSnippets([]);
          return;
        }
      }
      setSnippets([]);
    });
  }, [activeWorkspaceId]);

  const mergeSnippets = (localSnippets: Snippet[], cloudSnippets: Snippet[]) => {
    const mergedMap = new Map<string, Snippet>();
    localSnippets.forEach((s) => mergedMap.set(s.id, s));
    cloudSnippets.forEach((s) => {
      const existing = mergedMap.get(s.id);
      if (!existing || s.timestamp > existing.timestamp) {
        mergedMap.set(s.id, s);
      }
    });
    return Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  };

  // 3. 雲端同步邏輯 (與工作區綁定)
  useEffect(() => {
    const syncId = activeWorkspace?.syncId;
    if (!syncId) return;

    const performSync = async () => {
      try {
        setSyncStatus('syncing');
        const cloudData = await downloadFromCloud(syncId);
        setSnippets(prev => mergeSnippets(prev, cloudData));
        setSyncStatus('success');
        setLastSyncAt(Date.now());
        setLastSyncCount(cloudData.length);
        setSyncError('');
      } catch (error) {
        setSyncStatus('error');
        const message = error instanceof Error ? error.message : '同步失敗';
        setSyncError(`${message}，請確認同步密碼是否正確或伺服器已部署`);
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
    localStorage.setItem(`${SNIPPETS_KEY_PREFIX}${activeWorkspaceId}`, JSON.stringify(snippets));

    const syncId = activeWorkspace?.syncId;
    if (syncId) {
      const timer = setTimeout(async () => {
        try {
          setSyncStatus('syncing');
          const syncableSnippets = snippets.filter(s => s.content.length < 5 * 1024 * 1024);
          const cloudData = await downloadFromCloud(syncId);
          const merged = mergeSnippets(syncableSnippets, cloudData);
          if (merged.length !== syncableSnippets.length) {
            setSnippets(merged);
          }
          await uploadToCloud(syncId, merged);
          setSyncStatus('success');
          setLastSyncAt(Date.now());
          setLastSyncCount(merged.length);
          setSyncError('');
        } catch (error) {
          setSyncStatus('error');
          const message = error instanceof Error ? error.message : '同步失敗';
          setSyncError(`${message}，請確認同步密碼是否正確或伺服器已部署`);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [snippets, activeWorkspaceId, activeWorkspace?.syncId]);

  const manualSync = async () => {
    const syncId = activeWorkspace?.syncId;
    if (!syncId) return;
    try {
      setSyncStatus('syncing');
      const cloudData = await downloadFromCloud(syncId);
      setSnippets(prev => mergeSnippets(prev, cloudData));
      setSyncStatus('success');
      setLastSyncAt(Date.now());
      setLastSyncCount(cloudData.length);
      setSyncError('');
    } catch (error) {
      setSyncStatus('error');
      const message = error instanceof Error ? error.message : '同步失敗';
      setSyncError(`${message}，請確認同步密碼是否正確或伺服器已部署`);
    }
  };

  const addSnippet = (snippet: Snippet) => {
    setSnippets(prev => [snippet, ...prev]);
  };

  const deleteSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const updateSnippetTitle = (id: string, title: string) => {
    setSnippets(prev => prev.map(s => (s.id === id ? { ...s, title } : s)));
  };

  const addWorkspace = (name: string, syncId: string) => {
    const id = createId();
    const newWS: Workspace = { id, name, syncId: syncId.trim() };
    setWorkspaces(prev => [...prev, newWS]);
    setActiveWorkspaceId(id);
    return id;
  };

  const updateActiveWorkspaceSyncId = (newId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === activeWorkspaceId ? { ...w, syncId: newId } : w
    ));
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

  if (isMiniMode) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <Sidebar
          isOpen={true}
          onClose={() => { }}
          snippets={snippets}
          onAddSnippet={addSnippet}
          onDeleteSnippet={deleteSnippet}
          onUpdateSnippetTitle={updateSnippetTitle}
          syncStatus={syncStatus}
          syncError={syncError}
          lastSyncAt={lastSyncAt}
          lastSyncCount={lastSyncCount}
          onManualSync={manualSync}
          onUpdateSyncId={updateActiveWorkspaceSyncId}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
          onAddWorkspace={addWorkspace}
          onDeleteWorkspace={deleteWorkspace}
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
        onUpdateSnippetTitle={updateSnippetTitle}
        syncStatus={syncStatus}
        syncError={syncError}
        lastSyncAt={lastSyncAt}
        lastSyncCount={lastSyncCount}
        onManualSync={manualSync}
        onUpdateSyncId={updateActiveWorkspaceSyncId}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={setActiveWorkspaceId}
        onAddWorkspace={addWorkspace}
        onDeleteWorkspace={deleteWorkspace}
      />
    </div>
  );
};

export default App;
