import React, { useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../lib/store";
import { authApi } from "../lib/api";
import { Turnstile, turnstileSiteKey, type TurnstileHandle } from "../components/Turnstile";
import { WeddingDayPicker } from "./WeddingDayPicker";
import "./auth.css";

/**
 * Sign in, begin your plan, and the two password pages. Black silk with the
 * two rings; the form on a beige card. On a laptop the left half carries the
 * couple's names as they type them, and where most couples start; on a phone
 * there is only the form.
 */

/* ------------------------------ words ------------------------------ */

/** Supabase's refusals, in words a couple can act on */
export function authMessage(message: string): string {
  if (/captcha/i.test(message)) return "The security check expired or didn't go through. Please try again.";
  if (/invalid login credentials/i.test(message)) return "That email and password don’t match. Check them, or choose a new password with “Forgotten your password?”.";
  if (/already registered|already been registered/i.test(message)) return "There’s already an account with this email. Sign in instead.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/should be different/i.test(message)) return "Choose a password you haven’t used for Twofold before.";
  return message;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Saturday, 18 September 2027" and how many days away, from yyyy-mm-dd */
function spellDay(iso: string): { text: string; days: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const day = new Date(+m[1], +m[2] - 1, +m[3]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { text: `${DAYS[day.getDay()]}, ${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`, days: Math.round((day.getTime() - today.getTime()) / 864e5) };
}

/** where couples usually start, by how far away the day is */
const FIRST_STEPS: [months: number, lead: string, steps: string[]][] = [
  [12, "A year or more out, most couples start with", ["Agree on a budget ceiling", "Draft the first guest list", "Tour three venues"]],
  [9, "Nine months out, most couples start with", ["Book the venue", "Hire a photographer", "Book a caterer tasting"]],
  [6, "Six months out, most couples start with", ["Send save-the-dates", "Book a hair and makeup trial", "Arrange guest hotel blocks"]],
  [3, "Three months out, most couples start with", ["Send invitations", "Order wedding bands", "Choose ceremony music"]],
  [0, "In the final weeks, most couples start with", ["Chase remaining RSVPs", "The final fitting", "Write the vows"]],
];

/**
 * The couple whose plan this browser still holds. Signing out deletes that
 * copy, so this only finds someone whose session ran out on its own; with
 * more than one plan on the device it says nothing.
 */
export function rememberedCouple(): { partnerA: string; partnerB: string; date: string } | null {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("luma.cache."));
    if (keys.length !== 1) return null;
    const w = JSON.parse(localStorage.getItem(keys[0]) ?? "null")?.wedding;
    if (!w || typeof w.partnerA !== "string" || !w.partnerA.trim()) return null;
    return { partnerA: w.partnerA.trim(), partnerB: typeof w.partnerB === "string" ? w.partnerB.trim() : "", date: typeof w.date === "string" ? w.date : "" };
  } catch { return null; }
}

/* ------------------------------ the human check ------------------------------ */

/**
 * Cloudflare's check, only where there's a real account to protect. It stays
 * invisible unless Cloudflare needs the person to tick a box. Tokens are
 * single-use, so every attempt asks for a fresh one.
 */
function useHumanCheck(wanted: boolean) {
  const { mode } = useApp();
  const needed = wanted && mode === "cloud" && !!turnstileSiteKey();
  const widget = useRef<TurnstileHandle>(null);
  const token = useRef<string | null>(null);
  const waiting = useRef<((t: string | null) => void)[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [checking, setChecking] = useState(false);

  const onToken = (t: string | null) => {
    token.current = t;
    if (t) waiting.current.splice(0).forEach((resolve) => resolve(t));
  };
  const take = async (): Promise<string | undefined> => {
    if (!needed || unavailable) return undefined;
    if (token.current) return token.current;
    setChecking(true);
    const t = await new Promise<string | null>((resolve) => {
      waiting.current.push(resolve);
      window.setTimeout(() => resolve(null), 10000);
    });
    setChecking(false);
    if (!t) throw new Error("The security check didn't finish. Check your connection and try again.");
    return t;
  };
  const element = needed ? (
    <div className="tf-auth-check">
      <Turnstile ref={widget} action="auth" appearance="interaction-only" onToken={onToken} onUnavailable={() => setUnavailable(true)} />
      {unavailable && <p className="tf-auth-fine">The security check couldn’t load. If this fails, turn off content blockers or try another browser.</p>}
    </div>
  ) : null;
  return { take, reset: () => widget.current?.reset(), element, checking };
}

/**
 * One attempt: busy while it runs, its error in words, a fresh check after.
 * Choosing a new password needs no check: the emailed link already signed them in.
 */
function useAttempt({ human = true } = {}) {
  const check = useHumanCheck(human);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: (token: string | undefined) => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action(await check.take());
    } catch (err) {
      setError(authMessage((err as Error).message) || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      check.reset();
    }
  };
  return { run, busy, error, setError, check };
}

/* ------------------------------ pieces ------------------------------ */

function Stage({ aside, children, label }: { aside?: React.ReactNode; children: React.ReactNode; label: string }) {
  return (
    <div className="tf-auth">
      <div className="tf-auth-silk" aria-hidden="true"><div className="tf-auth-light" /><div className="tf-auth-glint" /></div>
      <header className="tf-auth-top">
        <Link to="/" aria-label="Twofold, home"><img src="/brand/twofold-wordmark-on-dark.svg" alt="Twofold" width={140} height={18} /></Link>
        <Link to="/" className="tf-auth-home">Home</Link>
      </header>
      <main className="tf-auth-main">
        <section className="tf-auth-aside" aria-hidden="true">{aside}</section>
        <section className="tf-auth-card" aria-label={label}>{children}</section>
      </main>
    </div>
  );
}

function Line({ id, label, hint, extra, children }: { id: string; label: string; hint?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="tf-auth-line">
      <div className="tf-auth-row">
        <label htmlFor={id}>{label}{hint && <small> {hint}</small>}</label>
        {extra}
      </div>
      {children}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="tf-auth-field">
      <input
        id={id} type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={invalid ? "auth-error" : undefined} required
      />
      <button
        type="button" className="tf-auth-show" onClick={() => setShown((v) => !v)}
        aria-pressed={shown} aria-controls={id} aria-label={shown ? "Hide password" : "Show password"} title={shown ? "Hide password" : "Show password"}
      >
        {shown ? <SolitaireEye /> : <ClosedEye />}
      </button>
    </div>
  );
}

/** open: an eye whose pupil is a cut diamond, like the ring on the silk */
function SolitaireEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.8 12s3.8-6.6 10.2-6.6S22.2 12 22.2 12s-3.8 6.6-10.2 6.6S1.8 12 1.8 12z" />
      <path d="M12 8.6l3 3.4-3 3.4-3-3.4z" /><path d="M9 12h6" />
    </svg>
  );
}
/** closed: the same eye, shut, its lashes down */
function ClosedEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 11.5s3.6 5 9.5 5 9.5-5 9.5-5" />
      <path d="M5.2 14.4 3.8 16.4M9 16.1l-.6 2.3M15 16.1l.6 2.3M18.8 14.4l1.4 2" />
    </svg>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="tf-auth-error" id="auth-error" role="alert">{error}</p> : null;
}

function Submit({ busy, checking, children }: { busy: boolean; checking: boolean; children: string }) {
  return (
    <button type="submit" className="tf-auth-send" disabled={busy} aria-busy={busy || undefined}>
      {busy ? (checking ? "Checking the connection…" : `${children}…`) : children}
    </button>
  );
}

/** the names, set large; they come into focus as they're typed */
function Names({ a, b }: { a: string; b: string }) {
  if (!a) return <p className="tf-auth-names is-empty">Your names</p>;
  return <p className="tf-auth-names" key={`${a}|${b}`}>{a}{b && <><i>&amp;</i>{b}</>}</p>;
}

function When({ date }: { date: string }) {
  const day = spellDay(date);
  if (!day) return <p className="tf-auth-when">Your day, whenever you choose it.</p>;
  return (
    <p className="tf-auth-when">
      {day.text}{day.days > 0 ? <>, <b>{day.days} {day.days === 1 ? "day" : "days"} from today</b>.</> : "."}
    </p>
  );
}

/** in demo builds there are no accounts to make */
function DemoNote() {
  return (
    <p className="tf-auth-error" role="status">
      This preview has no accounts. <Link to="/demo">Open the demo planner</Link> instead.
    </p>
  );
}

/** a signed-in couple has nothing to do here */
function useSignedIn() {
  const { mode, user, booting } = useApp();
  return mode === "cloud" && !booting && !!user;
}

/** only paths inside the app, so a link can't send anyone elsewhere */
function nextFrom(params: URLSearchParams) {
  const next = params.get("next") ?? "";
  return /^\/[a-z0-9/-]*$/i.test(next) ? next : "/planner";
}

/* ------------------------------ sign in ------------------------------ */

export function SignInPage() {
  const { mode, toast } = useApp();
  const [params] = useSearchParams();
  const signedIn = useSignedIn();
  const known = useMemo(rememberedCouple, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { run, busy, error, setError, check } = useAttempt();
  const linkExpired = params.get("link") === "expired";

  if (signedIn) return <Navigate to={nextFrom(params)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter the email address you use for Twofold."); return; }
    if (!password) { setError("Enter your password."); return; }
    void run(async (t) => {
      const { error: err } = await authApi.signIn(email.trim(), password, t);
      if (err) throw new Error(err.message);
      toast("Welcome back", "Your plan is right where you left it.");
    });
  };

  const aside = known ? (
    <>
      <div><Names a={known.partnerA} b={known.partnerB} /><When date={known.date} /></div>
      <p className="tf-auth-when">Your plan is just as you left it.</p>
    </>
  ) : (
    <>
      <p className="tf-auth-names">Two of you. One plan.</p>
      <p className="tf-auth-when">Your partner sees the same plan, the moment it changes.</p>
    </>
  );

  return (
    <Stage aside={aside} label="Sign in">
      <h1>{known ? `Welcome back, ${known.partnerA}` : "Welcome back"}</h1>
      <p className="tf-auth-sub">Sign in and your plan opens where you both left it.</p>
      {linkExpired && <p className="tf-auth-error" role="status">That link has expired or was already used. Ask for a new one with “Forgotten your password?”.</p>}
      <form onSubmit={submit} noValidate>
        <Line id="auth-email" label="Email">
          <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required aria-invalid={!!error || undefined} />
        </Line>
        <Line id="auth-password" label="Password" extra={<Link to="/forgotten-password" state={{ email }}>Forgotten your password?</Link>}>
          <PasswordInput id="auth-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
        </Line>
        {check.element}
        {mode === "demo" ? <DemoNote /> : <ErrorLine error={error} />}
        <Submit busy={busy} checking={check.checking}>Sign in</Submit>
        <p className="tf-auth-swap">New here? <Link to="/begin">Begin your plan</Link></p>
      </form>
    </Stage>
  );
}

/* ------------------------------ begin your plan ------------------------------ */

export function BeginPage() {
  const { mode, signupEmail, toast } = useApp();
  const signedIn = useSignedIn();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [date, setDate] = useState("");
  const [email, setEmail] = useState(signupEmail ?? "");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { run, busy, error, setError, check } = useAttempt();

  if (signedIn) return <Navigate to="/planner" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!a.trim()) { setError("Tell us your name, so the plan knows whose it is."); return; }
    if (!email.includes("@")) { setError("Enter an email address you can open: we’ll send a confirmation there."); return; }
    if (password.length < 6) { setError("Passwords need at least six characters."); return; }
    void run(async (t) => {
      const { data, error: err } = await authApi.signUp(email.trim(), password, t, {
        partner_a: a.trim(), partner_b: b.trim(), wedding_date: date,
      });
      if (err) throw new Error(err.message);
      if (!data.session) { setSentTo(email.trim()); return; } // confirmation pending
      toast("Welcome to Twofold", "Your plan is ready to set up.");
    });
  };

  const day = spellDay(date);
  const [, lead, steps] = FIRST_STEPS.find(([months]) => day && day.days / 30.4 >= months) ?? FIRST_STEPS[FIRST_STEPS.length - 1];
  const who = [a && b ? "both" : a || "you", b || "your partner", a || "you"];
  const aside = (
    <>
      <div><Names a={a.trim()} b={b.trim()} /><When date={date} /></div>
      <div className="tf-auth-steps">
        <p>{day ? lead : "Most couples start with"}</p>
        <ul>
          {(day ? steps : ["Set the wedding date", "Agree on a budget ceiling", "Draft the first guest list"]).map((s, i) => (
            <li key={s}><span>{s}</span><span>{who[i]}</span></li>
          ))}
        </ul>
      </div>
    </>
  );

  if (sentTo) {
    return (
      <Stage aside={aside} label="Check your inbox">
        <div role="status">
          <h1>Check your inbox</h1>
          <p className="tf-auth-sub">We sent a link to <strong>{sentTo}</strong>. Open it to confirm your email, and your plan begins. If it hasn’t arrived in a few minutes, look in your spam folder.</p>
          <p className="tf-auth-swap"><button type="button" onClick={() => setSentTo(null)}>Use a different email</button></p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage aside={aside} label="Begin your plan">
      <h1>Begin your plan</h1>
      <p className="tf-auth-sub">Free to start. Your partner joins with one link and sees every change as you make it.</p>
      <form onSubmit={submit} noValidate>
        <div className="tf-auth-two">
          <Line id="auth-a" label="Your name">
            <input id="auth-a" value={a} onChange={(e) => setA(e.target.value)} autoComplete="given-name" maxLength={60} required />
          </Line>
          <Line id="auth-b" label="Your partner" hint="optional">
            <input id="auth-b" value={b} onChange={(e) => setB(e.target.value)} autoComplete="off" maxLength={60} />
          </Line>
        </div>
        <Line id="auth-date" label="Your wedding day" hint="if you know it">
          <WeddingDayPicker id="auth-date" value={date} onChange={setDate} />
        </Line>
        <Line id="auth-email" label="Email">
          <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
        </Line>
        <Line id="auth-password" label="Password" hint="at least six characters">
          <PasswordInput id="auth-password" value={password} onChange={setPassword} autoComplete="new-password" />
        </Line>
        {check.element}
        {mode === "demo" ? <DemoNote /> : <ErrorLine error={error} />}
        <Submit busy={busy} checking={check.checking}>Begin our plan</Submit>
        <p className="tf-auth-fine">By beginning you agree to the <Link to="/terms">terms</Link> and <Link to="/privacy">privacy policy</Link>.</p>
        <p className="tf-auth-swap">Already planning? <Link to="/sign-in">Sign in</Link></p>
      </form>
    </Stage>
  );
}

/* ------------------------------ forgotten password ------------------------------ */

export function ForgottenPasswordPage() {
  const { mode } = useApp();
  // starts from the address typed on sign in, passed along in memory, never in the URL
  const from = useLocation().state as { email?: unknown } | null;
  const [email, setEmail] = useState(typeof from?.email === "string" ? from.email : "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { run, busy, error, setError, check } = useAttempt();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter the email address you use for Twofold."); return; }
    void run(async (t) => {
      const { error: err } = await authApi.reset(email.trim(), t);
      if (err) throw new Error(err.message);
      setSentTo(email.trim());
    });
  };

  const aside = <><p className="tf-auth-names">Two of you. One plan.</p><p className="tf-auth-when">Nothing in your plan changes while you choose a new password.</p></>;

  return (
    <Stage aside={aside} label="Forgotten your password">
      {sentTo ? (
        <div role="status">
          <h1>Check your inbox</h1>
          <p className="tf-auth-sub">If <strong>{sentTo}</strong> has a Twofold account, a link to choose a new password is on its way. It usually arrives within a minute; open it on this device.</p>
          <p className="tf-auth-swap"><Link to="/sign-in">Back to sign in</Link></p>
        </div>
      ) : (
        <>
          <h1>Forgotten your password?</h1>
          <p className="tf-auth-sub">We’ll email you a link to choose a new one.</p>
          <form onSubmit={submit} noValidate>
            <Line id="auth-email" label="Email">
              <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
            </Line>
            {check.element}
            {mode === "demo" ? <DemoNote /> : <ErrorLine error={error} />}
            <Submit busy={busy} checking={check.checking}>Send the link</Submit>
            <p className="tf-auth-swap">Remembered it? <Link to="/sign-in">Sign in</Link></p>
          </form>
        </>
      )}
    </Stage>
  );
}

/* ------------------------------ choose a new password ------------------------------ */

export function NewPasswordPage() {
  const { mode, user, booting, toast } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const { run, busy, error, setError } = useAttempt({ human: false });
  // the reset link signs them in; without that there's nothing to change
  const noSession = mode === "cloud" && !booting && !user;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Passwords need at least six characters."); return; }
    void run(async () => {
      const { error: err } = await authApi.updatePassword(password);
      if (err) throw new Error(err.message);
      toast("Password changed", "Use it next time you sign in.");
      navigate("/planner", { replace: true });
    });
  };

  const aside = <><p className="tf-auth-names">Two of you. One plan.</p><p className="tf-auth-when">Nothing in your plan changes while you choose a new password.</p></>;

  return (
    <Stage aside={aside} label="Choose a new password">
      {noSession ? (
        <div role="status">
          <h1>This link has expired</h1>
          <p className="tf-auth-sub">Password links work once, for a short while. Ask for a new one and open it on this device.</p>
          <p className="tf-auth-swap"><Link to="/forgotten-password">Send a new link</Link></p>
        </div>
      ) : (
        <>
          <h1>Choose a new password</h1>
          <p className="tf-auth-sub">{user?.email ? <>For <strong>{user.email}</strong>. </> : null}You’ll use it from now on, on every device.</p>
          <form onSubmit={submit} noValidate>
            <Line id="auth-password" label="New password" hint="at least six characters">
              <PasswordInput id="auth-password" value={password} onChange={setPassword} autoComplete="new-password" invalid={!!error} />
            </Line>
            {mode === "demo" ? <DemoNote /> : <ErrorLine error={error} />}
            <Submit busy={busy || (mode === "cloud" && booting)} checking={false}>Save the new password</Submit>
          </form>
        </>
      )}
    </Stage>
  );
}
