import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSpreadsheetForUser, useSpreadsheetForUser, setSheetTabForUser, setMappingForUser } from "@/lib/gsheets";

// Configure WHICH spreadsheet + tab bookings and leads are logged into, and
// MAP our fields to the sheet's columns.
//   POST { action: "create" }               -> make a new spreadsheet
//   POST { action: "use", url: "..." }      -> use an existing sheet (URL or id)
//   POST { action: "tab", tab: "Name" }     -> switch the tab within it
//   POST { action: "map", mapping: {...} }  -> save field -> column mapping
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "create") {
    const made = await createSpreadsheetForUser(session.userId);
    if (!made) return NextResponse.json({ error: "Could not create the sheet — reconnect Google Sheets." }, { status: 400 });
    return NextResponse.json(made);
  }
  if (action === "use") {
    const result = await useSpreadsheetForUser(session.userId, String(body?.url ?? ""));
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === "tab") {
    const result = await setSheetTabForUser(session.userId, String(body?.tab ?? "").trim());
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === "map") {
    const ok = await setMappingForUser(session.userId, (body?.mapping ?? {}) as Record<string, string>);
    if (!ok) return NextResponse.json({ error: "Pick a sheet first." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
