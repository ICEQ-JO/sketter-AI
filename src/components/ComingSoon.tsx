import Link from "next/link";

interface ComingSoonProps {
  title: string;
  description: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="grain relative flex min-h-screen w-full flex-col items-start justify-center bg-background px-8 text-foreground sm:px-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 400px at 30% 45%, rgba(255,138,61,0.06), transparent 60%)",
        }}
      />
      <div className="relative z-10" style={{ animation: "fade-up 0.5s ease-out both" }}>
        <p className="text-xs text-dim">coming soon</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
        <Link
          href="/"
          className="sketter-link mt-8 inline-flex items-baseline gap-2 text-sm text-muted hover:text-foreground"
        >
          <span aria-hidden>←</span>
          <span className="label">back to sketter</span>
        </Link>
      </div>
    </div>
  );
}
