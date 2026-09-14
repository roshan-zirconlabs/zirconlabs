import { NextResponse } from "next/server";
import { getHostedSchemas, KeeperhubCatalogError } from "@/lib/workflow-validation";

function requestIdFrom(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,80}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    return NextResponse.json(await getHostedSchemas(), {
      headers: {
        "Cache-Control": "public, max-age=300",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    const catalogError = error instanceof KeeperhubCatalogError ? error : null;
    return NextResponse.json({
      error: catalogError?.message ?? "KeeperHub action catalog is unavailable. Retry shortly.",
      code: catalogError?.code ?? "KEEPERHUB_CATALOG_UNAVAILABLE",
      retryable: catalogError?.retryable ?? true,
      requestId,
    }, {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    });
  }
}
