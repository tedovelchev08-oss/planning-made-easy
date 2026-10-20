/*
 * Built-in photos, served from our own origin (public/images) so loading a
 * page tells no third party who visited. They used to load from an external
 * AI image host; couples' saved choices still hold those addresses, so
 * localPhoto() maps each old address to its local copy wherever a stored
 * photo is read.
 */

export const IMAGES = {
  couple: "/images/couple.jpg",
  hands: "/images/hands.jpg",
  venue: "/images/venue.jpg",
  invGarden: "/images/invitation-garden.jpg",
  invModern: "/images/invitation-modern.jpg",
  invEditorial: "/images/invitation-editorial.jpg",
} as const;

export type ImageKey = keyof typeof IMAGES;

/** The addresses saved before the photos were self-hosted. */
const LEGACY: Record<string, string> = {
  "https://image.qwenlm.ai/generated-images/491b8b3f-233c-48cf-a774-26c3db982f5f/_result.png": IMAGES.couple,
  "https://image.qwenlm.ai/generated-images/f6309e84-9889-4aec-a2b4-f486de575120/_result.png": IMAGES.hands,
  "https://image.qwenlm.ai/generated-images/f74c124f-def3-4623-98e3-16e0ebad553b/_result.png": IMAGES.venue,
  "https://image.qwenlm.ai/generated-images/f7c8598c-c020-4870-a1e4-a6a07f9e33e6/_result.png": IMAGES.invGarden,
  "https://image.qwenlm.ai/generated-images/6f0ee2a3-6bce-43a4-86ee-aef8d7f1b74a/_result.png": IMAGES.invModern,
  "https://image.qwenlm.ai/generated-images/ca117022-d52b-412a-9a23-9ff960ebb026/_result.png": IMAGES.invEditorial,
};

/** A stored photo address, with any old built-in address swapped for its local copy. */
export function localPhoto<T extends string | null | undefined>(src: T): T {
  return (typeof src === "string" && LEGACY[src] ? LEGACY[src] : src) as T;
}

/* ------------------------------ couples' own photos ------------------------------ */

/** the longest side a couple's photo is stored at: sharp on a phone and a laptop, a few hundred KB */
export const PHOTO_MAX_SIDE = 2000;

/** the size a w×h image is stored at, never enlarged */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * A couple's photo, ready to upload: resized and re-encoded as JPEG in the
 * browser. Re-encoding also drops the file's metadata (EXIF), which on a
 * phone photo usually includes where it was taken; guests never get that.
 * Browsers draw the photo upright (EXIF orientation) before it's dropped.
 */
export function preparePhoto(file: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const c = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!c) { reject(new Error("This browser can't prepare the photo.")); return; }
      c.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo couldn't be prepared."))), "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be opened. Try a JPEG copy of it.")); };
    img.src = url;
  });
}
