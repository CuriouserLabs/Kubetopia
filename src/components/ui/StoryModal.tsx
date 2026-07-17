"use client";

import { useGameStore } from "@/store/gameStore";
import Portrait, { SPEAKERS } from "./Portrait";

export default function StoryModal() {
  const dialogs = useGameStore((s) => s.dialogs);
  const dismissDialog = useGameStore((s) => s.dismissDialog);
  if (dialogs.length === 0) return null;
  const d = dialogs[0];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="story-card">
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
        <button className="btn btn--primary" onClick={dismissDialog} autoFocus>
          {dialogs.length > 1 ? "Next ▸" : "Let's go!"}
        </button>
      </div>
    </div>
  );
}
