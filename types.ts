export enum MBTI {
  INTJ = 'INTJ', INTP = 'INTP', ENTJ = 'ENTJ', ENTP = 'ENTP',
  INFJ = 'INFJ', INFP = 'INFP', ENFJ = 'ENFJ', ENFP = 'ENFP',
  ISTJ = 'ISTJ', ISFJ = 'ISFJ', ESTJ = 'ESTJ', ESFJ = 'ESFJ',
  ISTP = 'ISTP', ISFP = 'ISFP', ESTP = 'ESTP', ESFP = 'ESFP'
}

export interface Character {
  id: string;
  mbti: MBTI;
  name: string;
  color: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'link' | 'system';

export interface Message {
  id: string;
  senderId: string; // 'user' or character ID
  senderName: string;
  content: string;
  type: MessageType;
  mediaUrl?: string; // For images/videos
  timestamp: number;
  metadata?: {
    linkTitle?: string;
    linkUrl?: string;
  };
}

export interface ChatSession {
  id: string;
  name: string;
  characters: Character[];
  messages: Message[];
  lastActivity: number;
}

export const MBTI_COLORS: Record<string, string> = {
  INTJ: 'bg-purple-600', INTP: 'bg-purple-500', ENTJ: 'bg-purple-700', ENTP: 'bg-purple-400',
  INFJ: 'bg-green-600', INFP: 'bg-green-500', ENFJ: 'bg-green-700', ENFP: 'bg-green-400',
  ISTJ: 'bg-blue-600', ISFJ: 'bg-blue-500', ESTJ: 'bg-blue-700', ESFJ: 'bg-blue-400',
  ISTP: 'bg-yellow-600', ISFP: 'bg-yellow-500', ESTP: 'bg-yellow-700', ESFP: 'bg-yellow-400',
};

// Response from the "Director" AI
export interface AIActionResponse {
  responses: Array<{
    speakerMbti: MBTI;
    content: string;
    action?: 'none' | 'generate_image' | 'generate_video' | 'search';
    actionQuery?: string; // Prompt for image/video or query for search
  }>;
}
