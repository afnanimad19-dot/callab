// Fetch and extract readable text from a website URL so knowledge bases of
// type "url" / "gdoc" contain the actual page content the agent can use.

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

// Google Doc share links can be read as plain text via the export endpoint.
function normalizeGdocUrl(url: string): string {
  const m = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
  return m ? `https://docs.google.com/document/d/${m[1]}/export?format=txt` : url;
}

async function fetchPage(url: string): Promise<{ text: string; html: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VoiceLineAI-KB/1.0; +knowledge-indexer)",
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    if (type.includes("text/plain")) return { text: raw.trim(), html: "" };
    return { text: htmlToText(raw), html: raw };
  } catch {
    return null;
  }
}

// Fetch a URL's readable text. With crawl=true, also follows up to 5
// same-origin links from the page (menus, about, services pages, ...).
export async function fetchWebsiteText(
  url: string,
  options: { crawl?: boolean; gdoc?: boolean } = {}
): Promise<{ content: string; pages: number } | null> {
  const target = options.gdoc ? normalizeGdocUrl(url) : url;
  const main = await fetchPage(target);
  if (!main) return null;

  const sections: string[] = [`# ${url}\n${main.text}`.slice(0, 24000)];
  let pages = 1;

  if (options.crawl && main.html) {
    const origin = (() => { try { return new URL(url).origin; } catch { return null; } })();
    if (origin) {
      const links = new Set<string>();
      for (const m of main.html.matchAll(/href=["']([^"'#?]+)[^"']*["']/gi)) {
        try {
          const u = new URL(m[1], url);
          if (u.origin === origin && u.href !== url && !/\.(png|jpe?g|gif|svg|css|js|ico|pdf|zip|webp|mp4)$/i.test(u.pathname)) {
            links.add(u.href);
          }
        } catch { /* skip bad hrefs */ }
        if (links.size >= 5) break;
      }
      for (const link of links) {
        const page = await fetchPage(link);
        if (page?.text) {
          sections.push(`# ${link}\n${page.text}`.slice(0, 10000));
          pages++;
        }
      }
    }
  }

  const content = sections.join("\n\n---\n\n").slice(0, 60000);
  return content.trim() ? { content, pages } : null;
}
