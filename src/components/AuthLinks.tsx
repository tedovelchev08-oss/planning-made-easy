import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Where an emailed link lands. A password-reset link signs the person in;
 * the next step is choosing the new password, not the homepage. An expired
 * or reused link says so on the sign-in page.
 *
 * Once only: the flags describe how the app was opened, so they stay true for
 * the whole visit, and react-router hands out a new navigate() on every route
 * change. Redirecting each time sent "Home", the logo and even the planner
 * (after saving the new password) straight back to /new-password.
 */
export default function AuthLinks({ reset, linkError }: { reset: boolean; linkError: boolean }) {
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (reset) navigate("/new-password", { replace: true });
    else if (linkError) navigate("/sign-in?link=expired", { replace: true });
  }, [navigate, reset, linkError]);
  return null;
}
