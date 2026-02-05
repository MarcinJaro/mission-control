import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AGENT_PATHS: Record<string, string> = {
  marketing: "/Users/marcin/.openclaw/agents/marketing/workspace/deliverables",
  bestia: "/Users/marcin/.openclaw/agents/bestia/workspace/deliverables",
  ksiegowy: "/Users/marcin/.openclaw/agents/ksiegowy/workspace/deliverables",
  assistant: "/Users/marcin/.openclaw/agents/assistant/workspace/deliverables",
  investor: "/Users/marcin/.openclaw/agents/investor/workspace/deliverables",
  main: "/Users/marcin/.openclaw/workspace-main/deliverables",
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".css": "text/css",
  ".js": "application/javascript",
  ".pdf": "application/pdf",
  ".csv": "text/csv",
  ".xml": "application/xml",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string; file: string[] }> }
) {
  const { agent, file } = await params;
  const fileName = file.join("/");
  
  const basePath = AGENT_PATHS[agent];
  if (!basePath) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  const filePath = path.join(basePath, fileName);

  // Security: prevent directory traversal
  if (!filePath.startsWith(basePath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    return NextResponse.json({ error: "Is a directory" }, { status: 400 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Check if download is requested
  const download = request.nextUrl.searchParams.get("download") === "true";

  const fileBuffer = fs.readFileSync(filePath);

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": stats.size.toString(),
  };

  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
  } else if (ext === ".md" || ext === ".txt") {
    // Inline for text files
    headers["Content-Disposition"] = "inline";
  }

  return new NextResponse(fileBuffer, { headers });
}
