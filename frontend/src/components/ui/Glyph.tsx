// I quattro glifi del sistema (D6): check, chiudi, chevron, link esterno. Tutti decorativi: il testo sta accanto.
type Props = { name: "check" | "close" | "chevron" | "external"; size?: number };

export function Glyph({ name, size = 24 }: Props) {
  const common = { className: "glyph", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false };
  switch (name) {
    case "check":
      return (
        <svg {...common}>
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "external":
      return (
        <svg {...common}>
          <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
        </svg>
      );
  }
}
