
import React from 'react';
import { Snippet } from '../types';

interface SnippetCardProps {
  snippet: Snippet;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
}

const SnippetCard: React.FC<SnippetCardProps> = ({ snippet, onDelete, onCopy }) => {
  const isUrl = snippet.type === 'url' || (snippet.type === 'video' && !snippet.content.startsWith('data:'));
  const isDataFile = snippet.content.startsWith('data:');
  
  const typeLabels: Record<string, string> = {
    'url': '網址',
    'image': '圖片',
    'text': '文字',
    'video': '影片'
  };

  const handleDownload = () => {
    if (!isDataFile && !isUrl) return;
    
    const link = document.createElement('a');
    link.href = snippet.content;
    const extension = snippet.type === 'image' ? 'png' : (snippet.type === 'video' ? 'mp4' : 'txt');
    link.download = `OmniClip_${snippet.id.substring(0, 5)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderVideo = (content: string) => {
    // 檢查是否為 YouTube 連結
    const ytMatch = content.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
    }
    
    // 直接使用 video src 播放 Data URL 或 MP4 連結
    return (
      <div className="mt-2 rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
        <video 
          controls 
          className="w-full h-full"
          src={content}
          preload="metadata"
        >
          您的瀏覽器不支援播放此影片。
        </video>
      </div>
    );
  };

  return (
    <div className="group relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 mb-3 overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
          snippet.type === 'url' ? 'bg-blue-100 text-blue-700' :
          snippet.type === 'image' ? 'bg-purple-100 text-purple-700' :
          snippet.type === 'video' ? 'bg-amber-100 text-amber-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {typeLabels[snippet.type] || snippet.type}
        </span>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {(isDataFile || isUrl) && (
             <button onClick={handleDownload} className="p-1 hover:bg-emerald-50 rounded text-emerald-500" title="下載檔案">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             </button>
          )}
          <button onClick={() => onCopy(snippet.content)} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="複製內容">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          </button>
          <button onClick={() => onDelete(snippet.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {snippet.title && <h3 className="text-sm font-semibold text-slate-800 mb-1 leading-tight line-clamp-2">{snippet.title}</h3>}

      {snippet.type === 'image' ? (
        <div className="mt-2 rounded-lg overflow-hidden bg-slate-100 aspect-video">
           <img src={snippet.content} alt="Clipped" className="w-full h-full object-cover" />
        </div>
      ) : snippet.type === 'video' ? (
        renderVideo(snippet.content)
      ) : (
        <p className={`text-xs text-slate-600 mb-2 leading-relaxed ${isUrl ? 'break-all line-clamp-1 italic text-blue-500 underline' : 'line-clamp-4'}`}>
          {isUrl ? <a href={snippet.content} target="_blank" rel="noopener noreferrer">{snippet.content}</a> : snippet.content}
        </p>
      )}

      {snippet.summary && (
        <div className="mt-2 bg-slate-50 p-2 rounded-md border-l-2 border-indigo-400">
           <p className="text-[11px] text-slate-500 italic">AI 摘要：{snippet.summary}</p>
        </div>
      )}

      {snippet.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {snippet.tags.map((tag, idx) => <span key={idx} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">#{tag}</span>)}
        </div>
      )}
      
      <div className="mt-2 text-[9px] text-slate-400 text-right">{new Date(snippet.timestamp).toLocaleString('zh-TW')}</div>
    </div>
  );
};

export default SnippetCard;
