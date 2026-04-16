'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DialogueLine } from '@/types/podcast';

function WaveformBar({ index, playing }: { index: number; playing: boolean }) {
  return (
    <div
      className="w-1 rounded-full bg-indigo-500"
      style={{
        height: '100%',
        animation: playing ? `waveform 0.8s ease-in-out ${index * 0.1}s infinite` : 'none',
        transform: playing ? undefined : 'scaleY(0.3)',
        transition: 'transform 0.3s ease',
      }}
    />
  );
}

function Waveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-center gap-[3px] h-10">
      {Array.from({ length: 24 }, (_, i) => (
        <WaveformBar key={i} index={i} playing={playing} />
      ))}
    </div>
  );
}

export default function PodcastPlayer({ dialogue }: { dialogue: DialogueLine[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const total = dialogue.length;
  const current = dialogue[currentIndex];

  const playSegment = useCallback((index: number) => {
    const segment = dialogue[index];
    if (!segment?.audioBase64) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }

    const audio = new Audio(`data:audio/mp3;base64,${segment.audioBase64}`);
    audio.volume = volume;
    audioRef.current = audio;

    audio.onended = () => {
      if (index < dialogue.length - 1) {
        setCurrentIndex(index + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.play().catch(() => setIsPlaying(false));
  }, [dialogue, volume]);

  useEffect(() => {
    if (isPlaying) {
      playSegment(currentIndex);
    }
  }, [currentIndex, isPlaying, playSegment]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  };

  const prev = () => {
    audioRef.current?.pause();
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    if (isPlaying) {
      playSegment(newIndex);
    }
  };

  const next = () => {
    audioRef.current?.pause();
    if (currentIndex < total - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      if (isPlaying) {
        playSegment(newIndex);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const isHost = current?.speaker === 'Host';

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-800/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-sm font-medium text-zinc-400">AI Spotlight Podcast</span>
        </div>
        <span className="text-sm text-zinc-500">
          Segment {currentIndex + 1} of {total}
        </span>
      </div>

      {/* Speaker & Waveform */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-4 mb-5">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
              isHost ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {isHost ? 'H' : 'G'}
          </div>
          <div>
            <p className={`font-semibold ${isHost ? 'text-indigo-400' : 'text-emerald-400'}`}>
              {current?.speaker}
            </p>
            <p className="text-xs text-zinc-500">
              {isHost ? 'en-US-AriaNeural' : 'en-US-GuyNeural'}
            </p>
          </div>
        </div>

        <Waveform playing={isPlaying} />
      </div>

      {/* Script text */}
      <div className="px-6 pb-4">
        <p className="text-zinc-300 text-sm leading-relaxed bg-zinc-800/50 rounded-xl p-4 min-h-[80px]">
          {current?.text}
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Previous segment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            disabled={currentIndex === total - 1}
            className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Next segment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 18h2V6h-2v12zM4 18l8.5-6L4 6v12z" />
            </svg>
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-500">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-indigo-500"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
