// Supabase Edge Function (Deno): looks up a company by CUI in the PUBLIC ANAF web service
// (no API key needed) and returns a small, normalized result. It runs server-side because the
// ANAF service is not meant to be called directly from browsers (CORS).
// Source: https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva  (max 1 request/second)
// Note: ANAF does NOT provide administrators or shareholders; only company identity and status.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Any = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const cui = String(body?.cui ?? "").replace(/\D/g, "");
  if (cui.length < 2 || cui.length > 10) return json({ error: "Invalid CUI (expected 2-10 digits)" }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch("https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ cui: Number(cui), data: today }]),
      signal: controller.signal,
    });
  } catch {
    return json({ error: "The ANAF service did not respond in time" }, 504);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return json({ error: `ANAF service error (${res.status})` }, 502);

  let data: Any;
  try {
    data = await res.json();
  } catch {
    return json({ error: "The ANAF service returned an unreadable response" }, 502);
  }

  const hit: Any = Array.isArray(data?.found) ? data.found[0] : undefined;
  const checkedAt = new Date().toISOString();
  if (!hit) return json({ source: "ANAF", checkedAt, cui, found: false });

  const g: Any = hit.date_generale ?? {};
  const seat: Any = hit.adresa_sediu_social ?? {};
  const address: string | undefined =
    g.adresa ||
    [seat.sdenumire_Strada, seat.snumar_Strada, seat.sdenumire_Localitate, seat.sdenumire_Judet].filter(Boolean).join(", ") ||
    undefined;
  return json({
    source: "ANAF",
    checkedAt,
    cui,
    found: true,
    name: g.denumire || undefined,
    registrationNumber: g.nrRegCom || undefined,
    address,
    registrationStatus: g.stare_inregistrare || undefined,
    inactive: typeof hit.stare_inactiv?.statusInactivi === "boolean" ? hit.stare_inactiv.statusInactivi : undefined,
    vatRegistered: typeof hit.inregistrare_scop_Tva?.scpTVA === "boolean" ? hit.inregistrare_scop_Tva.scpTVA : undefined,
  });
});
