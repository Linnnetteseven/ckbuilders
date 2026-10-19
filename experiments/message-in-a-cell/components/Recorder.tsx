"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_RECORDING_BYTES, MAX_RECORDING_SECS } from "@/lib/media";

/**
 * Record a short video or voice note in the browser (MediaRecorder), or pick a
 * file. Bitrates are kept low so 30 seconds stays under the 4 MB upload limit.
 */
export function Recorder({ kind, onDone, onClear, value }: {
  kind: "video" | "voice";
  value?: Blob;
  onDone: (b: Blob) => void;
  onClear: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string>();
  const live = useRef<HTMLVideoElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!value) return;
    const url = URL.createObjectURL(value);
    // Revoked below when the recording changes
    const t = setTimeout(() => setPreview(url), 0);
    return () => { clearTimeout(t); URL.revokeObjectURL(url); };
  }, [value]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };

  const start = async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === "video" ? { video: { width: 640, height: 480, facingMode: "user" }, audio: true } : { audio: true });
      stream.current = s;
      if (live.current && kind === "video") { live.current.srcObject = s; void live.current.play(); }
      const r = new MediaRecorder(s, kind === "video" ? { videoBitsPerSecond: 650_000, audioBitsPerSecond: 64_000 } : { audioBitsPerSecond: 64_000 });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType });
        if (blob.size > MAX_RECORDING_BYTES) setError("That recording is too large. Try a shorter one.");
        else onDone(blob);
      };
      rec.current = r;
      r.start(500);
      setRecording(true);
      setSecs(0);
      const started = performance.now();
      const tick = setInterval(() => {
        const s2 = Math.floor((performance.now() - started) / 1000);
        setSecs(s2);
        if (s2 >= MAX_RECORDING_SECS || r.state !== "recording") { clearInterval(tick); stop(); }
      }, 250);
    } catch {
      setError(kind === "video" ? "We couldn't use your camera. Check the browser permission, or upload a video instead." : "We couldn't use your microphone. Check the browser permission, or upload a file instead.");
    }
  };

  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > MAX_RECORDING_BYTES) { setError("That file is too large (max about 4 MB). Try a shorter clip."); return; }
    setError("");
    onDone(f);
  };

  return (
    <div className="space-y-3">
      {recording && kind === "video" && <video ref={live} muted playsInline className="w-full max-w-sm rounded-2xl bg-black aspect-[4/3] object-cover" />}
      {!recording && value && preview && (
        kind === "video"
          ? <video src={preview} controls playsInline className="w-full max-w-sm rounded-2xl bg-black" />
          : <audio src={preview} controls className="w-full max-w-sm" />
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        {recording ? (
          <button type="button" className="btn" onClick={stop}>Stop · {MAX_RECORDING_SECS - secs}s left</button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => void start()}>{value ? "Record again" : kind === "video" ? "Record a video" : "Record a voice note"}</button>
        )}
        {!recording && (
          <label className="btn btn-ghost cursor-pointer">
            Upload {kind === "video" ? "a video" : "audio"}
            <input type="file" accept={kind === "video" ? "video/*" : "audio/*"} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        {value && !recording && <button type="button" className="text-sm underline" onClick={onClear}>Remove</button>}
      </div>
      <p className="text-sm text-ink-2">Up to {MAX_RECORDING_SECS} seconds. It&apos;s encrypted on your device before it&apos;s uploaded.</p>
      {error && <p className="text-sm text-[#9B2C1F]">{error}</p>}
    </div>
  );
}
