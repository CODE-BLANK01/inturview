"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "framer-motion";

/** Progressive enhancement: SSR/no-JS content is visible. Never hides reduced-motion content. */
export function Reveal({
  children,
  delay = 0,
  hero = false,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  hero?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let controls: ReturnType<typeof animate> | undefined;
    let played = false;
    const show = () => {
      controls?.stop();
      node.style.opacity = "1";
      node.style.transform = "none";
    };
    const play = () => {
      if (played) return;
      played = true;
      if (preference.matches) {
        show();
        return;
      }
      controls = animate(
        node,
        { opacity: [0, 1], y: [12, 0] },
        { duration: 0.4, delay, ease: [0.2, 0.6, 0.2, 1] },
      );
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    if (hero || preference.matches) play();
    else observer.observe(node);
    const change = () => {
      if (preference.matches) {
        played = true;
        observer.disconnect();
        show();
      }
    };
    preference.addEventListener("change", change);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", change);
      controls?.stop();
    };
  }, [delay, hero]);
  return (
    <div ref={ref} className={`m-reveal ${className}`}>
      {children}
    </div>
  );
}
