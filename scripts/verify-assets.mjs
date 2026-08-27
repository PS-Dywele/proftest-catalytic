#!/usr/bin/env node

const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith("--"));
const timeoutArg = args.find((arg) => arg.startsWith("--timeout="));
const timeoutMs = Number(timeoutArg?.split("=")[1] ?? "15000");
const quiet = args.includes("--quiet");
const compareIdentity = args.includes("--compare-identity");

if (!targetArg) {
  console.error(
    "Usage: node scripts/verify-assets.mjs <url> [--timeout=15000] [--compare-identity] [--quiet]",
  );
  process.exit(2);
}

function localAssetUrls(html, documentUrl) {
  const urls = new Set();
  const patterns = [
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const resolved = new URL(match[1], documentUrl);
      if (resolved.origin === documentUrl.origin) urls.add(resolved.href);
    }
  }

  return [...urls];
}

function expectedType(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith(".css")) return "text/css";
  if (pathname.endsWith(".js") || pathname.endsWith(".mjs")) return "javascript";
  return "";
}

async function fetchMeasured(url, acceptEncoding) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: acceptEncoding ? { "accept-encoding": acceptEncoding } : {},
    });
    const body = await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Math.round(performance.now() - started),
      finalUrl: response.url,
      bytes: body.byteLength,
      type: response.headers.get("content-type") ?? "",
      length: response.headers.get("content-length") ?? "",
      encoding: response.headers.get("content-encoding") ?? "identity",
      cache: response.headers.get("cache-control") ?? "",
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Math.round(performance.now() - started),
      finalUrl: url,
      bytes: 0,
      type: "",
      length: "",
      encoding: acceptEncoding ?? "default",
      cache: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function printResult(label, url, result) {
  if (quiet && result.ok) return;
  const details = [
    `${result.status || "TIMEOUT"}`,
    `${result.elapsedMs}ms`,
    `${result.bytes} bytes`,
    result.type || "no-content-type",
    `encoding=${result.encoding}`,
    result.length ? `length=${result.length}` : "no-content-length",
    result.cache ? `cache=${JSON.stringify(result.cache)}` : "no-cache-header",
  ];
  console.log(`${label} ${url}\n  ${details.join(" | ")}`);
  if (result.finalUrl !== url) console.log(`  redirected=${result.finalUrl}`);
  if (result.error) console.log(`  error=${result.error}`);
}

const documentUrl = new URL(targetArg);
const documentResult = await fetchMeasured(documentUrl.href, "identity");
printResult("HTML", documentUrl.href, documentResult);

if (!documentResult.ok || !documentResult.body) {
  console.error("Asset verification failed: the document could not be loaded.");
  process.exit(1);
}

const documentType = documentResult.type.toLowerCase();
if (!documentType.includes("text/html")) {
  console.error(`Asset verification failed: expected HTML, received ${documentResult.type || "no type"}.`);
  process.exit(1);
}

const html = new TextDecoder().decode(documentResult.body);
const assets = localAssetUrls(html, documentUrl);
if (assets.length === 0) {
  console.error("Asset verification failed: the HTML references no local scripts or stylesheets.");
  process.exit(1);
}

let failures = 0;
for (const assetUrl of assets) {
  const normal = await fetchMeasured(assetUrl);
  printResult("ASSET", assetUrl, normal);
  const typeNeedle = expectedType(assetUrl);
  if (!normal.ok || normal.bytes === 0 || (typeNeedle && !normal.type.toLowerCase().includes(typeNeedle))) {
    failures += 1;
  }

  if (compareIdentity) {
    const identity = await fetchMeasured(assetUrl, "identity");
    printResult("IDENTITY", assetUrl, identity);
    if (!identity.ok || identity.bytes === 0) failures += 1;
  }
}

if (failures > 0) {
  console.error(`Asset verification failed with ${failures} invalid response(s).`);
  process.exit(1);
}

if (!quiet) console.log(`Verified ${assets.length} referenced asset(s) successfully.`);