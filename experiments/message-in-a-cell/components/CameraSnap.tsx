"use client";
import { useEffect, useRef, useState } from "react";

/**
 * "Take a photo" with a live camera preview and a shutter button. Works on
 * laptops too, where a plain file input with `capture` would just open a file
 * picker.
 */
export function CameraSnap({ onPhoto, onClose }: { onPhoto: (b: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; void video.current.play(); }
      })
      .catch(() => { if (!cancelled) setError("We couldn't open your camera. Check the browser permission, or choose a photo instead."); });
    return () => { cancelled = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) { onPhoto(b); onClose(); } }, "image/jpeg", 0.92);
  };

  return (
    <div className="card relative p-3 space-y-3 max-w-sm">
      {error ? <p className="text-tomato text-sm p-2">{error}</p> : (
        <video ref={video} muted playsInline className="w-full aspect-square object-cover rounded-xl bg-ink" aria-label="Camera preview" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!error && <button type="button" className="btn" onClick={snap}>Snap</button>}
        {!error && <button type="button" className="btn btn-ghost !text-xs" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>Flip camera</button>}
        <button type="button" className="text-sm underline" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
