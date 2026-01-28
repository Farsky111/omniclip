
export type ContentType = 'text' | 'url' | 'image' | 'video' | 'file';

export interface Workspace {
  id: string;
  name: string;
  syncId: string;
}

export interface Snippet {
  id: string;
  type: ContentType;
  content: string;
  title?: string;
  summary?: string;
  tags: string[];
  timestamp: number;
  url?: string;
  imageUrl?: string;
}

export interface AIAnalysis {
  title: string;
  summary: string;
  tags: string[];
  category: string;
}
