"use client";

import { useState } from "react";
import { useGameStore, type EditorState } from "@/store/gameStore";

function EditorPanel({ editor }: { editor: EditorState }) {
  const applyEditor = useGameStore((s) => s.applyEditor);
  const closeEditor = useGameStore((s) => s.closeEditor);
  // Seeded from the editor request; the panel is remounted (via key) per request.
  const [text, setText] = useState(editor.content);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="yaml-editor">
        <div className="yaml-editor__titlebar">
          <span className="yaml-editor__title">📜 {editor.title}</span>
          <button className="yaml-editor__close" onClick={closeEditor} aria-label="Cancel edit">
            ✕
          </button>
        </div>
        <textarea
          className="yaml-editor__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="YAML manifest editor"
        />
        {editor.error && (
          <div className="yaml-editor__error" role="alert">
            {editor.error}
          </div>
        )}
        <div className="yaml-editor__actions">
          <span className="yaml-editor__tip">The API server validates on Apply — errors show up right here.</span>
          <button className="btn" onClick={closeEditor}>Cancel</button>
          <button className="btn btn--primary" onClick={() => applyEditor(text)}>Apply ▸</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The drafting table: a YAML editor modal for `kubectl apply -f` and
 * `kubectl edit`. Validation errors from the simulated API server appear
 * under the editor, exactly where you'd read them in a real terminal.
 */
export default function YamlEditor() {
  const editor = useGameStore((s) => s.editor);
  if (!editor) return null;
  // Remount only for a NEW editor request (title changes); a failed Apply
  // updates `error` on the same request and must keep the player's text.
  return <EditorPanel key={editor.title} editor={editor} />;
}
