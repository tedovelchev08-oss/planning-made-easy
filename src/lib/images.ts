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
