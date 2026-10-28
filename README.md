# Screenshot Exact Match

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1f7e11a3-5bec-4f8e-81ed-a9cbd86ccb70).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Reading registry documents with AI (PDF, scanned or digital)

On **New Investigation**, drag & drop one or more synthetic registry PDFs (up to 5 files, 4 MB each) or paste
the certificate text, then click **Extract with AI**. The model reads digital and scanned pages natively and
fills the *official* company fields only; bank records come from the bank system lookup (table `bank_clients`)
and the customer request is entered by the employee. The AI never decides the outcome: fixed rules do.

Backend (Supabase Edge Function `extract-document`, Verify JWT off). Secrets are set in the Supabase dashboard,
never in code: `BEDROCK_MODEL_ID`, `BEDROCK_REGION` and `AWS_BEARER_TOKEN_BEDROCK` (Amazon Bedrock), or
`ANTHROPIC_API_KEY` as a fallback. Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
Database setup: run `supabase/schema.sql` and `supabase/bank_clients.sql` once in the Supabase SQL editor.

OCR can misread names, identifiers and dates: the employee always reviews the extracted data against the document.
Validation: `npm test`, `npx tsc --noEmit`, `npm run build`. Tests mock the provider; a live check needs the deployed function.
