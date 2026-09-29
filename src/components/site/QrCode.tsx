import { useEffect, useState } from "react";

/** Renders a real QR code (client-side) for any value. */
export function QrCode({ value, size = 176, className = "" }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Loaded only in the browser: qrcode's Node build breaks the live server.
    import("qrcode")
      .then((m) => (m.default ?? m).toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#0B0F17", light: "#FFFFFF" },
    }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className={`grid place-items-center overflow-hidden rounded-xl bg-white p-2 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="QR" width={size} height={size} className="size-full object-contain" />
      ) : (
        <div className="size-full animate-pulse rounded-lg bg-neutral-200" />
      )}
    </div>
  );
}
