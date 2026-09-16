import Link from "next/link";
import { EmptyState, PageShell } from "@/components/ui/page";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="pt-20">
      <EmptyState
        title="Lost in space"
        body="This page drifted out of orbit — or it never existed."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className="c-btn-ghost">
              Home
            </Link>
            <Link href="/dashboard" className="c-btn-primary">
              Mission control
            </Link>
          </div>
        }
      />
    </PageShell>
  );
}
