import React, { useState, useRef } from 'react';
import { Snippet, ContentType, Workspace } from '../types';
import { analyzeSnippet } from '../services/geminiService';
import SnippetCard from './SnippetCard';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: Snippet[];
  onAddSnippet: (snippet: Snippet) => void;
  onDeleteSnippet: (id: string) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
  onAddWorkspace: (name: string, syncId: string) => void;
  onDeleteWorkspace: (id: string) => void;
}

/**
 * 側邊欄組件
 * OmniClip 的主要互動區域。包含筆記列表、內容過濾、搜尋、
 * 檔案上傳 (圖片/影片) 以及雲端同步設定與同步按鈕。
 */
const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, snippets, onAddSnippet, onDeleteSnippet,
  workspaces, activeWorkspaceId, onSwitchWorkspace,
  onAddWorkspace, onDeleteWorkspace
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'settings' | 'help'>('list');
  const [inputValue, setInputValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [filter, setFilter] = useState<ContentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isAddWorkspaceOpen, setIsAddWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSyncKey, setWorkspaceSyncKey] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const isPopout = new URLSearchParams(window.location.search).get('mode') === 'mini';

  /**
   * 壓縮圖片檔案
   * 將原始 Base64 圖片縮放並降低品質以減少存儲空間佔用。
   * @param {string} base64 原始圖片數據
   * @returns {Promise<string>} 壓縮後的 Base64 數據
   */
  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 限制最大寬度為 1600px
        const MAX_WIDTH = 1600;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // 使用 0.7 的品質進行壓縮
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  /**
   * 處理上傳的檔案 (圖片或影片)
   * 讀取檔案、進行必要的優化處理，並透過 AI 生成摘要後存入筆記。
   * @param {File} file 檔案物件
   * @param {ContentType} type 檔案類型
   */
  const processFile = async (file: File, type: ContentType) => {
    // 雖然 IndexedDB 可以存很大，但為了同步效率，建議影片在 30MB 內
    const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
    if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
      alert("影片太大了（超過 30MB），建議上傳至雲端硬碟並貼上連結分享。");
      return;
    }

    setIsAnalyzing(true);
    if (type === 'image') {
      setStatusMsg("正在優化圖片...");
    } else if (type === 'video') {
      setStatusMsg("正在讀取影片...");
    } else {
      setStatusMsg("正在讀取檔案...");
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let content = e.target?.result as string;

        if (type === 'image') {
          content = await compressImage(content);
        }

        let analysis = {
          title: file.name,
          summary: "已儲存檔案，可下載或分享。",
          tags: ["檔案"],
          category: "檔案"
        };

        if (type !== 'file') {
          setStatusMsg("AI 分析內容中...");
          analysis = await analyzeSnippet(content, type);
        }

        const newSnippet: Snippet = {
          id: crypto.randomUUID(),
          type,
          content,
          title: analysis.title || file.name,
          summary: analysis.summary,
          tags: [...analysis.tags],
          timestamp: Date.now(),
        };

        onAddSnippet(newSnippet);
      } catch (err) {
        console.error(err);
        alert("處理檔案發生錯誤");
      } finally {
        setIsAnalyzing(false);
        setStatusMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * 處理手動輸入的內容 (文字或網址)
   * 自動判斷內容類型，並透過 AI 服務進行分析後加入筆記列表。
   */
  const handleAdd = async () => {
    if (!inputValue.trim()) return;
    setIsAnalyzing(true);
    setStatusMsg("AI 正在解析...");
    const content = inputValue.trim();
    setInputValue('');

    try {
      let type: ContentType = 'text';
      if (content.startsWith('http')) {
        const videoPatterns = [/youtube\.com/, /youtu\.be/, /\.mp4/, /\.webm/, /vimeo\.com/];
        type = videoPatterns.some(p => p.test(content)) ? 'video' : 'url';
      }

      const analysis = await analyzeSnippet(content, type);
      onAddSnippet({
        id: crypto.randomUUID(),
        type,
        content,
        title: analysis.title,
        summary: analysis.summary,
        tags: analysis.tags,
        timestamp: Date.now(),
      });
    } finally {
      setIsAnalyzing(false);
      setStatusMsg('');
    }
  };

  const filteredSnippets = snippets.filter(s => {
    const matchesFilter = filter === 'all' || s.type === filter;
    const matchesSearch = s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.title?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const displayOpen = isOpen || isPopout;
  const isDialogOpen = isAddWorkspaceOpen || !!workspaceToDelete;

  const handleCreateWorkspace = () => {
    const name = workspaceName.trim();
    if (!name) return;
    onAddWorkspace(name, workspaceSyncKey.trim());
    setWorkspaceName('');
    setWorkspaceSyncKey('');
    setIsAddWorkspaceOpen(false);
    setIsWorkspaceMenuOpen(false);
  };

  const handleCancelWorkspace = () => {
    setIsAddWorkspaceOpen(false);
    setWorkspaceName('');
    setWorkspaceSyncKey('');
  };

  const handleDeleteWorkspace = () => {
    if (!workspaceToDelete) return;
    onDeleteWorkspace(workspaceToDelete.id);
    setWorkspaceToDelete(null);
  };

  return (
    <>
      {displayOpen && !isPopout && <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full z-50 shadow-2xl transition-transform duration-300 flex flex-col bg-white/70 backdrop-blur-xl border border-white/40 relative ${isPopout ? 'w-full translate-x-0' : 'w-full sm:w-96 ' + (isOpen ? 'translate-x-0' : 'translate-x-full')} `}>
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/40 sticky top-0 z-10">
          <div className="p-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">OmniClip</h2>
            <div className="flex gap-1">
              <button onClick={() => setActiveTab('help')} className="p-2 text-slate-400 hover:text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              {!isPopout && <button onClick={onClose} className="p-2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>}
            </div>
          </div>
          <div className="flex border-t">
            <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 text-[11px] font-bold ${activeTab === 'list' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}>列表</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 text-[11px] font-bold ${activeTab === 'settings' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}>設定</button>
          </div>
        </div>

        {activeTab === 'list' && (
          <>
            <div className="px-3 py-3 bg-white/70 backdrop-blur-xl border-b border-white/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">目前工作區</span>
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100/80 text-[11px] font-semibold text-slate-700"
                  >
                    {activeWorkspace?.name || '未命名'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddWorkspaceOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 4.75a.75.75 0 01.75.75v3.75h3.75a.75.75 0 010 1.5h-3.75v3.75a.75.75 0 01-1.5 0v-3.75H5.5a.75.75 0 010-1.5h3.75V5.5A.75.75 0 0110 4.75z" />
                    </svg>
                    新增
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="text-[10px] text-slate-400"
                >
                  管理
                </button>
              </div>

              {isWorkspaceMenuOpen && (
                <div className="rounded-xl border border-white/60 bg-white/80 p-2 space-y-1 shadow-sm">
                  {workspaces.map(ws => (
                    <div
                      key={ws.id}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${ws.id === activeWorkspaceId ? 'bg-emerald-50' : 'bg-white/70'}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchWorkspace(ws.id);
                          setIsWorkspaceMenuOpen(false);
                        }}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                      >
                        {ws.name}
                        {ws.id === activeWorkspaceId && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">使用中</span>
                        )}
                      </button>
                      {workspaces.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setWorkspaceToDelete(ws)}
                          className="p-1 text-rose-500 hover:text-rose-600"
                          title="刪除工作區"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7.5 2.75A.75.75 0 018.25 2h3.5a.75.75 0 01.75.75V4h3a.75.75 0 010 1.5h-.75l-.64 9.12A2.25 2.25 0 0111.87 16H8.13a2.25 2.25 0 01-2.24-2.13L5.25 5.5H4.5a.75.75 0 010-1.5h3V2.75z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsAddWorkspaceOpen(true)}
                    className="w-full text-left text-[11px] font-semibold text-emerald-600 px-2 py-1.5 rounded-lg hover:bg-emerald-50"
                  >
                    + 新增工作區
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="搜尋內容..."
                className="w-full px-3 py-2 bg-slate-100/80 rounded-lg text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {['all', 'text', 'url', 'image', 'video', 'file'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t as any)}
                    className={`px-3 py-1 text-[10px] rounded-full whitespace-nowrap ${filter === t ? 'bg-emerald-600 text-white' : 'bg-slate-100/70 text-slate-500'}`}
                  >
                    {t === 'all' ? '全部' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span className="font-semibold">目前工作區內容</span>
                <span className="text-emerald-600">{filteredSnippets.length} 則</span>
              </div>
              {filteredSnippets.map((s) => (
                <SnippetCard key={s.id} snippet={s} onDelete={onDeleteSnippet} onCopy={(t) => navigator.clipboard.writeText(t)} />
              ))}
              {!filteredSnippets.length && (
                <div className="text-[11px] text-slate-400 text-center py-10">尚無內容</div>
              )}
            </div>

            <div className="p-3 bg-white/70 backdrop-blur-xl border-t border-white/40 space-y-2">
              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2 mb-2 text-[10px] text-emerald-600 font-bold animate-pulse">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></span>
                  {statusMsg}
                </div>
              )}
              <div className="text-[10px] text-slate-500">上傳至：{activeWorkspace?.name || '未命名'}</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-semibold border border-emerald-100">圖片</button>
                <button onClick={() => videoInputRef.current?.click()} className="py-2 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-semibold border border-amber-100">影片</button>
                <button onClick={() => documentInputRef.current?.click()} className="py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-semibold border border-slate-200">檔案</button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'image')} />
              <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'video')} />
              <input type="file" ref={documentInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'file')} />
              <textarea
                rows={2}
                placeholder="貼上文字或網址..."
                className="w-full p-2 bg-slate-50/80 border border-white/60 rounded-lg text-xs resize-none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button disabled={isAnalyzing || !inputValue.trim()} onClick={handleAdd} className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg disabled:bg-slate-300">儲存</button>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  工作區管理
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddWorkspaceOpen(true)}
                  className="text-[10px] font-semibold text-emerald-600"
                >
                  新增工作區
                </button>
              </div>
              <div className="space-y-2">
                {workspaces.map(ws => (
                  <div key={ws.id} className={`flex items-center justify-between p-2 rounded-lg border ${ws.id === activeWorkspaceId ? 'bg-emerald-50 border-emerald-200' : 'bg-white/70 border-white/60'}`}>
                    <button onClick={() => onSwitchWorkspace(ws.id)} className="flex-1 text-left text-xs font-semibold truncate pr-2">
                      {ws.name}
                      {ws.id === activeWorkspaceId && <span className="ml-2 text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">目前使用</span>}
                    </button>
                    {workspaces.length > 1 && (
                      <button onClick={() => setWorkspaceToDelete(ws)} className="p-1 text-rose-500 hover:text-rose-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">刪除後將同步移除所有裝置內容與設定。</p>
            </section>
          </div>
        )}

        {isDialogOpen && (
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-30"
            onClick={() => {
              setWorkspaceToDelete(null);
              handleCancelWorkspace();
            }}
          />
        )}

        {isAddWorkspaceOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-slate-800">新增工作區</h3>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">工作區名稱</label>
                <input
                  type="text"
                  placeholder="例如：行銷素材"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100/80 text-xs"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">設定工作區專屬跨裝置密碼</label>
                <input
                  type="text"
                  placeholder="輸入或貼上金鑰"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100/80 text-xs"
                  value={workspaceSyncKey}
                  onChange={(e) => setWorkspaceSyncKey(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleCancelWorkspace} className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">取消</button>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:bg-slate-300"
                >
                  建立
                </button>
              </div>
            </div>
          </div>
        )}

        {workspaceToDelete && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl p-4 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-slate-800">刪除工作區？</h3>
              <p className="text-xs text-slate-600">確定要刪除「{workspaceToDelete.name}」嗎？</p>
              <p className="text-[10px] text-rose-600">刪除後將同步移除所有裝置內容與設定。</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setWorkspaceToDelete(null)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">取消</button>
                <button onClick={handleDeleteWorkspace} className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-white">刪除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
