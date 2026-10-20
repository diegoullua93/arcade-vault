"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";

type RevealProps = {
  as?: "section" | "div";
  className?: string;
  children: ReactNode;
};

// Aparece con fade + slide la primera vez que entra en pantalla (.reveal → .reveal.in).
export function Reveal({ as: Tag = "section", className = "", children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={`${className} reveal${shown ? " in" : ""}`.trim()}
    >
      {children}
    </Tag>
  );
}
