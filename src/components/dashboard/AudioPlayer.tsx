"use client";

// Call-recording player: play/pause button and an animated waveform that
// fills as the audio plays. Clicking anywhere on the waveform seeks.

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download } from "lucide-react";

function fmt(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function AudioPlayer({
  src,
  seedKey,
  durationHint,
}: {
  src: string;
  seedKey: string; // deterministic waveform shape per call
  durationHint?: number; // known call length (sec) — used until metadata loads
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint && durationHint > 0 ? durationHint : 0);
  const [error, setError] = useState(false);

  // ~72 deterministic bars; each stretches to fill the track (flex-1) so the
  // waveform spans the full width up to the time readouts.
  const bars = Array.from({ length: 72 }, (_, i) => {
    const seed = (seedKey.charCodeAt(i % seedKey.length) * (i + 7)) % 100;
    return 20 + (seed % 70);
  });

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;
    // Prefer the element's real duration; fall back to the known call length
    // when the stream can't report it yet, so progress still advances.
    const effDuration = () =>
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationHint && durationHint > 0
          ? durationHint
          : 0;
    const onTime = () => {
      setCurrent(audio.currentTime);
      const d = effDuration();
      if (d) setProgress(Math.min(1, audio.currentTime / d));
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(1);
    };
    const onErr = () => setError(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onErr);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onErr);
    };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setError(true));
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const el = waveRef.current;
    if (!audio || !el) return;
    const d =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : durationHint && durationHint > 0
          ? durationHint
          : 0;
    if (!d) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    try {
      audio.currentTime = ratio * d;
    } catch {
      /* stream not seekable yet */
    }
    setProgress(ratio);
    setCurrent(ratio * d);
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-400">
        The recording couldn&apos;t be loaded — it may have expired on the voice provider.
        <a href={src} target="_blank" rel="noreferrer" className="text-accent-600 hover:text-accent-500">
          Try opening it directly
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause recording" : "Play recording"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#301C3F] text-white transition hover:opacity-90"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-400">{fmt(current)}</span>
      <div
        ref={waveRef}
        onClick={seek}
        className="flex h-9 flex-1 cursor-pointer items-center gap-[2px]"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {bars.map((h, i) => {
          const played = i / bars.length <= progress;
          return (
            <span
              key={i}
              className={`min-w-[2px] flex-1 rounded-full transition-colors duration-150 ${
                played ? "bg-[#301C3F]" : "bg-ink-600/50"
              }`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <span className="w-10 shrink-0 font-mono text-xs text-ink-400">{fmt(duration)}</span>
      <a
        href={src}
        download
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
        title="Download recording"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
