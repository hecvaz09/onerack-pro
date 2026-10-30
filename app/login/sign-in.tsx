"use client";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export function LoginForm() {
  const [visible, setVisible] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("next", new URLSearchParams(window.location.search).get("next") || "/projects");
    setPending(true); setError("");
    try {
      const response = await fetch("/api/session", { method: "POST", body: form, credentials: "same-origin" });
      const result = await response.json().catch(() => null);
      if (!response.ok) { setError(result?.error || (response.status === 429 ? "Too many attempts. Wait a minute and try again." : "Sign-in is unavailable. Please try again.")); setPending(false); return; }
      window.location.assign(result.next || "/projects");
    } catch { setError("Couldn’t connect. Check your connection and try again."); setPending(false); }
  }
  return <form className="login-form" onSubmit={submit} aria-busy={pending}>
    <label htmlFor="login-username">Email or username</label><input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="you@company.com" disabled={pending}/>
    <label htmlFor="login-password">Password</label><div className="login-password"><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={1024} placeholder="Enter your password" disabled={pending} aria-describedby={error ? "login-error" : undefined}/><button type="button" className="login-reveal" onClick={()=>setVisible(v=>!v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
    {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
    <button className="login-submit" type="submit" disabled={pending}>{pending ? "Signing in…" : <>Sign in<ArrowRight size={18}/></>}</button>
    <p className="login-help">Use your existing OneRack website credentials.</p>
  </form>;
}
