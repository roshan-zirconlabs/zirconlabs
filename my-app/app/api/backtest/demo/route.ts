import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const csvPath = path.resolve(process.cwd(), "public", "sample-strategy.csv");
    const content = await fs.readFile(csvPath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="Strategy.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load demo CSV" }, { status: 500 });
  }
}
