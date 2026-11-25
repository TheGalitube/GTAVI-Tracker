# GTA VI PC Port Race Tracker

## Run locally

Install Node.js, then run these commands from the project folder:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## GitHub API rate limit

The dashboard reads public GitHub pull request data. Without authentication, GitHub limits API requests by your public IP. If the dashboard shows a GitHub API `403` rate limit error, add a local token:

1. Create a GitHub personal access token for public, read-only data. A classic token with no scopes is sufficient for public repositories.
2. In PowerShell, copy `.env.example` to `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

3. Set `GITHUB_TOKEN` to the token in `.env.local`:

   ```text
   GITHUB_TOKEN=github_pat_your_token_here
   ```

4. Save the file and restart `npm run dev`.

`.env.local` is ignored by Git. Keep the token there, never commit it, and never post it in chat. The token is only used by the local server for GitHub API requests; it is not sent to the browser.
