const ITEMS = [
  "Crypto 15-minute windows",
  "Hourly and daily markets",
  "TradingView alerts",
  "RSI · MACD · EMA crossovers",
  "Visual node editor",
  "Paper trading on live books",
  "Backtests on real history",
  "Self-custody Deposit Wallet",
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {ITEMS.map((t) => (
        <li key={t} className="flex items-center whitespace-nowrap px-6 text-[15px] text-[var(--c-dim)] sm:text-base">
          <svg viewBox="0 0 16 16" className="mr-6 h-3 w-3 text-[var(--c-pink)]" aria-hidden="true">
            <path d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z" fill="currentColor" />
          </svg>
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function SignalMarquee() {
  return (
    <section aria-label="What Zircon trades" className="relative border-y border-white/10 bg-[rgba(5,7,26,0.66)] py-6">
      <div className="c-marquee overflow-hidden">
        <div className="c-marquee-track flex w-max">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}
