import type { InvestigationInput } from "./types";

function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from.getTime() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export type DemoKey = "A" | "B" | "C";

export function demoCase(key: DemoKey): InvestigationInput {
  if (key === "A")
    return {
      company: { name: "ALFA TECH SRL", cui: "RO40000001", registrationNumber: "J40/1001/2019", documentDate: daysAgo(20) },
      representationMode: "individual",
      administrators: [{ personId: "P-1001", name: "Andrei Popescu", appointedOn: "2019-03-12" }],
      bankRepresentatives: [{ personId: "P-1001", name: "Andrei Popescu" }],
      accountOperators: [{ personId: "P-1001", name: "Andrei Popescu", scope: "Full operating rights" }],
      mandate: { reference: "MND-A-2019-01", description: "Sole administrator mandate", date: daysAgo(30) },
      request: {
        operation: "update_company_info",
        submittedBy: ["P-1001"],
        details: "Update registered office address.",
        evidence: ["registry_extract"],
      },
    };
  if (key === "B")
    return {
      company: { name: "BETA CONSULTING SRL", cui: "RO40000002", registrationNumber: "J12/2002/2020", documentDate: daysAgo(15) },
      representationMode: "individual",
      administrators: [
        { personId: "P-1001", name: "Andrei Popescu", appointedOn: "2020-05-04" },
        { personId: "P-1002", name: "Maria Ionescu", appointedOn: daysAgo(25) },
      ],
      bankRepresentatives: [{ personId: "P-1001", name: "Andrei Popescu" }],
      accountOperators: [{ personId: "P-1001", name: "Andrei Popescu", scope: "Full operating rights" }],
      mandate: { reference: "MND-B-2020-03", description: "Representation mandate for Andrei Popescu", date: daysAgo(40) },
      request: {
        operation: "update_representatives",
        submittedBy: ["P-1001"],
        details: "Register newly appointed administrator Maria Ionescu.",
        evidence: ["registry_extract", "appointment_decision", "id_documents"],
      },
    };
  return {
    company: { name: "GAMMA INDUSTRIES SRL", cui: "RO40000003", registrationNumber: "J22/3003/2018", documentDate: daysAgo(10) },
    representationMode: "joint",
    administrators: [
      { personId: "P-1001", name: "Andrei Popescu", appointedOn: "2018-09-01", requiredForJoint: true },
      { personId: "P-1002", name: "Maria Ionescu", appointedOn: "2018-09-01", requiredForJoint: true },
    ],
    bankRepresentatives: [
      { personId: "P-1001", name: "Andrei Popescu" },
      { personId: "P-1002", name: "Maria Ionescu" },
    ],
    accountOperators: [{ personId: "P-2001", name: "Elena Dumitru", scope: "Payments up to 50,000 RON" }],
    mandate: { reference: "MND-C-2018-07", description: "Joint signature mandate", date: daysAgo(60) },
    request: {
      operation: "change_authorization",
      submittedBy: ["P-1001"],
      details: "Raise Elena Dumitru's payment limit to 200,000 RON.",
      evidence: ["signed_mandate"],
    },
  };
}

/** Extra synthetic records so the dashboard has variety. */
export function extraCases(): InvestigationInput[] {
  return [
    {
      company: { name: "DELTA LOGISTICS SRL", cui: "RO40000004", registrationNumber: "J08/4004/2017", documentDate: daysAgo(140) },
      representationMode: "individual",
      administrators: [
        { personId: "P-1003", name: "Ioan Georgescu", appointedOn: "2017-01-10", terminatedOn: daysAgo(100) },
        { personId: "P-1004", name: "Ana Stan", appointedOn: daysAgo(100) },
      ],
      bankRepresentatives: [{ personId: "P-1003", name: "Ioan Georgescu" }],
      accountOperators: [{ personId: "P-1003", name: "Ioan Georgescu", scope: "Full operating rights" }],
      mandate: { reference: "MND-D-2017-02", description: "Mandate for Ioan Georgescu", date: "2017-02-01" },
      request: { operation: "add_operator", submittedBy: ["P-1004"], details: "Add Radu Matei as operator.", targetPersonId: "P-2002", targetPersonName: "Radu Matei", evidence: ["id_documents"] },
    },
    {
      company: { name: "EPSILON FOODS SRL", cui: "RO40000005", registrationNumber: "J35/5005/2021", documentDate: daysAgo(5) },
      representationMode: "individual",
      administrators: [{ personId: "P-1005", name: "Cristina Marin", appointedOn: "2021-06-01" }],
      bankRepresentatives: [{ personId: "P-1005", name: "Cristina Marin" }],
      accountOperators: [{ personId: "P-1005", name: "Cristina Marin", scope: "Full operating rights" }],
      mandate: { reference: "MND-E-2021-01", description: "Sole administrator mandate", date: daysAgo(12) },
      request: { operation: "add_operator", submittedBy: ["P-1005"], details: "Add accountant Victor Pop as operator.", targetPersonId: "P-2003", targetPersonName: "Victor Pop", evidence: ["signed_mandate", "id_documents"] },
    },
  ];
}
