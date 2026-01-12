
import React, { useState, useRef } from 'react';
import { Snippet, ContentType } from '../types';
import { analyzeSnippet } from '../services/geminiService';
import SnippetCard from './SnippetCard';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: Snippet[];
  onAddSnippet: (snippet: Snippet) => void;
  onDeleteSnippet: (id: string) => void;
  syncId: string;
  onUpdateSyncId: (id: string) => void;
  onSyncFromCloud: (snippets: Snippet[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, snippets, onAddSnippet, onDeleteSnippet, 
  syncId, onUpdateSyncId, onSyncFromCloud 
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'settings' | 'help'>('list');
  const [inputValue, setInputValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [filter, setFilter] = useState<ContentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSyncId, setTempSyncId] = useState(syncId);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isPopout = new URLSearchParams(window.location.search).get('mode') === 'mini';

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

  const processFile = async (file: File, type: ContentType) => {
    // 雖然 IndexedDB 可以存很大，但為了同步效率，建議影片在 30MB 內
    const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
    if (type === 'video' && file.size > MAX_VIDEO_SIZE) {
      alert("影片太大了（超過 30MB），建議上傳至雲端硬碟並貼上連結分享。");
      return;
    }

    setIsAnalyzing(true);
    setStatusMsg(type === 'image' ? "正在優化圖片..." : "正在讀取影片...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let content = e.target?.result as string;
        
        if (type === 'image') {
          content = await compressImage(content);
        }

        setStatusMsg("AI 分析內容中...");
        const analysis = await analyzeSnippet(content, type);
        
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

  return (
    <>
      {displayOpen && !isPopout && <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full bg-slate-50 z-50 shadow-2xl transition-transform duration-300 flex flex-col ${isPopout ? 'w-full translate-x-0' : 'w-full sm:w-96 ' + (isOpen ? 'translate-x-0' : 'translate-x-full')}`}>
        <div className="bg-white border-b sticky top-0 z-10">
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
            <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 text-[11px] font-bold ${activeTab === 'list' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>列表</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 text-[11px] font-bold ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>設定</button>
          </div>
        </div>

        {activeTab === 'list' && (
          <>
            <div className="px-3 py-2 bg-white border-b space-y-2">
              <input type="text" placeholder="搜尋內容..." className="w-full px-3 py-1.5 bg-slate-100 rounded-lg text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {['all', 'text', 'url', 'image', 'video'].map((t) => (
                  <button key={t} onClick={() => setFilter(t as any)} className={`px-3 py-1 text-[10px] rounded-full whitespace-nowrap ${filter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {t === 'all' ? '全部' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              {filteredSnippets.map((s) => (
                <SnippetCard key={s.id} snippet={s} onDelete={onDeleteSnippet} onCopy={(t) => navigator.clipboard.writeText(t)} />
              ))}
            </div>

            <div className="p-3 bg-white border-t space-y-2">
              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2 mb-2 text-[10px] text-indigo-600 font-bold animate-pulse">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></span>
                  {statusMsg}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100">圖片</button>
                <button onClick={() => videoInputRef.current?.click()} className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold border border-amber-100">影片</button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'image')} />
              <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'video')} />
              <textarea
                rows={2}
                placeholder="貼上文字或網址..."
                className="w-full p-2 bg-slate-50 border rounded-lg text-xs resize-none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button disabled={isAnalyzing || !inputValue.trim()} onClick={handleAdd} className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:bg-slate-300">儲存</button>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
           <div className="p-4 space-y-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase">同步與儲存</h3>
             <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <p className="text-[10px] text-indigo-700 mb-2 leading-relaxed">提示：採用本地 IndexedDB 儲存。大檔案（>5MB）僅在本地保存，較小筆記會自動同步至雲端金鑰。</p>
             </div>
             <input type="text" placeholder="輸入同步金鑰" className="w-full p-2 border rounded-lg text-xs" value={tempSyncId} onChange={(e) => setTempSyncId(e.target.value)} />
             <button onClick={() => onUpdateSyncId(tempSyncId)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">更新金鑰</button>
             {syncId && <div className="text-[10px] text-emerald-600 text-center font-mono">目前金鑰: {syncId}</div>}
           </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
