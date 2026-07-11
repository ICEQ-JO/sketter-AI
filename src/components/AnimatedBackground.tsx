export default function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="ambient-blob ambient-blob-a"
        style={{
          left: "20%",
          top: "30%",
          width: 420,
          height: 420,
          background: "radial-gradient(closest-side, rgba(255,138,61,0.14), transparent 70%)",
        }}
      />
      <div
        className="ambient-blob ambient-blob-b"
        style={{
          right: "15%",
          top: "45%",
          width: 360,
          height: 360,
          background: "radial-gradient(closest-side, rgba(255,138,61,0.1), transparent 70%)",
        }}
      />
      <div
        className="ambient-blob ambient-blob-c"
        style={{
          left: "45%",
          bottom: "10%",
          width: 300,
          height: 300,
          background: "radial-gradient(closest-side, rgba(255,138,61,0.08), transparent 70%)",
        }}
      />
    </div>
  );
}
