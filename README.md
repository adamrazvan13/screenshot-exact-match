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

## PDF upload and scanned text recognition

On New Investigation, upload a synthetic registry certificate (standard PDF,
maximum 10 MB). The existing Anthropic integration reads digital text and scanned
pages. Review and correct the recognized text, then click **Extract with AI**
to populate the official company fields. Bank records and the client request
remain separate. Upload one certificate at a time; original PDFs are not stored.

Deploy the updated backend before using PDF upload:

```sh
supabase functions deploy extract-document --project-ref YOUR_PROJECT_REF
```

The backend requires `ANTHROPIC_API_KEY`; `ANTHROPIC_MODEL` may override the
existing default. Frontend requires `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (see `.env.example`). Recognition sends the PDF to
Anthropic and incurs provider usage, followed by a separate extraction request.
Encrypted or damaged PDFs must be exported as readable PDFs first. Split long
documents when the transcription limit (60,000 characters / output token limit)
is reached. Illegible text is marked for manual review. OCR can misread names,
identifiers and dates; always compare them with the original document.

Validation: `npm test`, `npx tsc --noEmit`, `npm run build`. Tests mock the provider;
a live smoke test needs a deployed Edge Function and configured provider key.
