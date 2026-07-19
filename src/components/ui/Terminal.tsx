"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function Terminal() {
  const terminal = useGameStore((s) => s.terminal);
  const runCommand = useGameStore((s) => s.runCommand);
  const dialogCount = useGameStore((s) => s.dialogs.length);
  const editorOpen = useGameStore((s) => s.editor !== null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevDialogCount = useRef(dialogCount);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [terminal]);

  // When a story pop-up (intro or mid-mission event) is fully dismissed, hand
  // focus back to the console so the player can keep typing without a click.
  useEffect(() => {
    if (prevDialogCount.current > 0 && dialogCount === 0 && !editorOpen) {
      inputRef.current?.focus({ preventScroll: true });
    }
    prevDialogCount.current = dialogCount;
  }, [dialogCount, editorOpen]);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    runCommand(cmd);
    setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  };

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal__titlebar">
        <span className="terminal__dot" style={{ background: "#f87171" }} />
        <span className="terminal__dot" style={{ background: "#fbbf24" }} />
        <span className="terminal__dot" style={{ background: "#34d399" }} />
        <span className="terminal__title">sre-console — kubetopia</span>
      </div>
      <div className="terminal__scroll" ref={scrollRef}>
        {terminal.map((line, i) => (
          <pre key={i} className={`terminal__line terminal__line--${line.kind}`}>
            {line.text}
          </pre>
        ))}
      </div>
      <div className="terminal__inputrow">
        <span className="terminal__prompt">$</span>
        <input
          ref={inputRef}
          className="terminal__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder='kubectl get pods   (or "help")'
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="kubectl console"
        />
      </div>
    </div>
  );
}
