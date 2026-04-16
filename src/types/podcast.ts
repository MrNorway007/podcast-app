export type EpisodeFormat = 'debate' | 'interview' | 'storytelling';

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
