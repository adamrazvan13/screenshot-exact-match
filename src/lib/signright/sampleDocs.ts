// Synthetic registry certificates (fictional companies and people) for demos and tests.
import type { DemoKey } from "./fixtures";

const header = (name: string, cui: string, reg: string, date: string) => `CERTIFICAT CONSTATATOR (DOCUMENT FICTIV PENTRU DEMONSTRAȚIE)
Oficiul Registrului Comerțului — copie sintetică, fără valoare juridică
Data eliberării: ${date}

Denumire societate: ${name}
Cod unic de înregistrare (CUI): ${cui}
Număr de ordine în registrul comerțului: ${reg}
Formă juridică: Societate cu răspundere limitată (SRL)
`;

export const SAMPLE_DOCS: Record<DemoKey, { title: string; text: string }> = {
  A: {
    title: "Alfa Tech — certificat (administrator unic)",
    text: `${header("ALFA TECH SRL", "RO40000001", "J40/1001/2019", "2026-10-08")}
ADMINISTRATORI
1. Andrei Popescu — Cod persoană: P-1001 — administrator din data de 2019-03-12.

MODUL DE REPREZENTARE
Societatea este reprezentată de administratorul unic, care poate semna individual.
`,
  },
  B: {
    title: "Beta Consulting — certificat (doi administratori)",
    text: `${header("BETA CONSULTING SRL", "RO40000002", "J12/2002/2020", "2026-10-13")}
ADMINISTRATORI
1. Andrei Popescu — Cod persoană: P-1001 — administrator din data de 2020-05-04.
2. Maria Ionescu — Cod persoană: P-1002 — administrator din data de 2026-10-03.

MODUL DE REPREZENTARE
Fiecare administrator poate reprezenta societatea separat, în mod individual.
`,
  },
  C: {
    title: "Gamma Industries — certificat (reprezentare comună)",
    text: `${header("GAMMA INDUSTRIES SRL", "RO40000003", "J22/3003/2018", "2026-10-18")}
ADMINISTRATORI
1. Andrei Popescu — Cod persoană: P-1001 — administrator din data de 2018-09-01.
2. Maria Ionescu — Cod persoană: P-1002 — administrator din data de 2018-09-01.

MODUL DE REPREZENTARE
Societatea este reprezentată de cei doi administratori împreună; actele se semnează în mod conjugat de ambii administratori.
`,
  },
};
