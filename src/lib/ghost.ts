import { useCallback, useEffect, useState } from "react";

const KEY = "munjaz.ghost-mode";
const EVENT = "munjaz:ghost-mode";

export function ghostTag(seed?: string | null): string {
  const base = seed ?? "guest";
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 1000;
  return `Ghost_User#${String(h).padStart(3, "0")} 👻`;
}

export function useGhostMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const read = () => setEnabled(window.localStorage.getItem(KEY) === "1");
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const toggle = useCallback((value: boolean) => {
    window.localStorage.setItem(KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
    setEnabled(value);
  }, []);

  return { enabled, toggle };
}
