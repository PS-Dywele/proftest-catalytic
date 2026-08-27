# Resolve Cisco ZTA JavaScript requests that remain pending

## Confirmed diagnosis

- The affected JavaScript URL returns HTTP 200 quickly when requested directly from the VM/container.
- The container uses a root deployment and already aligns Vite, Nitro, and TanStack Router on `/`.
- The project has no service worker or custom asset handler intercepting these requests.
- Nitro serves generated assets with content length, MIME type, ETag, and long-lived immutable caching. The named files are content-hashed.

This places the current failure boundary in the Cisco ZTA path rather than in basic Nitro file serving. The implementation will harden the app against stale HTML and make tunnel-specific response failures measurable; it will not introduce another speculative path-prefix change.

## Implementation

1. **Make document caching deployment-safe**
   - Add `Cache-Control: no-store, max-age=0, must-revalidate` to HTML/SSR responses so Cisco or the browser cannot retain an older document that references a previous build’s chunk hashes.
   - Keep long-lived immutable caching for hashed `/assets/*` files, which is correct and efficient.
   - Add explicit `X-Content-Type-Options: nosniff` and preserve Nitro’s JavaScript MIME type, content length, ETag, and conditional-request behavior.

2. **Add a real container health probe**
   - Replace the current root-only health check with a small production-safe probe that fetches the rendered HTML, extracts every local script and stylesheet URL, and verifies each returns successfully with a non-empty response and the expected content type.
   - Check both the configured root/base path and its referenced assets, so an image cannot report healthy while its frontend chunks are missing.
   - Copy only this probe and the self-contained Nitro output into the final non-root Node 22 image.

3. **Add repeatable ZTA diagnostics**
   - Add a script/README procedure that runs the same checks against both `http://127.0.0.1:3000` and the actual Cisco-published HTTPS URL.
   - Report status, elapsed time, redirect target, content type, content length, content encoding, cache headers, and request timeout per asset without printing credentials.
   - Include an identity-encoding comparison so Cisco content inspection or compression handling can be isolated if only encoded responses stall.

4. **Document the Cisco-side remedy selected by the evidence**
   - Keep the application published at `/` unless the browser’s Cisco URL literally contains a prefix.
   - If localhost passes and Cisco stalls, configure the ZTA private resource to forward `/assets/*` unchanged and bypass response caching/content rewriting for HTML and JavaScript; confirm the connector can reach the VM origin on port 3000.
   - If identity encoding works but normal requests stall, disable compression/content transformation for this private application in Cisco rather than changing bundle paths.
   - Use a new image tag per release and stop/remove/run the replacement container as the user already does, avoiding mixed asset generations.

5. **Production verification**
   - Build the Node-server image from a clean context.
   - Start the container, wait for the enhanced health check to become healthy, and verify every asset referenced by live HTML over localhost.
   - Compare the same probe through the Cisco URL. A localhost pass plus Cisco timeout will be documented as a ZTA policy/connector issue with the exact failing response stage; both passing confirms deployment readiness.

## Files expected to change

- `src/server.ts` — HTML cache and security response headers.
- `Dockerfile` — asset-aware health check and probe inclusion.
- `scripts/verify-assets.mjs` — reusable HTML-to-asset verification with timeouts and diagnostics.
- `package.json` — command for the verification script.
- `README.md` — exact root deployment, clean rollout, local-vs-ZTA test commands, and Cisco configuration checklist.
