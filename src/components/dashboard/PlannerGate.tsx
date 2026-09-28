import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../lib/store";
import { Logo, btn } from "../ui";
import Shell from "./Shell";

/**
 * The planner needs an account in cloud mode.
 *
 * Without this, a signed-out visitor got an empty planner ("Good morning, .")
 * whose account menu offered only "Sign out" — which had nothing to sign out
 * of — and no way to sign in. Anything they typed was never saved.
 *
 * Demo mode has no accounts and always renders the planner; so does a cloud
 * session that is still booting, which shows its own loading state.
 */
export default function PlannerGate() {
  const { mode, user, booting, setAuthOpen } = useApp();
  const signedOut = mode === "cloud" && !booting && !user;

  // arriving signed out (or signing out here) opens the sign-in straight away
  useEffect(() => {
    if (signedOut) setAuthOpen(true);
  }, [signedOut, setAuthOpen]);

  if (!signedOut) return <Shell />;

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[1.8rem] border border-white/70 bg-white/70 p-8 text-center shadow-card backdrop-blur-md sm:p-10">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 font-display text-3xl text-ink">Sign in to your planner</h1>
        <p className="mt-3 text-[0.92rem] font-semibold leading-relaxed text-ink-2">
          Your plan lives in your account, so it's there on every device.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => setAuthOpen(true)} className={btn.ink}>Sign in</button>
          <Link to="/" className={btn.ghost}>Back to home</Link>
        </div>
      </div>
    </main>
  );
}
