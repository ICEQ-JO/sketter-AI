import Link from "next/link";
import { SKETTER_BANNER } from "@/lib/ascii/banner";

interface NavItem {
  index: string;
  label: string;
  description: string;
  href: string;
  external?: boolean;
  icon?: "github";
}

const NAV_ITEMS: NavItem[] = [
  {
    index: "01",
    label: "sketter ai",
    description: "chat with any model to draw",
    href: "/sketter",
  },
  {
    index: "02",
    label: "my drawings",
    description: "your saved diagrams",
    href: "/my-drawings",
  },
  {
    index: "03",
    label: "mermaid → canvas",
    description: "paste mermaid, get a canvas",
    href: "/mermaid",
  },
  {
    index: "04",
    label: "github",
    description: "source, issues, contributions",
    href: "https://github.com/ICEQ-JO/sketter-AI",
    external: true,
    icon: "github",
  },
];

function NavRow({ item, delay }: { item: NavItem; delay: number }) {
  const inner = (
    <>
      <span className="text-sm text-dim">{item.index}</span>
      <span className="flex flex-col gap-1">
        <span className="label flex items-center gap-3 text-2xl text-muted group-hover:text-foreground sm:text-3xl">
          {item.icon === "github" && <GithubMark />}
          {item.label}
          <span className="arrow text-accent">→</span>
        </span>
        <span className="text-sm text-dim">{item.description}</span>
      </span>
    </>
  );
  const className = "sketter-link group flex items-baseline gap-6";
  const style = { animation: `fade-up 0.6s ease-out ${delay}s both` };

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} style={style}>
      {inner}
    </Link>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

interface Doodle {
  className: string;
  width: number;
  height: number;
  viewBox: string;
  paths: string[];
  opacity: number;
  delay: number;
  closed?: boolean;
}

// Faint hand-drawn doodles nodding to the Excalidraw canvas underneath it
// all, scattered across the whole background rather than pinned to corners.
const DOODLES: Doodle[] = [
  {
    className: "-left-10 top-20",
    width: 260,
    height: 180,
    viewBox: "0 0 260 180",
    opacity: 0.08,
    delay: 0,
    paths: ["M10 140 C 60 40, 140 20, 180 70 S 250 130, 230 60"],
  },
  {
    className: "bottom-10 right-0",
    width: 220,
    height: 220,
    viewBox: "0 0 220 220",
    opacity: 0.07,
    delay: 0.3,
    closed: true,
    paths: ["M20 20 L 180 40 L 160 190 L 30 170 Z"],
  },
  {
    className: "right-16 top-10",
    width: 170,
    height: 170,
    viewBox: "0 0 170 170",
    opacity: 0.06,
    delay: 0.6,
    paths: [
      "M25 105 C 22 55, 75 20, 120 40 C 155 56, 150 105, 110 128 C 75 148, 32 135, 25 105",
    ],
  },
  {
    className: "-left-16 top-1/2",
    width: 220,
    height: 140,
    viewBox: "0 0 220 140",
    opacity: 0.06,
    delay: 0.9,
    paths: ["M0 70 C 45 15, 85 125, 130 55 S 195 15, 220 65"],
  },
  {
    className: "bottom-24 left-[8%]",
    width: 150,
    height: 110,
    viewBox: "0 0 150 110",
    opacity: 0.07,
    delay: 1.2,
    paths: ["M10 10 L 65 95 L 115 20 L 140 85"],
  },
  {
    className: "bottom-1/3 right-[22%]",
    width: 100,
    height: 100,
    viewBox: "0 0 100 100",
    opacity: 0.06,
    delay: 1.5,
    paths: ["M50 12 A 36 38 0 1 1 49 12"],
  },
  {
    className: "left-1/3 top-8",
    width: 90,
    height: 60,
    viewBox: "0 0 90 60",
    opacity: 0.05,
    delay: 1.8,
    paths: ["M5 30 C 20 5, 40 5, 45 30 C 50 5, 70 5, 85 30"],
  },
];

export default function LandingPage() {
  return (
    <div className="grain relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ambient vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 50% 45%, rgba(255,138,61,0.07), transparent 60%)",
        }}
      />

      {DOODLES.map((doodle, i) => (
        <svg
          key={i}
          aria-hidden
          className={`doodle pointer-events-none absolute ${doodle.className}`}
          width={doodle.width}
          height={doodle.height}
          viewBox={doodle.viewBox}
          fill="none"
          style={{ opacity: doodle.opacity }}
        >
          {doodle.paths.map((d, j) => (
            <path
              key={j}
              d={d}
              stroke="var(--foreground)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin={doodle.closed ? "round" : undefined}
              style={{ animationDelay: `${doodle.delay}s` }}
            />
          ))}
        </svg>
      ))}

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 sm:px-20">
        <div style={{ animation: "fade-up 0.6s ease-out both" }}>
          <pre
            className="ascii-banner select-none whitespace-pre text-[6px] leading-[7px] text-foreground sm:text-[10px] sm:leading-[11px]"
            aria-label="Sketter"
          >
            {SKETTER_BANNER}
          </pre>
          <p className="mt-4 text-lg text-muted sm:text-xl">
            chat with any ai model to draw and iterate on excalidraw diagrams
          </p>
        </div>

        <nav className="mt-20 flex flex-col gap-9">
          {NAV_ITEMS.map((item, i) => (
            <NavRow key={item.href} item={item} delay={0.1 + i * 0.07} />
          ))}
        </nav>
      </main>

      <footer className="relative z-10 flex items-center justify-between border-t border-border px-8 py-4 text-xs text-dim sm:px-20">
        <span>MIT licensed · local-first, bring your own key</span>
        <span>built by khalid khudari</span>
      </footer>
    </div>
  );
}
