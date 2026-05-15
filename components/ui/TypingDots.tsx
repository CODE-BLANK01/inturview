export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={`typing-dots ${className ?? ""}`} aria-label="Interviewer is typing">
      <span />
      <span />
      <span />
    </span>
  );
}
