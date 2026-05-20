import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/**
 * BIMI logo endpoint.
 *
 *   Served at:  https://<your-domain>/bimi.svg
 *
 * Reference this URL from a DMARC-protected sending domain in the BIMI DNS
 * TXT record, e.g.:
 *
 *   default._bimi.inturview.com  IN TXT
 *     "v=BIMI1; l=https://inturview.com/bimi.svg;"
 *
 * Hard requirements (Gmail, Yahoo, Apple, Fastmail all enforce these):
 *
 *   1. The asset MUST be SVG Tiny 1.2 PS (no scripts, no animations, no
 *      external refs, square viewBox, <title> required). The placeholder at
 *      public/bimi-logo.svg already conforms — replace its contents with your
 *      brand mark but keep the structure.
 *
 *   2. Your sending domain MUST publish a DMARC record with policy
 *      `p=quarantine` or `p=reject`. Without enforcement, mail providers
 *      ignore the BIMI record entirely.
 *
 *   3. Gmail additionally requires a Verified Mark Certificate (VMC) from a
 *      trusted authority (Entrust, DigiCert). Without it, the logo will show
 *      in Yahoo/Apple/Fastmail but NOT in Gmail. Add the VMC URL to the DNS
 *      record once obtained:
 *        "v=BIMI1; l=https://inturview.com/bimi.svg; a=https://inturview.com/bimi-vmc.pem;"
 *
 *   4. The endpoint must be reachable over HTTPS, return 200, set
 *      Content-Type: image/svg+xml, and NOT redirect.
 *
 * Validators:
 *   - SVG syntax + Tiny PS conformance: https://bimigroup.org/svg-validator/
 *   - End-to-end BIMI record check:    https://bimigroup.org/bimi-generator/
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "bimi-logo.svg");
    const svg = await readFile(filePath, "utf8");

    return new Response(svg, {
      status: 200,
      headers: {
        // Mandatory: mail providers check this header verbatim.
        "Content-Type": "image/svg+xml",

        // Mail providers' fetchers don't honor short caches well; longer is
        // better. 7 days lets you push corrections without immortalizing a
        // mistake. immutable=false intentionally — we may swap the asset.
        "Cache-Control": "public, max-age=604800, s-maxage=604800",

        // Some BIMI checkers come from cross-origin contexts. Permissive CORS
        // here is harmless — the file is publicly readable by design.
        "Access-Control-Allow-Origin": "*",

        // Explicitly DON'T allow framing — defensive hardening.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return new Response(
      `BIMI logo not configured. Drop an SVG Tiny PS file at public/bimi-logo.svg.\n${
        err instanceof Error ? err.message : String(err)
      }`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }
    );
  }
}
