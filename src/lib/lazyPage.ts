import { lazy, type ComponentType } from "react";

const RELOADED = "twofold.chunkReload";

/**
 * A screen loaded only when it is opened, so a guest reading an invitation
 * never downloads the seating planner.
 *
 * After a new version is published, a tab left open still asks for the old
 * files, which are gone. The first such failure reloads the page once (the
 * new page knows the new file names); a second failure in the same tab is a
 * real problem and reaches the error screen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any props: the route passes them through
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const page = await load();
      try { sessionStorage.removeItem(RELOADED); } catch { /* storage blocked */ }
      return page;
    } catch (err) {
      let already = true;
      try { already = sessionStorage.getItem(RELOADED) === "1"; sessionStorage.setItem(RELOADED, "1"); } catch { /* storage blocked: don't loop */ }
      if (already) throw err;
      window.location.reload();
      return new Promise<{ default: T }>(() => {}); // the reload takes over
    }
  });
}
