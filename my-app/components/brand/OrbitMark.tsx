import { useId } from "react";

export function OrbitMark({ className }: { className?: string }) {
  const id = `om${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-p`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe3f1" />
          <stop offset="45%" stopColor="#e0619f" />
          <stop offset="100%" stopColor="#4b2f9e" />
        </radialGradient>
      </defs>
      <path d="M4.5 21.5c-2.2-3.3 3.6-8.6 12.9-11.8 5.4-1.9 10.1-2.3 11.6-.9" fill="none" stroke="#f3e2f7" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="7.5" fill={`url(#${id}-p)`} />
      <path d="M28.9 8.8c2.2 3.3-3.6 8.6-12.9 11.8-5.4 1.9-10.1 2.3-11.6.9" fill="none" stroke="#f3e2f7" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="27.4" cy="6.2" r="1.2" fill="#fff" />
    </svg>
  );
}
