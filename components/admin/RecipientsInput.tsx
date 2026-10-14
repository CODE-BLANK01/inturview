"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { parseRecipients, type Recipient } from "@/lib/recipients";

/** Paste from Google Sheets, a CSV upload, or plain emails. Shows exactly what will be sent. */
export function RecipientsInput({ onChange, id = "recipients" }: { onChange: (r: Recipient[]) => void; id?: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const parsed = useMemo(() => parseRecipients(text), [text]);

  useEffect(() => onChange(parsed.recipients), [parsed, onChange]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setFileName("That file is over 2 MB. Split it into smaller lists.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-2">
      <label className="block space-y-1" htmlFor={id}>
        <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Candidates</span>
        <textarea
          id={id}
          className="input min-h-[150px] font-mono text-xs"
          value={text}
          onChange={(e) => { setText(e.target.value); setFileName(null); }}
          placeholder={"Paste from Google Sheets (select the name and email columns, copy, paste here),\nor one per line:\nAda Lovelace, ada@example.com\ngrace@example.com"}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="btn text-sm cursor-pointer">
          <Upload className="h-4 w-4" /> Upload CSV
          <input id={`${id}-file`} type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-text-dim">{fileName}</span>}
        {text.trim() && (
          <span className={parsed.recipients.length ? "text-text-muted" : "text-hard"}>
            <strong>{parsed.recipients.length}</strong> candidate{parsed.recipients.length === 1 ? "" : "s"} ready
            {parsed.duplicates > 0 && ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} skipped`}
            {parsed.truncated && " · list cut at 500; send the rest in another batch"}
          </span>
        )}
      </div>

      {parsed.invalid.length > 0 && (
        <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm">
          <p className="text-hard font-medium">{parsed.invalid.length} row{parsed.invalid.length === 1 ? "" : "s"} can&apos;t be used and will be left out:</p>
          <ul className="mt-1 space-y-0.5 text-text-muted">
            {parsed.invalid.slice(0, 5).map((i) => (
              <li key={`${i.line}-${i.text}`}>Line {i.line}: <code className="text-xs">{i.text}</code> · {i.reason}</li>
            ))}
            {parsed.invalid.length > 5 && <li>…and {parsed.invalid.length - 5} more</li>}
          </ul>
        </div>
      )}

      {parsed.recipients.length > 0 && (
        <div className="panel overflow-hidden">
          <table className="min-w-full text-sm">
            <tbody>
              {parsed.recipients.slice(0, 6).map((r) => (
                <tr key={r.email} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">{r.name ?? <span className="text-text-dim">No name</span>}</td>
                  <td className="px-3 py-1.5 text-text-muted">{r.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.recipients.length > 6 && <p className="px-3 py-1.5 text-xs text-text-dim border-t border-border">…and {parsed.recipients.length - 6} more</p>}
        </div>
      )}
    </div>
  );
}
