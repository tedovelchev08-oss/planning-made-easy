/* Remote photographic assets with a shared fallback treatment. */

export const IMAGES = {
  couple: "https://image.qwenlm.ai/generated-images/491b8b3f-233c-48cf-a774-26c3db982f5f/_result.png",
  hands: "https://image.qwenlm.ai/generated-images/f6309e84-9889-4aec-a2b4-f486de575120/_result.png",
  venue: "https://image.qwenlm.ai/generated-images/f74c124f-def3-4623-98e3-16e0ebad553b/_result.png",
  invGarden: "https://image.qwenlm.ai/generated-images/f7c8598c-c020-4870-a1e4-a6a07f9e33e6/_result.png",
  invModern: "https://image.qwenlm.ai/generated-images/6f0ee2a3-6bce-43a4-86ee-aef8d7f1b74a/_result.png",
  invEditorial: "https://image.qwenlm.ai/generated-images/ca117022-d52b-412a-9a23-9ff960ebb026/_result.png",
} as const;

export type ImageKey = keyof typeof IMAGES;
