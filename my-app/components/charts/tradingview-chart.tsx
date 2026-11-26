"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView's free embeddable Advanced Chart, so a trader can study the
 * asset with their own indicators (EMA, RSI…) next to the bot that trades it.
 * The widget keeps TradingView's attribution link, which its terms require.
 *
 * Polymarket settles its crypto up/down markets on Chainlink's price, which
 * tracks major spot venues closely; Coinbase's USD pair is the closest
 * free chart.
 */

const SYMBOL: Record<string, string> = { BTC: "COINBASE:BTCUSD", ETH: "COINBASE:ETHUSD" };
const INTERVAL: Record<string, string> = { "15m": "15", "1h": "60", "4h": "240", "1d": "D" };

export default function TradingViewChart({ asset, timeframe, height = 420 }: { asset: string; timeframe: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const symbol = SYMBOL[asset] ?? SYMBOL.BTC;
  const interval = INTERVAL[timeframe] ?? "15";

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // The embed script locates its container when it runs, asynchronously.
    // Tearing the container down before then (React re-running this effect)
    // makes it throw, so it is replaced only when the chart actually changes.
    const key = `${symbol}:${interval}`;
    if (el.dataset.chart === key) return;
    el.dataset.chart = key;
    el.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    el.appendChild(widget);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(5, 7, 26, 0)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
  }, [symbol, interval]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20" style={{ height }}>
      <div ref={host} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
