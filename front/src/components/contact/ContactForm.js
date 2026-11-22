"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import axios from "@/lib/axios";
import styles from "./ContactForm.module.css";

export default function ContactForm() {
  const t = useTranslations("ContactPage");
  const locale = useLocale();
  const lock = useRef(false);
  const statusRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState([]);

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setError("");
    setInvalid([]);
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      name: String(values.get("name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      category: values.get("category"),
      message: String(values.get("message") || "").trim(),
      website: values.get("website"),
      privacy: values.get("privacy") === "on",
      locale,
    };
    try {
      await axios.get("/sanctum/csrf-cookie", { timeout: 15000 });
      // Axios 0.21 does not forward XSRF cookies across origins automatically.
      const csrfCookie = document.cookie.split("; ").find(cookie => cookie.startsWith("XSRF-TOKEN="));
      const headers = { Accept: "application/json" };
      if (csrfCookie) headers["X-XSRF-TOKEN"] = decodeURIComponent(csrfCookie.slice("XSRF-TOKEN=".length));
      const response = await axios.post("/api/contact", payload, {
        timeout: 30000,
        headers,
      });
      if (response.data?.code !== "sent") throw new Error("Unexpected response");
      form.reset();
      setSent(true);
    } catch (failure) {
      const status = failure.response?.status;
      setInvalid(Object.keys(failure.response?.data?.errors || {}));
      setError(status === 422 ? "validation" : status === 429 ? "rateLimit" : status === 419 ? "session" : status === 503 ? "unavailable" : "network");
    } finally {
      lock.current = false;
      setSending(false);
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  return (
    <div className={styles.panel}>
      {sent ? (
        <div ref={statusRef} className={styles.success} role="status" tabIndex={-1}>
          <h2>{t("successTitle")}</h2><p>{t("successBody")}</p>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={sending}>
          <p className={styles.note}>{t("note")}</p>
          {error && <p ref={statusRef} className={styles.error} role="alert" tabIndex={-1}>{t(`errors.${error}`)}</p>}
          <fieldset disabled={sending} className={styles.fields}>
            <div className={styles.row}>
              <label htmlFor="contact-name">{t("name")}</label>
              <input id="contact-name" name="name" autoComplete="name" maxLength={80} aria-invalid={invalid.includes("name")} />
            </div>
            <div className={styles.row}>
              <label htmlFor="contact-email">{t("email")}</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={invalid.includes("email")} />
            </div>
            <div className={styles.row}>
              <label htmlFor="contact-category">{t("category")}</label>
              <select id="contact-category" name="category" defaultValue="" required aria-invalid={invalid.includes("category")}>
                <option value="" disabled>{t("choose")}</option>
                {["feedback", "bug", "content", "privacy", "other"].map(key => <option key={key} value={key}>{t(`categories.${key}`)}</option>)}
              </select>
            </div>
            <div className={styles.row}>
              <label htmlFor="contact-message">{t("message")}</label>
              <textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={8} aria-describedby="contact-hint" aria-invalid={invalid.includes("message")} />
              <p id="contact-hint" className={styles.hint}>{t("messageHint")}</p>
            </div>
            <div className={styles.trap} aria-hidden="true">
              <label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <label className={styles.consent}>
              <input type="checkbox" name="privacy" required aria-invalid={invalid.includes("privacy")} />
              <span>{t.rich("consent", { privacy: chunks => <Link href="/privacy" target="_blank" rel="noopener noreferrer">{chunks}</Link> })}</span>
            </label>
            <button className={styles.submit} type="submit">{sending ? t("sending") : t("submit")}</button>
          </fieldset>
        </form>
      )}
      <p className={styles.fallback}>{t("fallback")} <a href="https://x.com/miki0801388249">X @miki0801388249 ↗</a></p>
    </div>
  );
}
