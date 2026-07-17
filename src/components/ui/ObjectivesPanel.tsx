"use client";

import { useGameStore } from "@/store/gameStore";

export default function ObjectivesPanel() {
  const level = useGameStore((s) => s.level);
  const completed = useGameStore((s) => s.completed);
  if (!level) return null;

  // Only objectives up to the first incomplete one are revealed, so the
  // mission unfolds like a story instead of a checklist dump.
  const firstIncomplete = level.objectives.findIndex((o) => !completed.includes(o.id));
  const visible =
    firstIncomplete === -1 ? level.objectives : level.objectives.slice(0, firstIncomplete + 1);
  const hidden = level.objectives.length - visible.length;

  return (
    <aside className="objectives">
      <h2 className="objectives__title">📋 Mission Log</h2>
      <ol className="objectives__list">
        {visible.map((o) => {
          const done = completed.includes(o.id);
          return (
            <li key={o.id} className={`objectives__item ${done ? "objectives__item--done" : ""}`}>
              <div className="objectives__head">
                <span className="objectives__check">{done ? "✅" : "▶️"}</span>
                <span className="objectives__name">{o.title}</span>
                <span className="objectives__points">+{o.points}</span>
              </div>
              {!done && <p className="objectives__desc">{o.description}</p>}
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="objectives__item objectives__item--locked">
            🔒 {hidden} more objective{hidden > 1 ? "s" : ""} ahead…
          </li>
        )}
      </ol>
      <p className="objectives__tip">Stuck? Type <code>hint</code> in the console.</p>
    </aside>
  );
}
