'use client';

import { useState, useTransition } from 'react';
import { generateEpisode } from '@/app/actions';
import type { DialogueLine } from '@/types/podcast';
import PodcastPlayer from './PodcastPlayer';

function SkeletonLoader() {
  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-6 py-4 bg-zinc-800/50">
        <div className="h-4 w-40 bg-zinc-700 rounded animate-pulse" />
      </div>
      <div className="px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-zinc-700 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-zinc-700 rounded animate-pulse" />
            <div className="h-3 w-32 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-1 h-10">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-zinc-700"
              style={{
                height: `${20 + Math.random() * 60}%`,
                animation: `pulse-slow 1.5s ease-in-out ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="px-6 pb-4">
        <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2">
          <div className="h-3 w-full bg-zinc-700 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-zinc-700 rounded animate-pulse" />
          <div className="h-3 w-3/5 bg-zinc-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="px-6 pb-4">
        <div className="h-1.5 w-full bg-zinc-800 rounded-full" />
      </div>
      <div className="px-6 pb-6 flex items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse" />
        <div className="w-14 h-14 rounded-full bg-zinc-700 animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse" />
      </div>
      <div className="px-6 pb-4 text-center">
        <p className="text-sm text-zinc-500">Generating episode... This may take a minute.</p>
      </div>
    </div>
  );
}

export function GeneratorForm() {
  const [dialogue, setDialogue] = useState<DialogueLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setDialogue(null);
    startTransition(async () => {
      try {
        const result = await generateEpisode(formData);
        setDialogue(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate episode');
      }
    });
  };

  return (
    <div className="w-full max-w-2xl space-y-8">
      <form action={handleSubmit} className="flex gap-3">
        <input
          name="topic"
          type="text"
          required
          placeholder="Enter a topic (e.g., Quantum Computing, Mars Colonization)"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
        >
          {isPending ? 'Generating...' : 'Generate Episode'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {isPending && <SkeletonLoader />}

      {dialogue && !isPending && <PodcastPlayer dialogue={dialogue} />}
    </div>
  );
}
