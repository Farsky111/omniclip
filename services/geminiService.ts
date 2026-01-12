
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSnippet = async (content: string, contentType: string = 'text'): Promise<AIAnalysis> => {
  try {
    let parts: any[] = [];
    
    // 如果是圖片檔案
    if (contentType === 'image' && content.startsWith('data:image')) {
      const base64Data = content.split(',')[1];
      const mimeType = content.split(';')[0].split(':')[1];
      parts = [
        { inlineData: { data: base64Data, mimeType } },
        { text: "請分析這張圖片內容，並以繁體中文回傳 JSON 格式：{\"title\":\"圖片主題\",\"summary\":\"內容摘要\",\"tags\":[\"標籤\"],\"category\":\"分類\"}。" }
      ];
    } 
    // 如果是影片檔案，我們暫時不傳送二進位資料給 AI (因體積太大)，改回傳預設值
    else if (contentType === 'video' && content.startsWith('data:video')) {
       return {
         title: "上傳的影片檔案",
         summary: "已成功儲存本地影片檔案，可點擊下載或直接播放。",
         tags: ["影片"],
         category: "多媒體"
       };
    }
    // 一般文字或網址
    else {
      const truncatedContent = content.substring(0, 2000);
      parts = [{ text: `分析內容並以繁體中文回傳 JSON：{"title":"簡短標題","summary":"50字內摘要","tags":["標籤1"],"category":"分類"}。內容：${truncatedContent}` }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            category: { type: Type.STRING }
          },
          required: ["title", "summary", "tags", "category"]
        },
        temperature: 0.1,
      }
    });

    return JSON.parse(response.text) as AIAnalysis;
  } catch (error) {
    console.error("Gemini 分析失敗:", error);
    return {
      title: contentType === 'image' ? "新圖片筆記" : (contentType === 'video' ? "新影片筆記" : "新文字筆記"),
      summary: "已儲存內容，但自動分析目前不可用。",
      tags: ["未分類"],
      category: "一般"
    };
  }
};
