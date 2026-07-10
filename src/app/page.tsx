import Link from "next/link";

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
      <span className="text-xs text-dim">{item.index}</span>
      <span className="flex flex-col gap-0.5">
        <span className="label flex items-center gap-2 text-base text-muted group-hover:text-foreground">
          {item.icon === "github" && <GithubMark />}
          {item.label}
          <span className="arrow text-accent">→</span>
        </span>
        <span className="text-xs text-dim">{item.description}</span>
      </span>
    </>
  );
  const className = "sketter-link group flex items-baseline gap-4";
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
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="grain relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ambient vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 25% 40%, rgba(255,138,61,0.07), transparent 60%)",
        }}
      />

      {/* faint hand-drawn doodles, nodding to the Excalidraw canvas underneath it all */}
      <svg
        className="doodle pointer-events-none absolute -left-10 top-20 opacity-[0.08]"
        width="260"
        height="180"
        viewBox="0 0 260 180"
        fill="none"
      >
        <path
          d="M10 140 C 60 40, 140 20, 180 70 S 250 130, 230 60"
          stroke="var(--foreground)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="doodle pointer-events-none absolute bottom-10 right-0 opacity-[0.07]"
        width="220"
        height="220"
        viewBox="0 0 220 220"
        fill="none"
      >
        <path
          d="M20 20 L 180 40 L 160 190 L 30 170 Z"
          stroke="var(--foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <main className="relative z-10 flex flex-1 flex-col items-start justify-center px-8 sm:px-20">
        <div style={{ animation: "fade-up 0.6s ease-out both" }}>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">sketter</h1>
          <p className="mt-1 text-sm text-muted">
            chat with any ai model to draw and iterate on excalidraw diagrams
          </p>
        </div>

        <nav className="mt-14 flex flex-col gap-7">
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
