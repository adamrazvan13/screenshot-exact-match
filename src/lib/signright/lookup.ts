// Client for the company-lookup Edge Function (public ANAF registry). Never invents data:
// any failure is reported to the employee, who can still enter the data manually.
import { z } from "zod";
import { supabaseConfig } from "./config";
import type { RegistryCheck } from "./types";

const lookupSchema = z.object({
  source: z.literal("ANAF"),
  checkedAt: z.string(),
  cui: z.string(),
  found: z.boolean(),
  name: z.string().optional(),
  registrationNumber: z.string().optional(),
  address: z.string().optional(),
  registrationStatus: z.string().optional(),
  inactive: z.boolean().optional(),
  vatRegistered: z.boolean().optional(),
});

export class LookupError extends Error {}

export const lookupAvailable = () => supabaseConfig() !== null;

export async function lookupCompany(cuiInput: string, signal?: AbortSignal): Promise<RegistryCheck> {
  const cfg = supabaseConfig();
  if (!cfg) throw new LookupError("Public registry lookup is not configured.");
  const cui = cuiInput.replace(/\D/g, "");
  if (cui.length < 2) throw new LookupError("Enter a valid CUI first (for example RO361820 or 361820).");
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/functions/v1/company-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ cui }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new LookupError("The lookup service could not be reached. You can continue without it.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new LookupError(`Lookup failed: ${msg}`);
  }
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) throw new LookupError("The lookup returned an unexpected format.");
  return parsed.data;
}
