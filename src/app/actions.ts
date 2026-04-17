'use server';

import { generateText, gateway } from 'ai';
import { EdgeTTS } from '@andresaya/edge-tts';
import type { DialogueLine, EpisodeFormat, ResearchResult } from '@/types/podcast';

const HOST_VOICE = 'en-US-AriaNeural';
const GUEST_VOICE = 'en-US-GuyNeural';

const FORMATS: EpisodeFormat[] = [
  'classic-interview',
  'friendly-debate',
  'investigative-deep-dive',
  'casual-coffee-chat',
  'educational-explainer',
  'futurist-vision',
  'storytelling-narrative',
  'breaking-news-analysis',
];

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

// Eight distinct system prompts — each shapes a completely different style, tone, and dynamic
const FORMAT_SYSTEM_PROMPTS: Record<EpisodeFormat, string> = {
  'classic-interview': `You are a podcast scriptwriter crafting a classic interview-style episode. The HOST is an experienced journalist asking sharp, probing questions. The GUEST is a domain expert sharing genuine insights and personal anecdotes. Style: professional yet warm. Tone: curious and insightful. Include natural filler phrases like "you know", "right", and "honestly". Hosts should react to each other with genuine surprise or enthusiasm.`,

  'friendly-debate': `You are a podcast scriptwriter crafting a spirited debate. The HOST takes a skeptical or contrarian position. The GUEST champions the mainstream or optimistic view. Style: energetic and playful. Tone: witty, argumentative but respectful — rivals who enjoy sparring. Include at least two direct challenges and one moment where each concedes a point.`,

  'investigative-deep-dive': `You are a podcast scriptwriter crafting an investigative journalism episode. The HOST is a reporter uncovering surprising findings step by step. The GUEST is an insider source with exclusive knowledge. Style: dramatic and revealing. Tone: serious and suspenseful, building toward a key revelation that reframes everything. Vary energy — some exchanges hushed and tense, others urgent.`,

  'casual-coffee-chat': `You are a podcast scriptwriter crafting a casual, intimate conversation. The HOST and GUEST are old friends who happen to be deeply knowledgeable. Style: relaxed and humorous. Tone: conversational, self-deprecating, funny — with natural tangents, interruptions, and laughter. Use informal language, slang, and banter. Make it sound like eavesdropping on a great coffee chat.`,

  'educational-explainer': `You are a podcast scriptwriter crafting an educational episode. The HOST is a curious newcomer asking genuine beginner questions. The GUEST is a patient, brilliant teacher who breaks down complexity using vivid analogies and everyday examples. Style: clear and methodical. Tone: enthusiastic and accessible — every listener should feel smart by the end.`,

  'futurist-vision': `You are a podcast scriptwriter crafting a bold, forward-looking episode. Both HOST and GUEST are visionary thinkers speculating about what comes next. Style: imaginative and provocative. Tone: optimistic but grounded — surprising predictions that feel plausible. Push each other to go further, challenge assumptions, and paint vivid pictures of possible futures.`,

  'storytelling-narrative': `You are a podcast scriptwriter crafting a narrative storytelling episode. The HOST sets scenes and narrates like a skilled storyteller. The GUEST shares personal stories and lived experiences that illuminate the topic emotionally. Style: cinematic and emotional. Tone: human, vulnerable, dramatic — with sensory details, character moments, and a story arc that builds to an insight.`,

  'breaking-news-analysis': `You are a podcast scriptwriter crafting a breaking news analysis episode. The HOST is a news anchor delivering rapid, urgent updates. The GUEST is a field analyst with live insight. Style: fast-paced and authoritative. Tone: urgent, matter-of-fact, incisive — short sentences, active voice, punchy reactions. Create a sense of events unfolding in real time.`,
};

const COMMON_DIALOGUE_RULES = `CRITICAL RULES FOR NATURAL DIALOGUE:
- Hosts must sound like REAL PEOPLE, not robots reading scripts
- Include natural filler phrases occasionally: "you know", "I mean", "right", "honestly", "look", "here's the thing"
- Hosts should REACT to each other: express surprise ("Wait, really?", "No way!"), push back ("I don't buy that", "Hold on though")
- Vary sentence length dramatically — mix short punchy reactions with longer explanations
- Reference specific facts, numbers, and details from the research — no generic talking points
- Each host should have a distinct personality that comes through in how they speak

OUTPUT FORMAT:
Return ONLY a JSON array of objects with "speaker" (either "Host" or "Guest") and "text" fields.
Aim for 10-16 dialogue exchanges total. Do NOT wrap in markdown code blocks. Return raw JSON only.`;

async function generateDialogueWithAI(
  topic: string,
  format: EpisodeFormat,
  research: ResearchResult[],
): Promise<Array<{ speaker: 'Host' | 'Guest'; text: string }>> {
  const researchSummary = research
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join('\n\n');

  const systemPrompt = `You are a podcast script writer creating natural, engaging dialogue between two hosts: "Host" (main presenter, en-US-AriaNeural voice) and "Guest" (co-host/expert, en-US-GuyNeural voice).

${FORMAT_SYSTEM_PROMPTS[format]}

${COMMON_DIALOGUE_RULES}`;

  const userPrompt = `Generate a podcast episode about: "${topic}"

Research to draw from (use specific facts, numbers, and details — do not fall back on generic statements):

${researchSummary}`;

  try {
    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4-6'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 4096,
    });

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

  const openings: Record<EpisodeFormat, [string, string]> = {
    'classic-interview': [
      `Welcome back to AI Spotlight! I've been dying to dig into ${topic} with someone who really knows this space. Walk me through what's actually happening here.`,
      `Thanks! Yeah, honestly, ${topic} is at such an interesting inflection point right now. Let me break down what's really going on beneath the headlines.`,
    ],
    'friendly-debate': [
      `Welcome to AI Spotlight! Today we're tackling a topic where we genuinely disagree — ${topic}. I think the potential here is enormous, but my co-host has serious reservations.`,
      `Look, I'm not saying ${topic} isn't important. But the hype is way ahead of the reality right now, and we need to talk about that.`,
    ],
    'investigative-deep-dive': [
      `Something about ${topic} didn't add up. The official story, the public narrative — it felt incomplete. So we dug deeper.`,
      `And what we found was... not what we expected. There are layers here that most people simply don't know about.`,
    ],
    'casual-coffee-chat': [
      `Okay so I went down a total rabbit hole on ${topic} this week and I cannot stop thinking about it. Like, did you know—`,
      `Oh I have been waiting for you to bring this up. Because I have thoughts. So many thoughts. Where do we even start?`,
    ],
    'educational-explainer': [
      `Okay so I keep hearing about ${topic} everywhere but I genuinely don't understand it. Can you break it down for me like I'm five?`,
      `Ha, totally fair question — and honestly, most people don't fully get it either. Let's start from the very beginning.`,
    ],
    'futurist-vision': [
      `If you had to bet on where ${topic} is in ten years — like, really bet — what would you say?`,
      `Honestly? I think we're wildly underestimating it. The thing most people miss is that the trajectory isn't linear, it's exponential.`,
    ],
    'storytelling-narrative': [
      `Picture this: the moment ${topic} changed everything. Not a slow evolution — a single pivot point. And it starts with a story most people have never heard.`,
      `I love this framing because the history here is so much stranger than the textbooks suggest. There's a human drama at the center of all of it.`,
    ],
    'breaking-news-analysis': [
      `Breaking developments on ${topic} — and this is moving fast. I've got our analyst live. What are you seeing right now?`,
      `It's significant. And I want to be clear about why this matters — this isn't just another incremental update. The implications are substantial.`,
    ],
  };

  const [hostOpen, guestOpen] = openings[format];
  lines.push({ speaker: 'Host', text: hostOpen });
  lines.push({ speaker: 'Guest', text: guestOpen });

  for (const [i, point] of points.entries()) {
    if (i % 2 === 0) {
      lines.push({ speaker: 'Host', text: `Here's what really stood out to me — ${point}` });
      lines.push({ speaker: 'Guest', text: `That's a fair point, but here's what I think people miss about that...` });
    } else {
      lines.push({ speaker: 'Guest', text: `And get this — ${point}` });
      lines.push({ speaker: 'Host', text: `Wait, really? I hadn't seen that angle before. That changes things.` });
    }
  }

  lines.push({
    speaker: 'Host',
    text: `This has been such a great conversation. I feel like we barely scratched the surface of ${topic}. We'll have to do a follow-up.`,
  });
  lines.push({
    speaker: 'Guest',
    text: `Definitely. Thanks everyone for listening — and hey, let us know what you think. See you next time!`,
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
