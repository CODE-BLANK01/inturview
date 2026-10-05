import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand${compact ? " brand-compact" : ""}`}>
      <Image
        src="/logo.svg"
        alt="inturview"
        width={848}
        height={251}
        className="brand-logo"
        priority
      />
    </span>
  );
}
