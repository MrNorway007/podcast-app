import { GeneratorForm } from '@/components/GeneratorForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM7 12a5 5 0 0 0 10 0h-2a3 3 0 0 1-6 0H7zm4 7.93A7.001 7.001 0 0 1 5 13H3a9.001 9.001 0 0 0 8 8.93V24h2v-2.07A9.001 9.001 0 0 0 21 13h-2a7.001 7.001 0 0 1-6 6.93V18h-2v1.93z" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            AI Podcast Generator
          </h1>
        </div>
        <p className="text-zinc-400 text-lg text-center max-w-xl">
          Enter any topic and we&apos;ll generate a professional podcast episode with
          AI-powered research and natural text-to-speech voices.
        </p>
      </section>

      {/* Generator */}
      <section className="flex justify-center px-4 pb-24">
        <GeneratorForm />
      </section>
    </main>
  );
}
