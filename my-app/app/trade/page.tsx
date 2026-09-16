import MarketOrderPanel from "@/components/markets/market-order-panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function TradePage() {
  return (
    <PageShell width="medium">
      <PageHeader
        eyebrow="Direct trade"
        title="Place a"
        accent="trade."
        description="Search any Polymarket market, pick an outcome and preview the price. Previews are free and move no funds."
      />
      <div className="c-panel p-6 sm:p-8">
        <MarketOrderPanel />
      </div>
    </PageShell>
  );
}
