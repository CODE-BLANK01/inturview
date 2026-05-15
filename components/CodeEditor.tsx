"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-text-dim">
      Loading editor…
    </div>
  ),
});

export type Language = "python" | "javascript" | "java" | "cpp";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

export const STARTERS: Record<Language, string> = {
  python: `def solve():\n    # write your solution here\n    pass\n`,
  javascript: `function solve() {\n  // write your solution here\n}\n`,
  java: `class Solution {\n    // write your solution here\n}\n`,
  cpp: `class Solution {\npublic:\n    // write your solution here\n};\n`,
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: Language;
}

export function CodeEditor({ value, onChange, language }: Props) {
  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily:
        "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      lineNumbers: "on" as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: language === "python" ? 4 : 2,
      wordWrap: "on" as const,
      renderLineHighlight: "all" as const,
    }),
    [language]
  );

  return (
    <Monaco
      height="100%"
      language={language}
      value={value}
      theme="light"
      onChange={(v) => onChange(v ?? "")}
      options={options}
    />
  );
}
