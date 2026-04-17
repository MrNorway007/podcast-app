export type EpisodeFormat =
  | 'classic-interview'
  | 'friendly-debate'
  | 'investigative-deep-dive'
  | 'casual-coffee-chat'
  | 'educational-explainer'
  | 'futurist-vision'
  | 'storytelling-narrative'
  | 'breaking-news-analysis';

export interface DialogueLine {
  speaker: 'Host' | 'Guest';
  text: string;
  audioBase64: string;
}

export interface ResearchResult {
  title: string;
  content: string;
  url: string;
}

export interface Episode {
  topic: string;
  format: EpisodeFormat;
  dialogue: DialogueLine[];
}
