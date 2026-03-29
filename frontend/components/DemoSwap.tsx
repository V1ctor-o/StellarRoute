// frontend/components/DemoSwap.tsx
import { useEffect, useRef } from "react";

// Placeholder functions — replace with your actual logic if they exist
const swapBaseQuote = () => {
  console.log("Base/Quote swapped");
};

const refreshQuote = () => {
  console.log("Quote refreshed");
};

export default function DemoSwap() {
  const pairSelectorRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;

      // Prevent shortcuts when typing in input/textarea or if a modal is open
      const isModalOpen = document.body.classList.contains("modal-open"); // adjust if your modals set a different class
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || isModalOpen) return;

      // Ctrl + F → Focus pair selector
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        pairSelectorRef.current?.focus();
      }

      // Ctrl + S → Swap base/quote
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        swapBaseQuote();
      }

      // Ctrl + R → Refresh quote
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refreshQuote();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="demo-swap" style={{ position: "relative", padding: "1rem" }}>
      <label htmlFor="pair-select">Select Pair:</label>
      <select id="pair-select" ref={pairSelectorRef} style={{ marginRight: "1rem" }}>
        <option value="BTC/USD">BTC/USD</option>
        <option value="ETH/USD">ETH/USD</option>
      </select>

      <button onClick={swapBaseQuote} style={{ marginRight: "0.5rem" }}>
        Swap Base/Quote
      </button>
      <button onClick={refreshQuote}>Refresh Quote</button>

      {/* Tooltip / help icon */}
      <div
        className="shortcut-tooltip"
        style={{ position: "absolute", top: 0, right: 0, cursor: "help" }}
        title="Keyboard Shortcuts: Ctrl+F → Focus Pair, Ctrl+S → Swap Base/Quote, Ctrl+R → Refresh Quote"
      >
        ⌨️
      </div>
    </div>
  );
}