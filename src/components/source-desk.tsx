"use client";

import { useState } from "react";

import type { SourceRecord } from "@/lib/types";

interface SourceDeskProps {
  busy: boolean;
  onSourceReady: (source: SourceRecord) => void;
  onMessage: (message: string, tone?: "info" | "success" | "error") => void;
}

interface ErrorPayload {
  error?: { message?: string };
}

interface SourceResponse extends ErrorPayload {
  source?: SourceRecord;
}

export default function SourceDesk({ busy, onSourceReady, onMessage }: SourceDeskProps) {
  const [mode, setMode] = useState<"paste" | "url">("paste");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  async function saveSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage("Reading the source…");
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputType: mode, title, body, url }),
      });
      const payload = (await response.json()) as SourceResponse;
      const source = payload.source;
      if (!response.ok || !source?.id)
        throw new Error(payload.error?.message ?? "The source could not be saved.");
      onSourceReady(source);
      onMessage(`Source receipt saved · ${source.wordCount.toLocaleString()} words`, "success");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The source could not be saved.", "error");
    }
  }

  return (
    <section className="surface source-desk" aria-labelledby="source-desk-title">
      <div className="section-kicker">01 / source desk</div>
      <div className="section-heading-row">
        <div>
          <h1 id="source-desk-title">What are we working from?</h1>
          <p className="lede">
            Bring one real source. Reeti keeps the decisions attached to what comes next.
          </p>
        </div>
        <span className="proof-stamp">LOCAL WORKSPACE</span>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Source input type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          className={mode === "paste" ? "tab active" : "tab"}
          onClick={() => setMode("paste")}
        >
          Paste text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "url"}
          className={mode === "url" ? "tab active" : "tab"}
          onClick={() => setMode("url")}
        >
          Public URL
        </button>
      </div>

      <form onSubmit={saveSource} className="source-form">
        <label htmlFor="source-title">
          Working title <span>(optional)</span>
        </label>
        <input
          id="source-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Why evaluation is the boring part of RAG"
          maxLength={180}
          autoComplete="off"
        />

        {mode === "url" ? (
          <>
            <label htmlFor="source-url">Article URL</label>
            <input
              id="source-url"
              name="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              required
              autoComplete="url"
            />
            <p className="field-note">
              Reeti reads public HTTP(S) text only. No cookies, logins, or private hosts are sent.
            </p>
          </>
        ) : (
          <>
            <label htmlFor="source-body">Source text</label>
            <textarea
              id="source-body"
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Paste an article, transcript, or newsletter draft here…"
              rows={8}
              minLength={40}
              required
            />
            <p className="field-note">
              At least 40 characters. The source stays in this local workspace.
            </p>
          </>
        )}

        <div className="form-footer">
          <span className="field-note">A source receipt is created before any Mind call.</span>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Reading source…" : "Read source"}
          </button>
        </div>
      </form>
    </section>
  );
}
