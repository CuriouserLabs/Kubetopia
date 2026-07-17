"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

function Notice({ id, text }: { id: number; text: string }) {
  const expire = useGameStore((s) => s.expireNotice);
  useEffect(() => {
    const t = setTimeout(() => expire(id), 4000);
    return () => clearTimeout(t);
  }, [id, expire]);
  return <div className="notice">{text}</div>;
}

export default function Notices() {
  const notices = useGameStore((s) => s.notices);
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => (
        <Notice key={n.id} id={n.id} text={n.text} />
      ))}
    </div>
  );
}
