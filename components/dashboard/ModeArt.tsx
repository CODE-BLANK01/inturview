/** Decorative, purpose-built illustrations for the four practice formats. */
export function ModeArt({
  kind,
}: {
  kind: "screen" | "behavioral" | "coding" | "design";
}) {
  return (
    <svg
      viewBox="0 0 260 124"
      fill="none"
      className={`mode-art mode-art-${kind}`}
      aria-hidden="true"
    >
      {kind === "screen" && (
        <>
          <circle cx="195" cy="36" r="24" fill="currentColor" opacity=".07" />
          <rect
            x="43"
            y="19"
            width="137"
            height="55"
            rx="10"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".18"
            transform="rotate(-6 43 19)"
          />
          <path
            d="M61 38H150M61 49H120"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect
            x="91"
            y="58"
            width="126"
            height="49"
            rx="10"
            fill="currentColor"
          />
          <circle cx="116" cy="82" r="3" fill="var(--art-paper)" />
          <circle cx="130" cy="82" r="3" fill="var(--art-paper)" />
          <circle cx="144" cy="82" r="3" fill="var(--art-paper)" />
          <path d="m187 106 14 10v-12" fill="currentColor" />
          <path
            d="m207 26 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
            fill="currentColor"
            opacity=".5"
          />
        </>
      )}
      {kind === "behavioral" && (
        <>
          <path
            d="M45 82C80 82 70 32 111 32S151 91 191 91"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeDasharray="4 5"
          />
          <rect
            x="25"
            y="57"
            width="43"
            height="43"
            rx="11"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".2"
            transform="rotate(-8 25 57)"
          />
          <text
            x="43"
            y="83"
            fill="currentColor"
            fontSize="18"
            fontFamily="Georgia,serif"
            fontStyle="italic"
          >
            S
          </text>
          <rect
            x="82"
            y="10"
            width="45"
            height="45"
            rx="11"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".2"
            transform="rotate(5 82 10)"
          />
          <text
            x="97"
            y="39"
            fill="currentColor"
            fontSize="18"
            fontFamily="Georgia,serif"
            fontStyle="italic"
          >
            T
          </text>
          <rect
            x="139"
            y="43"
            width="44"
            height="44"
            rx="11"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".2"
            transform="rotate(-5 139 43)"
          />
          <text
            x="153"
            y="71"
            fill="currentColor"
            fontSize="18"
            fontFamily="Georgia,serif"
            fontStyle="italic"
          >
            A
          </text>
          <rect
            x="196"
            y="65"
            width="44"
            height="44"
            rx="11"
            fill="currentColor"
            transform="rotate(8 196 65)"
          />
          <text
            x="209"
            y="95"
            fill="var(--art-paper)"
            fontSize="18"
            fontFamily="Georgia,serif"
            fontStyle="italic"
          >
            R
          </text>
        </>
      )}
      {kind === "coding" && (
        <>
          <rect
            x="42"
            y="14"
            width="176"
            height="99"
            rx="9"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".22"
          />
          <path d="M42 36H218" stroke="currentColor" strokeOpacity=".15" />
          <circle cx="55" cy="25" r="2.5" fill="currentColor" opacity=".4" />
          <circle cx="65" cy="25" r="2.5" fill="currentColor" opacity=".25" />
          <circle cx="75" cy="25" r="2.5" fill="currentColor" opacity=".15" />
          <path
            d="m78 56-11 9 11 9m20-18 11 9-11 9m-11-22-5 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M125 58H195M125 69H175M65 91H119M130 91H163"
            stroke="currentColor"
            strokeOpacity=".22"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="216" cy="94" r="18" fill="currentColor" />
          <path
            d="m208 94 5 5 10-10"
            stroke="var(--art-paper)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "design" && (
        <>
          <path
            d="M77 62H110M150 62H183M130 42V23H180M130 82V103H77"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeWidth="1.5"
          />
          <rect
            x="29"
            y="44"
            width="49"
            height="36"
            rx="7"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".3"
          />
          <rect
            x="107"
            y="40"
            width="46"
            height="44"
            rx="9"
            fill="currentColor"
          />
          <path
            d="M119 54h22m-22 8h22m-22 8h13"
            stroke="var(--art-paper)"
            strokeOpacity=".8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="183"
            y="44"
            width="49"
            height="36"
            rx="7"
            fill="var(--art-paper)"
            stroke="currentColor"
            strokeOpacity=".3"
          />
          <path
            d="M46 57H61M46 66H61M199 57H214M199 66H214"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="182" cy="23" r="5" fill="currentColor" opacity=".6" />
          <circle cx="72" cy="103" r="5" fill="currentColor" opacity=".6" />
          <circle cx="91" cy="62" r="3" fill="currentColor" />
          <circle cx="169" cy="62" r="3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
