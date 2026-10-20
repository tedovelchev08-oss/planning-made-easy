import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState } from "react";

/**
 * The couple's photo uploader: prepared in the browser, stored in the
 * wedding's folder, and the replaced file deleted.
 */
const W = "11111111-1111-4111-8111-111111111111";
const stored = (id: string) => `https://abc.supabase.co/storage/v1/object/public/media/${W}/photos/${id}.jpg`;
const app = { toast: vi.fn(), mode: "cloud" as "cloud" | "demo", weddingId: W as string | null };
const api = { uploadPhoto: vi.fn(async (_w: string, _b: Blob) => stored("new")), deletePhoto: vi.fn(async (_w: string, _u: string) => {}) };
const prepared = new Blob(["jpeg"], { type: "image/jpeg" });
const preparePhoto = vi.fn(async (_f: Blob) => prepared);

vi.mock("../../lib/store", () => ({ useApp: () => app }));
vi.mock("../../lib/sound", () => ({ playChime: vi.fn() }));
vi.mock("../../lib/images", async () => ({ ...(await vi.importActual<object>("../../lib/images")), preparePhoto: (f: Blob) => preparePhoto(f) }));
vi.mock("../../lib/api", async () => ({
  ...(await vi.importActual<object>("../../lib/api")),
  uploadPhoto: (w: string, b: Blob) => api.uploadPhoto(w, b),
  deletePhoto: (w: string, u: string) => api.deletePhoto(w, u),
}));
const { PhotoUpload } = await import("./PhotoUpload");

let saved: string | null;
function Harness({ initial }: { initial: string | null }) {
  const [photo, setPhoto] = useState(initial);
  saved = photo;
  return <PhotoUpload photo={photo} onChange={setPhoto} />;
}
const choose = (file: File) => fireEvent.change(screen.getByLabelText("Upload your invitation photo"), { target: { files: [file] } });
const phonePhoto = () => new File(["x"], "IMG_0042.HEIC", { type: "image/heic" });

beforeEach(() => {
  vi.clearAllMocks();
  app.mode = "cloud";
  app.weddingId = W;
});

describe("PhotoUpload", () => {
  it("prepares the photo, stores it in the wedding's folder and saves its address", async () => {
    render(<Harness initial={null} />);
    choose(phonePhoto());
    await waitFor(() => expect(saved).toBe(stored("new")));
    expect(preparePhoto).toHaveBeenCalledTimes(1);
    expect(api.uploadPhoto).toHaveBeenCalledWith(W, prepared);
    expect(screen.getByRole("img", { name: "Your invitation photo" }).getAttribute("src")).toBe(stored("new"));
  });

  it("replacing a photo deletes the old file", async () => {
    render(<Harness initial={stored("old")} />);
    expect(screen.getByRole("button", { name: /Replace your photo/ })).toBeTruthy();
    choose(phonePhoto());
    await waitFor(() => expect(saved).toBe(stored("new")));
    expect(api.deletePhoto).toHaveBeenCalledWith(W, stored("old"));
  });

  it("removing it clears the address and deletes the file", () => {
    render(<Harness initial={stored("old")} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove it" }));
    expect(saved).toBeNull();
    expect(api.deletePhoto).toHaveBeenCalledWith(W, stored("old"));
  });

  it("never deletes a built-in photo it replaces", async () => {
    render(<Harness initial="/images/couple.jpg" />);
    expect(screen.queryByRole("button", { name: "Remove it" })).toBeNull();
    choose(phonePhoto());
    await waitFor(() => expect(saved).toBe(stored("new")));
    expect(api.deletePhoto).not.toHaveBeenCalled();
  });

  it("refuses a file that isn't a photo, uploading nothing", () => {
    render(<Harness initial={null} />);
    choose(new File(["%PDF"], "menu.pdf", { type: "application/pdf" }));
    expect(app.toast).toHaveBeenCalledWith("We can't use that file", expect.stringMatching(/JPEG/), "warn");
    expect(preparePhoto).not.toHaveBeenCalled();
    expect(api.uploadPhoto).not.toHaveBeenCalled();
  });

  it("says so when the upload fails, and keeps the old photo", async () => {
    api.uploadPhoto.mockRejectedValueOnce(new Error("new row violates row-level security policy"));
    render(<Harness initial={stored("old")} />);
    choose(phonePhoto());
    await waitFor(() => expect(app.toast).toHaveBeenCalledWith("Your photo didn't upload", expect.any(String), "warn"));
    expect(saved).toBe(stored("old"));
    expect(api.deletePhoto).not.toHaveBeenCalled();
  });

  it("in the demo, shows the photo without storing it", async () => {
    app.mode = "demo";
    app.weddingId = null;
    const objectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/demo-photo");
    render(<Harness initial={null} />);
    choose(phonePhoto());
    await waitFor(() => expect(saved).toBe("blob:http://localhost/demo-photo"));
    expect(objectUrl).toHaveBeenCalledWith(prepared);
    expect(api.uploadPhoto).not.toHaveBeenCalled();
  });
});
