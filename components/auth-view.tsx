"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Cloud, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { awsConfigured, configureAws } from "@/lib/aws";
import { useProgress } from "@/app/providers";

type Mode = "sign-in" | "sign-up" | "confirm" | "forgot" | "new-password";

export function AuthView() {
  const [mode, setCurrentMode] = useState<Mode>("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  function setMode(nextMode: Mode) {
    setShowPassword(false);
    setCurrentMode(nextMode);
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { learner, refreshUser } = useProgress();

  async function resendConfirmationCode() {
    if (busy || !email) return;
    setBusy(true); setError(""); setMessage("");
    if (!awsConfigured) { setError("Connect the deployed Cognito environment to enable accounts."); setBusy(false); return; }
    configureAws();
    try {
      const { resendSignUpCode } = await import("aws-amplify/auth");
      await resendSignUpCode({ username: email });
      setMessage("A new verification code was sent to your email.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A new verification code could not be sent.");
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    if (!awsConfigured) { setError("Connect the deployed Cognito environment to enable accounts. Guest learning is fully available meanwhile."); setBusy(false); return; }
    configureAws();
    try {
      const auth = await import("aws-amplify/auth");
      if (mode === "sign-up") {
        const result = await auth.signUp({ username: email, password, options: { userAttributes: { email } } });
        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") { setMode("confirm"); setMessage("We sent a verification code to your email."); }
      } else if (mode === "confirm") {
        await auth.confirmSignUp({ username: email, confirmationCode: code });
        setMode("sign-in"); setMessage("Email verified. You can sign in now.");
      } else if (mode === "sign-in") {
        const result = await auth.signIn({ username: email, password });
        if (result.isSignedIn) { await refreshUser(); window.location.href = "/dashboard"; }
        else if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") { setMode("confirm"); setMessage("Verify your email before signing in. You can resend the code below."); }
      } else if (mode === "forgot") {
        await auth.resetPassword({ username: email });
        setMode("new-password"); setMessage("Check your email for a reset code.");
      } else {
        await auth.confirmResetPassword({ username: email, confirmationCode: code, newPassword: password });
        setMode("sign-in"); setMessage("Password updated. Sign in with your new password.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication could not be completed.");
    } finally { setBusy(false); }
  }

  if (learner) return <main className="auth-page"><div className="auth-card signed-in"><Check size={36} /><span className="eyebrow">Signed in</span><h1>Your progress has a home.</h1><p>{learner.email}</p><Link className="button primary" href="/dashboard">Open progress <ArrowRight size={17} /></Link></div></main>;

  const isCode = mode === "confirm" || mode === "new-password";
  const isPassword = mode === "sign-in" || mode === "sign-up" || mode === "new-password";
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">{mode === "sign-up" ? "Create account" : mode === "confirm" ? "Verify email" : mode.includes("password") || mode === "forgot" ? "Recover account" : "Welcome back"}</span>
        <h2>{mode === "sign-in" ? "Sign in to Koto" : mode === "sign-up" ? "Save your learning" : mode === "confirm" ? "Enter your code" : mode === "forgot" ? "Reset your password" : "Choose a new password"}</h2>
        {!awsConfigured && <div className="config-note"><Cloud size={17} /><p><strong>Local guest build</strong> Cognito activates after the AWS stack is deployed and its environment values are added.</p></div>}
        <form onSubmit={submit}>
          <label><span>Email address</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div></label>
          {isCode && <label><span>Verification code</span><div><Check size={17} /><input value={code} onChange={(event) => setCode(event.target.value)} required inputMode="numeric" autoComplete="one-time-code" /></div></label>}
          {isPassword && <div className="auth-password-field">
            <label htmlFor="auth-password">{mode === "new-password" ? "New password" : "Password"}</label>
            <div className="password-input">
              <LockKeyhole size={17} aria-hidden />
              <input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} pattern={mode === "sign-up" || mode === "new-password" ? "(?=.*[a-z])(?=.*[0-9]).{8,}" : undefined} autoComplete={mode === "sign-up" || mode === "new-password" ? "new-password" : "current-password"} aria-describedby={mode === "sign-up" || mode === "new-password" ? "password-help" : undefined} />
              <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="auth-password" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
            {(mode === "sign-up" || mode === "new-password") && <small id="password-help" className="password-help">At least 8 characters, including a lowercase letter and a number.</small>}
          </div>}
          {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message">{message}</p>}
          <button className="button primary full" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : mode === "confirm" ? "Verify email" : mode === "forgot" ? "Send reset code" : "Update password"}<ArrowRight size={17} /></button>
          {mode === "confirm" && <button type="button" className="auth-secondary-action" disabled={busy || !email} onClick={() => void resendConfirmationCode()}>Resend verification code</button>}
        </form>
        <div className="auth-switches">
          {mode === "sign-in" ? <><button onClick={() => setMode("forgot")}>Forgot password?</button><p>Waiting to verify? <button onClick={() => setMode("confirm")}>Enter or resend a code</button></p><p>New to Koto? <button onClick={() => setMode("sign-up")}>Create an account</button></p></> : <p>Already have an account? <button onClick={() => setMode("sign-in")}>Sign in</button></p>}
        </div>
      </section>
    </main>
  );
}
