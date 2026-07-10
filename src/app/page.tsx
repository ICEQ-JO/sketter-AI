"use client";

import dynamic from "next/dynamic";

// The whole app is canvas/browser-only (Excalidraw touches window at module
// scope) so it's excluded from server prerendering entirely.
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Home() {
  return <App />;
}
