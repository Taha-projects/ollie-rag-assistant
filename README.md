# Ollie — RAG Model Assistant

Ollie is a document research assistant built with React and FastAPI. Ask questions grounded in uploaded documents, or turn on **AI Think** for an independent answer from the configured model.

See the [complete Ollie RAG project guide](output/pdf/Ollie_RAG_Project_Complete_Guide.pdf) for the system architecture, document processing, chunking and embeddings, retrieval, token controls, model/API configuration, security, limitations, use cases, time-saving estimate, and Netlify deployment readiness.

## Features

- React chat interface with dark mode by default and a saved light/dark toggle.
- Collapsible knowledge-base panel and an account panel in the sidebar.
- **Export PDF** opens a print-friendly version of the current conversation. In the print window, select **Save as PDF** as the destination and save the file.
- Gmail-only sign-up and sign-in. At sign-up, passwords must have at least 10 characters and include uppercase and lowercase letters, a number, and a special character; those characters can appear anywhere. Sign-in checks the password against the account’s stored hash instead of reapplying the sign-up character rule.
- Passwords are stored as salted PBKDF2 hashes. The original password is not stored. Sessions use HttpOnly cookies and authentication endpoints have basic rate limits.
- First sign-in walkthrough, Terms & Conditions, and Privacy Notice.
- A server-enforced limit of 100 questions per account per UTC day.
- Up to **seven files total** for each user while the backend is running: PDFs, PNG/JPG/WEBP images, and UTF-8 TXT files.
- The upload area supports drag-and-drop or clicking to choose files. During upload, Ollie shows a loader while it extracts text, splits it into chunks, and creates embeddings. After indexing succeeds, it reports that the file is ready to search.
- Ollie extracts PDF text, uses the vision model to read images, and indexes TXT contents. PDF citations include page numbers; image and TXT citations use the filename.
- AI Think ON answers independently from general model knowledge and ignores uploaded files. Turn it OFF to return to file retrieval. It does not perform web search.
- The OpenRouter API key is read by the backend from `backend/.env` and is never sent to the browser.
- Optional Cloudflare D1 activity logging records the user's email and UTC login/logout event time only. It never logs passwords or password hashes. Explicit sign-outs are recorded; closing a browser is not a logout event.

## Supported file limits

- PDF: up to 25 MB, 300 pages, and 40 scanned pages per file.
- PNG, JPG/JPEG, or WEBP: up to 10 MB per image.
- UTF-8 TXT: up to 2 MB per file.
- Seven files total per user. Files and their search index are held in backend memory for this demo, so a backend restart clears the uploaded files and they must be uploaded again.

## Using Ollie

- Upload a file by dropping it into the knowledge-base area or clicking **Drop files here or browse**. The seven-file total applies across PDFs, images, and TXT files.
- Wait for the processing indicator to finish. Ollie confirms when extracted text has been chunked and indexed for search.
- With **AI Think** off, Ollie retrieves relevant chunks from the uploaded files. With **AI Think** on, uploaded files are ignored for that answer.
- Select **Export PDF** to open the export instructions, then choose **Continue to print**. In the browser print window select **Save as PDF** and choose a save location.

## Run locally on this computer

The project includes local Python and Node runtimes in `.tools`, and its React packages are in `node_modules`.

1. Open PowerShell in the `ragggg` project folder.
2. In the first terminal, start the backend:

   ```powershell
   & '.tools\python\python.exe' -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

3. In a second terminal, start the website:

   ```powershell
   & '.tools\node\node.exe' 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port 5174
   ```

4. Open [http://127.0.0.1:5174](http://127.0.0.1:5174). Keep both terminals open while using Ollie. Press `Ctrl+C` in each terminal to stop the servers.

If the included runtimes are unavailable, install Python 3.13 from [Python.org](https://www.python.org/downloads/windows/) and Node.js, then use a Python virtual environment and install `backend/requirements.txt`.

## OpenRouter models and privacy

The current settings use `nvidia/nemotron-3.5-super-vl:free` for chat, AI Think, and image reading; `nvidia/nemotron-3-embed-1b:free` for file retrieval; and the Super VL model for scanned-page extraction. These model names can be changed in `backend/.env`. The free endpoints can be rate-limited. NVIDIA’s free-endpoint notice says requests may be logged for service improvement, so **do not upload confidential or personal information** to the free endpoint.

To configure the API key, copy `backend/.env.example` to `backend/.env` and set `   OPENROUTER_API_KEY=your_key_here` there. Do not put the key in React files, commit it to Git, or share it in chat.

To enable login/logout history in Cloudflare, set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN` in `backend/.env`. Create a Cloudflare API token scoped to the Ollie account with **D1 Write** permission, and keep the token private. Ollie creates the `auth_activity` table on the first login/logout event. To view the records in Cloudflare D1 Console, run:

```sql
SELECT email, event_type, occurred_at
FROM auth_activity
ORDER BY occurred_at DESC;
```

## Token-saving controls

File contents are split into overlapping 900-character chunks and embedded during upload, rather than sending entire files on every question. Each normal chat request uses up to four relevant passages (up to 6,000 characters), up to six recent history messages (up to 1,200 characters each), and a 700-token answer cap. These are character-based limits, not exact token counts; the model provider performs its own tokenization.

## Deployment notes

This is currently a local demo using SQLite for accounts and in-memory file indexes. Cloudflare D1 is used only for optional login/logout audit events; account records remain in the local SQLite database. It is **not yet deployed**. Netlify can host the built React frontend, but the existing FastAPI backend must run on a separate Python-capable service or be adapted to a serverless platform. Before publishing, migrate account storage to a persistent hosted database, secure cookies behind HTTPS, configure production origin settings, add email verification, and add abuse prevention for public registration. Keep OpenRouter and Cloudflare credentials in the host’s secret settings; never commit `.env` files.

InfinityFree’s free hosting is designed for PHP/MySQL and cannot run this FastAPI backend. A Python-capable host is needed. Review the included Terms and Privacy text for the intended deployment; it is demo copy, not legal advice.
