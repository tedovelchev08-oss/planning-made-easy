import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../../lib/store";
import Shell from "./Shell";

/**
 * The planner needs an account in cloud mode.
 *
 * Without this, a signed-out visitor got an empty planner ("Good morning, .")
 * whose account menu offered only "Sign out" — which had nothing to sign out
 * of — and no way to sign in. Anything they typed was never saved.
 *
 * Signed out, they go to the sign-in page, which brings them back here.
 * Demo mode has no accounts and always renders the planner; so does a cloud
 * session that is still booting, which shows its own loading state.
 */
export default function PlannerGate() {
  const { mode, user, booting } = useApp();
  const { pathname } = useLocation();
  if (mode === "cloud" && !booting && !user) return <Navigate to={`/sign-in?next=${encodeURIComponent(pathname)}`} replace />;
  return <Shell />;
}
