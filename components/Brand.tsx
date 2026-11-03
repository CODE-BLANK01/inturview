import Image from "next/image";

export function Brand({
  compact = false,
  wordmarkOnly = false,
  symbolOnly = false,
}: {
  compact?: boolean;
  wordmarkOnly?: boolean;
  symbolOnly?: boolean;
}) {
  return (
    <span className={`brand${compact ? " brand-compact" : ""}`}>
      {!wordmarkOnly && (
        <Image
          src="/inturview-symbol.png"
          // The symbol carries the name only when the wordmark is absent.
          alt={symbolOnly ? "inturview" : ""}
          width={40}
          height={40}
          sizes="40px"
          className="brand-symbol"
          priority
        />
      )}
      {!symbolOnly && (
        <Image
          src="/logo.svg"
          alt="inturview"
          width={848}
          height={251}
          className="brand-wordmark"
          priority
        />
      )}
    </span>
  );
}
