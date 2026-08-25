import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import mammoth from "mammoth";

// Extract readable text from an uploaded knowledge file, server-side, so the
// agent can actually answer from it. Supports .docx (Word) and plain-text
// formats (.txt, .md, .csv, .json). PDFs aren't parsed yet — the UI tells the
// user to paste or convert those.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const base64 = String(body?.file ?? "");
  const fileName = String(body?.fileName ?? "").toLowerCase();
  if (!base64 || base64.length > 15_000_000) {
    return NextResponse.json({ error: "Attach a file under ~10 MB." }, { status: 400 });
  }
  const buf = Buffer.from(base64, "base64");

  try {
    if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: buf });
      const text = (result.value ?? "").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) return NextResponse.json({ error: "No readable text found in that document." }, { status: 422 });
      return NextResponse.json({ text: text.slice(0, 60000), chars: text.length });
    }
    if (/\.(txt|md|csv|json|html?)$/.test(fileName)) {
      const text = buf.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s{3,}/g, "\n").trim();
      if (!text) return NextResponse.json({ error: "The file appears to be empty." }, { status: 422 });
      return NextResponse.json({ text: text.slice(0, 60000), chars: text.length });
    }
    if (fileName.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "PDF text extraction isn't supported yet — export the PDF as Word (.docx) or paste the content as a Text resource." },
        { status: 415 }
      );
    }
    return NextResponse.json(
      { error: "Unsupported file type. Upload .docx, .txt, .md or .csv — or paste the content as a Text resource." },
      { status: 415 }
    );
  } catch (e) {
    console.error("Knowledge extract failed:", e);
    return NextResponse.json({ error: "Could not read that file — try re-saving it as .docx or paste the text." }, { status: 422 });
  }
}
