"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import {
  CONTACT_EMAIL,
  contactEmailHref,
  ContactSchema,
  type ContactErrors,
  type ContactInput,
} from "@/lib/contact";

export function ContactForm({ employer = false }: { employer?: boolean }) {
  const [values, setValues] = useState<ContactInput>({
    name: "",
    email: "",
    message: "",
    topic: employer ? "employers" : "support",
    website: "",
  });
  const [state, setState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [serverError, setServerError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setValues((v) => ({ ...v, topic: employer ? "employers" : "support" }));
  }, [employer]);
  useEffect(() => {
    if (state === "error" || state === "success") feedback.current?.focus();
  }, [state]);
  const change = (field: keyof ContactInput, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === "submitting") return;
    setServerError("");
    const parsed = ContactSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      const first = parsed.error.issues[0]?.path[0];
      form.current
        ?.querySelector<HTMLElement>(`[name="${String(first)}"]`)
        ?.focus();
      return;
    }
    setErrors({});
    setState("submitting");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: ContactErrors;
      };
      if (body.fieldErrors) {
        setErrors(body.fieldErrors);
        setState("idle");
        form.current
          ?.querySelector<HTMLElement>(
            `[name="${Object.keys(body.fieldErrors)[0]}"]`,
          )
          ?.focus();
      } else if (!response.ok || body.ok !== true) {
        throw new Error(
          body.error || "Your message could not be sent. Please try again.",
        );
      } else {
        setState("success");
      }
    } catch (error) {
      setServerError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "The connection timed out. Your message is saved here; please try again.",
      );
      setState("error");
    } finally {
      window.clearTimeout(timeout);
    }
  };
  if (state === "success")
    return (
      <div
        ref={feedback}
        tabIndex={-1}
        className="m-contact-form m-form-success"
        role="status"
      >
        <CheckCircle2 size={32} aria-hidden="true" />
        <h2 className="t-display-3">Message received.</h2>
        <p>
          Thank you for writing. We will reply to{" "}
          <strong>{values.email}</strong>. You can stay right here.
        </p>
        <button
          className="m-button m-button-secondary"
          onClick={() => {
            setValues((v) => ({ ...v, message: "" }));
            setState("idle");
          }}
        >
          Send another message
        </button>
      </div>
    );
  return (
    <form
      ref={form}
      className="m-contact-form"
      onSubmit={submit}
      noValidate
      aria-busy={state === "submitting"}
    >
      <h2 className="t-display-3">
        {employer ? "Let’s talk about your team." : "What’s on your mind?"}
      </h2>
      <div className="m-form-field">
        <label htmlFor="contact-topic">I’m writing about</label>
        <select
          id="contact-topic"
          name="topic"
          value={values.topic}
          onChange={(e) => change("topic", e.target.value)}
          disabled={state === "submitting"}
        >
          <option value="support">Product, account, or feedback</option>
          <option value="employers">An employer partnership</option>
        </select>
      </div>
      {(["name", "email", "message"] as const).map((field) => (
        <div className="m-form-field" key={field}>
          <label htmlFor={`contact-${field}`}>
            {field === "name"
              ? "Name (optional)"
              : field === "email"
                ? "Your email"
                : "Your message"}
          </label>
          {field === "message" ? (
            <textarea
              id="contact-message"
              name={field}
              value={values.message}
              onChange={(e) => change(field, e.target.value)}
              required
              maxLength={5000}
              rows={5}
              placeholder="A little context goes a long way."
              disabled={state === "submitting"}
              aria-invalid={!!errors.message}
              aria-describedby={
                errors.message ? "contact-message-error" : undefined
              }
            />
          ) : (
            <input
              id={`contact-${field}`}
              name={field}
              type={field === "email" ? "email" : "text"}
              value={values[field]}
              onChange={(e) => change(field, e.target.value)}
              autoComplete={field}
              required={field === "email"}
              maxLength={field === "email" ? 200 : 80}
              placeholder={field === "email" ? "you@example.com" : "Your name"}
              disabled={state === "submitting"}
              aria-invalid={!!errors[field]}
              aria-describedby={
                errors[field] ? `contact-${field}-error` : undefined
              }
            />
          )}
          {errors[field] && (
            <p id={`contact-${field}-error`} className="m-field-error">
              {errors[field]?.[0]}
            </p>
          )}
        </div>
      ))}
      <div className="m-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Leave this empty</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => change("website", e.target.value)}
        />
      </div>
      {state === "error" && (
        <div className="m-form-error" role="alert" tabIndex={-1} ref={feedback}>
          {serverError}
        </div>
      )}
      <button
        type="submit"
        className="m-button m-button-primary"
        disabled={state === "submitting"}
      >
        {state === "submitting" ? (
          <>
            <Spinner size={16} /> Sending your message…
          </>
        ) : (
          <>
            Send message <span aria-hidden="true">↗</span>
          </>
        )}
      </button>
      <p className="m-caption">
        Your email is used to reply to this message. Prefer email?{" "}
        <a className="m-inline-link" href={contactEmailHref(values.topic)}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </form>
  );
}
