'use server';

import { EdgeTTS } from '@andresaya/edge-tts';
import type { DialogueLine, ResearchResult } from '@/types/podcast';

const HOST_VOICE = 'en-US-AriaNeural';
const GUEST_VOICE = 'en-US-GuyNeural';

function getMockResearch(topic: string): ResearchResult[] {
  return [
    {
      title: `Overview of ${topic}`,
      content: `${topic} is a fascinating subject that has gained significant attention in recent years. Experts have noted its growing impact across multiple industries and fields of study. The core concepts involve understanding how ${topic} affects our daily lives and what the future may hold.`,
      url: 'https://example.com/1',
    },
    {
      title: `Recent developments in ${topic}`,
      content: `New research has revealed groundbreaking developments in ${topic}. Scientists and researchers have made remarkable progress, with several key breakthroughs announced in the past year. These advances promise to transform how we think about and interact with ${topic}.`,
      url: 'https://example.com/2',
    },
    {
      title: `The future of ${topic}`,
      content: `Looking ahead, experts predict that ${topic} will continue to evolve rapidly. Industry leaders are investing heavily in this area, and new applications are emerging regularly. The potential societal impact is enormous, with implications for education, healthcare, and technology.`,
      url: 'https://example.com/3',
    },
  ];
}

async function fetchResearch(topic: string): Promise<ResearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return getMockResearch(topic);
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: topic,
        max_results: 5,
      }),
    });

    if (!res.ok) {
      return getMockResearch(topic);
    }

    const data = await res.json();
    return (data.results ?? []).slice(0, 5).map((r: { title?: string; content?: string; url?: string }) => ({
      title: r.title ?? '',
      content: r.content ?? '',
      url: r.url ?? '',
    }));
  } catch {
    return getMockResearch(topic);
  }
}

function buildDialogueScript(topic: string, research: ResearchResult[]): Array<{ speaker: 'Host' | 'Guest'; text: string }> {
  const points = research.map((r) => r.content);
  const lines: Array<{ speaker: 'Host' | 'Guest'; text: string }> = [];

  lines.push({
    speaker: 'Host',
    text: `Welcome back to AI Spotlight! I'm your host, and today we're diving deep into ${topic}. We've done some fascinating research on this, and I'm joined by our resident expert. Welcome!`,
  });

  lines.push({
    speaker: 'Guest',
    text: `Thanks for having me! I'm really excited to talk about ${topic} today. There's so much happening in this space right now.`,
  });

  if (points[0]) {
    lines.push({
      speaker: 'Host',
      text: `So let's start with the basics. What should our listeners know about ${topic}?`,
    });

    lines.push({
      speaker: 'Guest',
      text: points[0],
    });
  }

  if (points[1]) {
    lines.push({
      speaker: 'Host',
      text: `That's really interesting. I've been reading about some recent developments. Can you tell us more about what's new?`,
    });

    lines.push({
      speaker: 'Guest',
      text: points[1],
    });
  }

  if (points[2]) {
    lines.push({
      speaker: 'Host',
      text: `Wow, those are some significant advances. What about the bigger picture? Where is this all heading?`,
    });

    lines.push({
      speaker: 'Guest',
      text: points[2],
    });
  }

  if (points[3]) {
    lines.push({
      speaker: 'Host',
      text: `And are there any practical applications our listeners should be aware of?`,
    });

    lines.push({
      speaker: 'Guest',
      text: points[3],
    });
  }

  if (points[4]) {
    lines.push({
      speaker: 'Host',
      text: `One last thing — any surprising findings from the research?`,
    });

    lines.push({
      speaker: 'Guest',
      text: points[4],
    });
  }

  lines.push({
    speaker: 'Host',
    text: `This has been an incredible conversation. Thanks so much for breaking down ${topic} for our listeners. Until next time, stay curious!`,
  });

  lines.push({
    speaker: 'Guest',
    text: `Thanks for having me! And to all the listeners — keep exploring and never stop learning. See you next time!`,
  });

  return lines;
}

async function synthesizeLine(text: string, voice: string): Promise<string> {
  try {
    const tts = new EdgeTTS();
    await tts.synthesize(text, voice);
    return tts.toBase64();
  } catch {
    return '';
  }
}

export async function generateEpisode(formData: FormData): Promise<DialogueLine[]> {
  const topic = (formData.get('topic') as string)?.trim();
  if (!topic) {
    throw new Error('Topic is required');
  }

  const research = await fetchResearch(topic);
  const script = buildDialogueScript(topic, research);

  const dialogue: DialogueLine[] = [];
  for (const line of script) {
    const voice = line.speaker === 'Host' ? HOST_VOICE : GUEST_VOICE;
    const audioBase64 = await synthesizeLine(line.text, voice);
    dialogue.push({
      speaker: line.speaker,
      text: line.text,
      audioBase64,
    });
  }

  return dialogue;
}
