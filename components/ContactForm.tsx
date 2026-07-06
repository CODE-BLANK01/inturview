"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8 space-y-4">
      <label className="block">
        <span className="t-eyebrow text-text-dim">Name</span>
        <input
          className="input mt-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={80}
        />
      </label>

      <label className="block">
        <span className="t-eyebrow text-text-dim">Email</span>
        <input
          className="input mt-2"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={200}
        />
      </label>

      <label className="block">
        <span className="t-eyebrow text-text-dim">Message</span>
        <textarea
          className="input mt-2 min-h-[160px] resize-y"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          minLength={10}
          maxLength={5000}
          rows={6}
        />
      </label>

      <button type="submit" className="btn btn-primary w-full sm:w-auto px-8 py-3">
        Send message
        <span aria-hidden>↗</span>
      </button>
    </form>
  );
}
