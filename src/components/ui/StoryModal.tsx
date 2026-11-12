"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import Portrait, { SPEAKERS } from "./Portrait";

/** A pop-up must be on screen this long before the keyboard can dismiss it. */
const KEY_GUARD_MS = 700;

export default function StoryModal() {
  const dialogs = useGameStore((s) => s.dialogs);
  const dismissDialog = useGameStore((s) => s.dismissDialog);
  const cardRef = useRef<HTMLDivElement>(null);
  const shownAt = useRef(0);
  const d = dialogs[0];
  const dialogKey = d ? `${d.title}|${d.body}` : "";

  // Mid-mission pop-ups arrive while the player is typing a command. Move
  // focus to the card itself (NOT the button), so the next Space/Enter of
  // that command cannot dismiss a message nobody has read yet.
  useEffect(() => {
    if (!dialogKey) return;
    shownAt.current = Date.now();
    cardRef.current?.focus({ preventScroll: true });
  }, [dialogKey]);

  if (!d) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="story-card"
        ref={cardRef}
        tabIndex={-1}
        style={{ outline: "none" }}
        onKeyDown={(e) => {
          // Enter advances — but only once the text has had time to be seen,
          // and only when the key was not aimed at the button (which clicks itself).
          if (e.key === "Enter" && e.target === e.currentTarget && Date.now() - shownAt.current > KEY_GUARD_MS) {
            dismissDialog();
          }
        }}
      >
        {d.speaker ? (
          <div className="story-card__speaker">
            <Portrait id={d.speaker} />
            <div className="story-card__speaker-meta">
              <span className="story-card__speaker-name">{SPEAKERS[d.speaker].name}</span>
              <span className="story-card__speaker-role">{SPEAKERS[d.speaker].role}</span>
            </div>
          </div>
        ) : (
          <h3 className="story-card__title">{d.title}</h3>
        )}
        {d.speaker && d.title !== "…" && <h3 className="story-card__title story-card__title--sub">{d.title}</h3>}
        <p className="story-card__body">{d.body}</p>
        <button className="btn btn--primary" onClick={dismissDialog}>
          {dialogs.length > 1 ? "Next ▸" : "Let's go!"}
        </button>
      </div>
    </div>
  );
}
