const DEFAULT_PRICE = 0.05;

export function rentPrice(priceUsdc: number | null | undefined): number {
  return priceUsdc && priceUsdc > 0 ? priceUsdc : DEFAULT_PRICE;
}

/**
 * The monetization surface: a published strategy is rentable per call, settled
 * through KeeperHub's x402 marketplace. The verifiable track record above is
 * what makes renting safe — a buyer pays for a proven edge, not a screenshot.
 */
export default function RentPanel({ workflowId, priceUsdc }: { workflowId: string; priceUsdc: number | null }) {
  const price = rentPrice(priceUsdc);
  return (
    <section className="c-panel mt-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-[rgba(224,97,159,0.12)] to-[rgba(146,119,245,0.1)] p-6">
        <div>
          <h2 className="font-semibold">Rent this strategy</h2>
          <p className="mt-1 max-w-lg text-sm text-[var(--c-dim)]">
            Any agent — or another trader — can call this strategy&rsquo;s live signal and pay the author per use. Payment
            settles through KeeperHub&rsquo;s x402 marketplace; the author keeps the edge, the caller skips the research.
          </p>
        </div>
        <div className="text-right">
          <div className="c-serif text-4xl leading-none text-white">
            ${price.toFixed(2)}
          </div>
          <div className="c-mono mt-1 text-[11px] uppercase tracking-wider text-[var(--c-faint)]">USDC · per call</div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 sm:grid-cols-3">
        {[
          ["1 · Verify", "Read the on-chain-scored record below. No trust required."],
          ["2 · Pay", "The caller's agentic wallet auto-settles the x402 charge."],
          ["3 · Trade", "The live signal returns; open positions stay the author's edge."],
        ].map(([step, body]) => (
          <div key={step} className="bg-[rgba(10,12,36,0.6)] p-5">
            <p className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-pink)]">{step}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-dim)]">{body}</p>
          </div>
        ))}
      </div>
      <div className="p-6">
        <p className="text-xs text-[var(--c-faint)]">Callable by any KeeperHub agent at the marketplace endpoint:</p>
        <code className="c-mono mt-2 block overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[var(--c-pink)]">
          POST app.keeperhub.com/mcp/w/{workflowId}
        </code>
      </div>
    </section>
  );
}
