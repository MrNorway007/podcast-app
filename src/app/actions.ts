'use server';

import { EdgeTTS } from '@andresaya/edge-tts';
import Anthropic from '@anthropic-ai/sdk';
import type { DialogueLine, EpisodeFormat, ResearchResult } from '@/types/podcast';

const HOST_VOICE = 'en-US-AriaNeural';
const GUEST_VOICE = 'en-US-GuyNeural';

const FORMATS: EpisodeFormat[] = ['debate', 'interview', 'storytelling'];

function pickFormat(): EpisodeFormat {
  return FORMATS[Math.floor(Math.random() * FORMATS.length)];
}

function getMockResearch(topic: string): ResearchResult[] {
  return [
    {
      title: `Overview of ${topic}`,
      content: `${topic} is a fascinating subject that has gained significant attention in recent years. Experts have noted its growing impact across multiple industries and fields of study.`,
      url: 'https://example.com/1',
    },
    {
      title: `Recent developments in ${topic}`,
      content: `New research has revealed groundbreaking developments in ${topic}. Scientists and researchers have made remarkable progress, with several key breakthroughs announced in the past year.`,
      url: 'https://example.com/2',
    },
    {
      title: `Controversies around ${topic}`,
      content: `Not everyone agrees on the direction of ${topic}. Critics argue that the hype outpaces reality, while proponents see transformative potential. The debate continues in academic and industry circles.`,
      url: 'https://example.com/3',
    },
  ];
}

async function fetchResearch(topic: string): Promise<ResearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return getMockResearch(topic);
  }

  const queries = [
    topic,
    `${topic} surprising facts controversies`,
    `${topic} latest news breakthroughs 2024 2025`,
  ];

  const allResults: ResearchResult[] = [];

  for (const query of queries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 5,
          include_answer: true,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const results = (data.results ?? []).slice(0, 5).map(
        (r: { title?: string; content?: string; url?: string }) => ({
          title: r.title ?? '',
          content: r.content ?? '',
          url: r.url ?? '',
        }),
      );
      allResults.push(...results);
    } catch {
      // skip failed queries
    }
  }

  if (allResults.length === 0) {
    return getMockResearch(topic);
  }

  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

const FORMAT_INSTRUCTIONS: Record<EpisodeFormat, string> = {
  debate: `FORMAT: DEBATE STYLE
The hosts take OPPOSING sides on aspects of the topic. One is more optimistic/pro, the other is skeptical/critical.
They challenge each other's points, push back on claims, and occasionally concede when the other makes a strong argument.
The energy should be spirited but respectful — think friendly rivals who genuinely enjoy arguing.`,

  interview: `FORMAT: INTERVIEW STYLE
One host plays the curious interviewer, the other is the knowledgeable expert.
The interviewer asks probing follow-up questions, expresses genuine surprise at revelations, and pushes for concrete examples.
The expert shares deep knowledge but also admits uncertainty on some points.
The dynamic should feel like a great long-form interview — think of the best podcast conversations you've heard.`,

  storytelling: `FORMAT: STORYTELLING STYLE
The hosts collaboratively tell the story of this topic — its origins, key moments, turning points, and where it's heading.
One host sets up the narrative threads, the other adds color, context, and surprising details.
They should paint vivid pictures, use analogies, and make the listener feel like they're discovering something.
Think of it as two friends excitedly sharing a story they both find fascinating.`,
};

async function generateDialogueWithAI(
  topic: string,
  format: EpisodeFormat,
  research: ResearchResult[],
): Promise<Array<{ speaker: 'Host' | 'Guest'; text: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildFallbackDialogue(topic, format, research);
  }

  const researchSummary = research
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join('\n\n');

  const systemPrompt = `You are a podcast script writer creating natural, engaging dialogue between two hosts: "Host" (the main presenter, uses en-US-AriaNeural voice) and "Guest" (the co-host/expert, uses en-US-GuyNeural voice).

${FORMAT_INSTRUCTIONS[format]}

CRITICAL RULES FOR NATURAL DIALOGUE:
- Hosts must sound like REAL PEOPLE, not robots reading scripts
- Include natural filler phrases occasionally: "you know", "I mean", "right", "honestly", "look", "here's the thing"
- Hosts should REACT to each other: express surprise ("Wait, really?", "No way!"), laugh ("Ha!", "That's hilarious"), push back ("I don't buy that", "Hold on though")
- Vary sentence length dramatically — mix short punchy reactions with longer explanations
- Hosts should build on each other's points, not just take turns monologuing
- Include at least one moment of genuine disagreement or skepticism
- Vary energy levels — some exchanges should be rapid-fire and excited, others more thoughtful and measured
- Reference specific facts, numbers, dates, and names from the research — no generic talking points
- Each host should have a distinct personality that comes through in how they speak

OUTPUT FORMAT:
Return ONLY a JSON array of objects with "speaker" (either "Host" or "Guest") and "text" fields.
Aim for 10-16 dialogue exchanges total (including opening and closing).
Do NOT wrap in markdown code blocks. Return raw JSON only.`;

  const userPrompt = `Generate a podcast episode about: "${topic}"

Here is the research to draw from (use specific facts, numbers, and details from this):

${researchSummary}

Remember: make it sound like a real conversation between two people who are genuinely engaged with this topic. Use the specific facts and details from the research — don't fall back on generic statements.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (l: { speaker?: string; text?: string }) =>
          (l.speaker === 'Host' || l.speaker === 'Guest') &&
          typeof l.text === 'string',
      )
    ) {
      return parsed;
    }

    return buildFallbackDialogue(topic, format, research);
  } catch {
    return buildFallbackDialogue(topic, format, research);
  }
}

function buildFallbackDialogue(
  topic: string,
  format: EpisodeFormat,
  research: ResearchResult[],
): Array<{ speaker: 'Host' | 'Guest'; text: string }> {
  const points = research.map((r) => r.content);
  const lines: Array<{ speaker: 'Host' | 'Guest'; text: string }> = [];

  if (format === 'debate') {
    lines.push({
      speaker: 'Host',
      text: `Welcome to AI Spotlight! Today we're tackling a topic where we genuinely disagree — ${topic}. I think the potential here is enormous, but my co-host has some serious reservations.`,
    });
    lines.push({
      speaker: 'Guest',
      text: `Look, I'm not saying ${topic} isn't important. But I think we need to pump the brakes a little. The hype is way ahead of the reality right now.`,
    });
  } else if (format === 'interview') {
    lines.push({
      speaker: 'Host',
      text: `Welcome back to AI Spotlight! I've been dying to dig into ${topic} with someone who really knows this space. So — walk me through what's actually happening here.`,
    });
    lines.push({
      speaker: 'Guest',
      text: `Thanks! Yeah, honestly, ${topic} is at such an interesting inflection point right now. Let me break down what's really going on beneath the headlines.`,
    });
  } else {
    lines.push({
      speaker: 'Host',
      text: `Welcome to AI Spotlight! Today we're telling the story of ${topic} — and honestly, the more I researched this, the more fascinating it got.`,
    });
    lines.push({
      speaker: 'Guest',
      text: `Right? I went down a rabbit hole preparing for this. There are details here that I guarantee most people have never heard. Let's get into it.`,
    });
  }

  for (const [i, point] of points.entries()) {
    if (i % 2 === 0) {
      lines.push({
        speaker: 'Host',
        text: `Here's what really stood out to me — ${point}`,
      });
      lines.push({
        speaker: 'Guest',
        text: `That's a fair point, but here's what I think people miss about that...`,
      });
    } else {
      lines.push({
        speaker: 'Guest',
        text: `And get this — ${point}`,
      });
      lines.push({
        speaker: 'Host',
        text: `Wait, really? I hadn't seen that angle before. That changes things.`,
      });
    }
  }

  lines.push({
    speaker: 'Host',
    text: `This has been such a great conversation. I feel like we barely scratched the surface of ${topic}. We'll have to do a follow-up.`,
  });
  lines.push({
    speaker: 'Guest',
    text: `Definitely. Thanks everyone for listening — and hey, let us know what you think. Are we wrong? Are we right? See you next time!`,
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

export async function generateEpisode(
  formData: FormData,
): Promise<{ format: EpisodeFormat; dialogue: DialogueLine[] }> {
  const topic = (formData.get('topic') as string)?.trim();
  if (!topic) {
    throw new Error('Topic is required');
  }

  const format = pickFormat();
  const research = await fetchResearch(topic);
  const script = await generateDialogueWithAI(topic, format, research);

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

  return { format, dialogue };
}
