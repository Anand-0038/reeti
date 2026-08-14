import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ReetiError } from "@/lib/errors";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ReetiError("Enter a valid public HTTP(S) URL.", "INVALID_SOURCE_URL", 422);
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ReetiError(
      "Only credential-free HTTP(S) URLs are supported.",
      "UNSAFE_SOURCE_URL",
      422,
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  ) {
    throw new ReetiError("Private and metadata hosts are not allowed.", "UNSAFE_SOURCE_HOST", 422);
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    throw new ReetiError("Private and loopback hosts are not allowed.", "UNSAFE_SOURCE_HOST", 422);
  }
  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    throw new ReetiError("Private and loopback hosts are not allowed.", "UNSAFE_SOURCE_HOST", 422);
  }

  if (ipVersion === 0) {
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new ReetiError("The source host could not be resolved.", "SOURCE_DNS_FAILED", 422);
    }
    if (addresses.some(({ address }) => isPrivateIpv4(address) || isPrivateIpv6(address))) {
      throw new ReetiError(
        "The source host resolves to a private network.",
        "UNSAFE_SOURCE_HOST",
        422,
      );
    }
  }

  return url;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<template[\s\S]*?<\/template>/gi, " ")
      .replace(/<br\s*\/?>(?=.)/gi, "\n")
      .replace(/<\/(p|div|article|section|h[1-6]|li|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function titleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 180) : "Imported source";
}

function contentTypeAllows(value: string): boolean {
  return (
    value.includes("text/html") ||
    value.includes("text/plain") ||
    value.includes("application/xhtml+xml")
  );
}

async function readResponseBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) {
    throw new ReetiError("The source is larger than 2 MiB.", "SOURCE_TOO_LARGE", 413);
  }
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new ReetiError("The source is larger than 2 MiB.", "SOURCE_TOO_LARGE", 413);
    }
    chunks.push(result.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function importPublicUrl(rawUrl: string): Promise<{
  title: string;
  body: string;
  sourceUrl: string;
  canonicalUrl: string;
  wordCount: number;
}> {
  let current = await assertSafeUrl(rawUrl);
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Reeti/0.1 source importer" },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ReetiError("The source took too long to respond.", "SOURCE_TIMEOUT", 504);
      }
      throw new ReetiError("The source could not be read.", "SOURCE_FETCH_FAILED", 502);
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new ReetiError(
          "The source redirect had no destination.",
          "SOURCE_REDIRECT_INVALID",
          502,
        );
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new ReetiError(
        `The source returned HTTP ${response.status}.`,
        "SOURCE_HTTP_ERROR",
        502,
        { status: response.status },
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentTypeAllows(contentType)) {
      throw new ReetiError(
        "The URL did not return readable text or HTML.",
        "SOURCE_CONTENT_TYPE_UNSUPPORTED",
        415,
      );
    }
    const rawBody = await readResponseBody(response);
    const body = contentType.includes("text/plain") ? rawBody.trim() : htmlToText(rawBody);
    if (body.length < 40)
      throw new ReetiError("The page contained too little readable text.", "SOURCE_EMPTY", 422);
    return {
      title: contentType.includes("text/plain") ? "Imported text source" : titleFromHtml(rawBody),
      body,
      sourceUrl: rawUrl,
      canonicalUrl: current.toString(),
      wordCount: body.split(/\s+/).filter(Boolean).length,
    };
  }
  throw new ReetiError("The source redirected too many times.", "SOURCE_REDIRECT_LIMIT", 502);
}

export function validatePastedSource(input: { title?: string; body: string }): {
  title: string;
  body: string;
  wordCount: number;
} {
  const body = input.body.trim();
  if (body.length < 40) {
    throw new ReetiError(
      "Paste at least 40 characters so the campaign has enough source context.",
      "SOURCE_TOO_SHORT",
      422,
    );
  }
  if (body.length > MAX_SOURCE_BYTES) {
    throw new ReetiError("The pasted source is larger than 2 MiB.", "SOURCE_TOO_LARGE", 413);
  }
  return {
    title: input.title?.trim().slice(0, 180) || "Pasted source",
    body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  };
}
