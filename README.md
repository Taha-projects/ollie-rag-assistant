# Ollie: RAG Document Assistant

Ollie is a document research assistant built with **React** and **FastAPI**. Upload PDFs, images or text files and ask questions grounded in them, with page-level citations. Or turn on **AI Think** for an independent answer from the model.

> Status: local demo. It is not deployed yet (see [Deployment notes](#deployment-notes)).

## Key features

- **Document Q&A (RAG):** upload PDFs, images or text files and get answers with source citations
- **AI Think mode:** get a general answer from the model when you don't want to use your files
- **OCR:** reads text from images and scanned PDF pages
- **Secure accounts:** salted password hashes, HttpOnly sessions and a daily question limit
- **Export:** save any conversation as a PDF


## Screenshots

![Chat interface](screenshots/chat.png)
![Upload and sources](screenshots/upload.png)
-->

## How it works

```
Browser (React UI) -> FastAPI backend -> OpenRouter (Nemotron chat / OCR / embeddings)
                          |
                          +-> SQLite (accounts, sessions, daily quota)
                          +-> In-memory chunks and vectors (search index)
```

1. Text is extracted from the upload: pypdf for PDFs, a vision model for images and scanned pages, and UTF-8 decoding for TXT.
2. The text is split into overlapping 900-character chunks and embedded with `nvidia/nemotron-3-embed-1b:free`.
3. For each question, Ollie embeds the question and ranks the stored chunks by cosine similarity.
4. The top passages (up to four) are sent to the chat model, which answers from that evidence and cites the filename and PDF page.

For architecture, chunking, retrieval, token controls, security and limitations, see the [complete Ollie RAG project guide](output/pdf/Ollie_RAG_Project_Complete_Guide.pdf).

## Features

- React chat interface with dark mode by default and a saved light/dark toggle.
- Collapsible knowledge-base panel and an account panel in the sidebar.
- **Export PDF** opens a print-friendly version of the current conversation. In the print window, select **Save as PDF** as the destination.
- Gmail-only sign-up and sign-in. At sign-up, passwords must have at least 10 characters and include uppercase and lowercase letters, a number, and a special character. Sign-in checks the password against the account's stored hash instead of reapplying the sign-up character rule.
- Passwords are stored as salted PBKDF2 hashes, and the original password is not stored. Sessions use HttpOnly cookies, and authentication endpoints have basic rate limits.
- First sign-in walkthrough, Terms & Conditions, and Privacy Notice.
- A server-enforced limit of 100 questions per account per UTC day.
- Up to **seven files total** per user while the backend is running: PDFs, PNG/JPG/WEBP images, and UTF-8 TXT files.
- Drag-and-drop or click-to-choose uploads. During upload, Ollie shows a loader while it extracts text, splits it into chunks, and creates embeddings, then reports when the file is ready to search.
- PDF citations include page numbers. Image and TXT citations use the filename.
- **AI Think ON** answers independently from general model knowledge and ignores uploaded files. Turn it **OFF** to return to file retrieval. AI Think does not perform web search.
- The OpenRouter API key is read by the backend from `backend/.env` and is never sent to the browser.
- Optional Cloudflare D1 activity logging records the user's email and UTC login/logout event time only. It never logs passwords or password hashes.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript/JSX, CSS, Lucide React |
| Backend | Python 3.13, FastAPI, Uvicorn, HTTPX |
| Documents | pypdf, python-multipart, python-dotenv |
| Models (via OpenRouter) | NVIDIA Nemotron 3.5 Super VL (chat, AI Think, OCR); Nemotron 3 Embed 1B (embeddings) |
| Storage | SQLite (accounts, sessions, usage); in-memory index; optional Cloudflare D1 (audit log) |

No model is trained or fine-tuned. Ollie uses pretrained hosted models, with prompts and retrieval controlling their behavior.

## Supported file limits

- PDF: up to 25 MB, 300 pages, and 40 scanned pages per file.
- PNG, JPG/JPEG or WEBP: up to 10 MB per image.
- UTF-8 TXT: up to 2 MB per file.
- Seven files total per user. Files and their search index are held in backend memory for this demo, so a backend restart clears them and they must be uploaded again.

## Run locally

**Requirements:** Python 3.13 and Node.js.

1. Clone or download this repository and open a terminal in the project folder.
2. Create your environment file:
   ```
   copy backend\.env.example backend\.env
   ```
   (On macOS/Linux: `cp backend/.env.example backend/.env`.) Then open `backend/.env` and set `OPENROUTER_API_KEY`.
3. Install and start the backend:
   ```
   pip install -r backend/requirements.txt
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
4. In a second terminal, install and start the frontend:
   ```
   npm install
   npx vite --host 127.0.0.1 --port 5174
   ```
5. Open [http://127.0.0.1:5174](http://127.0.0.1:5174). Keep both terminals open while using Ollie, and press `Ctrl+C` in each to stop.

Vite proxies `/api` requests to the FastAPI backend on port 8000 during local development.

## OpenRouter models and privacy

The current settings use `nvidia/nemotron-3.5-super-vl:free` for chat, AI Think, image reading and scanned-page extraction, and `nvidia/nemotron-3-embed-1b:free` for file retrieval. These model names can be changed in `backend/.env`. The free endpoints can be rate-limited. NVIDIA's free-endpoint notice says requests may be logged for service improvement, so **do not upload confidential or personal information** to the free endpoint.

To configure the API key, copy `backend/.env.example` to `backend/.env` and set `OPENROUTER_API_KEY=your_key_here` there. Do not put the key in React files, commit it to Git, or share it in chat.

To enable login/logout history in Cloudflare, set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `backend/.env`. Create a Cloudflare API token with **D1 Write** permission and keep it private. Ollie creates the `auth_activity` table on the first login/logout event. To view the records in the Cloudflare D1 Console, run:

```sql
SELECT email, event_type, occurred_at
FROM auth_activity
ORDER BY occurred_at DESC;
```

## Token-saving controls

File contents are split into overlapping 900-character chunks and embedded during upload, rather than sending entire files on every question. Each normal chat request uses up to four relevant passages (up to 6,000 characters), up to six recent history messages (up to 1,200 characters each), and a 700-token answer cap. These are character-based limits, not exact token counts, because the model provider performs its own tokenization.

## Deployment notes

This is currently a local demo that uses SQLite for accounts and in-memory file indexes. Cloudflare D1 is used only for optional login/logout audit events. It is **not yet deployed**. Netlify can host the built React frontend, but the FastAPI backend must run on a separate Python-capable service. Before a public launch:

- Migrate account storage to a persistent hosted database.
- Use secure cookies behind HTTPS and configure production origin settings.
- Add durable storage or a re-indexing plan for uploaded files.
- Add email verification and abuse prevention for public registration.
- Keep OpenRouter and Cloudflare credentials in the host's secret settings, and never commit `.env` files.

## Limitations

- The search index is stored in memory and is cleared when the backend restarts.
- Retrieval scans chunks linearly, which suits a small number of files and not large collections.
- OCR can miss text, retrieval can miss a relevant chunk, and the model can misread evidence, so check citations.
- There is no live web search.
