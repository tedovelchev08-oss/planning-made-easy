import React, { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useApp } from "../../lib/store";
import { deletePhoto, isUploadedPhoto, photoFileProblem, uploadPhoto } from "../../lib/api";
import { preparePhoto } from "../../lib/images";
import { playChime } from "../../lib/sound";

/**
 * The couple's own photo for their invitation: resized and stripped of its
 * location data in the browser, then stored in the wedding's own folder
 * (media/<wedding>/photos/). A replaced or removed photo is deleted.
 *
 * `photo` is invitation_config.photo; `onChange` saves a new address (or null).
 */
export function PhotoUpload({ photo, onChange, compact = false, label = "your invitation photo" }: {
  photo: string | null;
  onChange: (url: string | null) => void;
  compact?: boolean;
  /** names the file picker and thumbnail when a design asks for several photos */
  label?: string;
}) {
  const { toast, mode, weddingId } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const own = isUploadedPhoto(photo) ? photo : null;

  /** the old file is no longer used anywhere: remove it (quietly; it's only tidying) */
  const forget = (url: string | null) => {
    if (url && mode === "cloud" && weddingId) void deletePhoto(weddingId, url).catch(() => {});
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  const pick = async (file: File) => {
    const problem = photoFileProblem(file);
    if (problem) { toast("We can't use that file", problem, "warn"); return; }
    setBusy(true);
    try {
      const prepared = await preparePhoto(file);
      if (mode !== "cloud" || !weddingId) {
        // demo: nothing to store it in; show it here, and say it won't last
        onChange(URL.createObjectURL(prepared));
        toast("Showing it in the demo", "Photos are saved for real weddings; this one lasts until you leave.", "info");
      } else {
        const url = await uploadPhoto(weddingId, prepared);
        onChange(url);
        toast("Your photo is in", "Guests see it when they open your invitation.");
      }
      playChime("sparkle");
      forget(own);
    } catch (err) {
      toast("Your photo didn't upload", err instanceof Error ? err.message : "Please try again.", "warn");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    onChange(null);
    forget(own);
    toast("Photo removed", undefined, "info");
  };

  return (
    <div className={compact ? "" : "flex items-center gap-4"}>
      {!compact && (
        <span className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/10 bg-ink/5 text-ink-mute">
          {own ? <img src={own} alt={label.charAt(0).toUpperCase() + label.slice(1)} className="h-full w-full object-cover" /> : <ImagePlus size={18} aria-hidden="true" />}
        </span>
      )}
      <span className="flex flex-1 flex-col items-start gap-1.5">
        <button type="button" disabled={busy} aria-busy={busy} onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-[0.8rem] font-bold text-ink transition hover:border-ink/50 disabled:cursor-wait cursor-pointer">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? "Uploading…" : own ? "Replace your photo" : "Upload your photo"}
        </button>
        {own && !busy && (
          <button type="button" onClick={remove} className="text-[0.72rem] font-bold text-ink-mute transition hover:text-blush-deep cursor-pointer">
            Remove it
          </button>
        )}
        {!own && !compact && <span className="text-[0.68rem] font-semibold text-ink-mute">JPEG, PNG, WebP or HEIC. We resize it and remove where it was taken.</span>}
      </span>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" aria-label={`Upload ${label}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
    </div>
  );
}
