# Install PortRace Tracker

Install Node.js 18 or newer (npm is included), then run the installer for your platform from the project folder.

## Windows PowerShell

```powershell
.\install.ps1
```

If PowerShell blocks local scripts, run it for this command only:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

## macOS and Linux

```bash
bash ./install.sh
```

The installer installs the npm dependencies, creates `./music`, and creates `.env.local` from `.env.example` if neither `.env.local` nor `.env` already exists. Add audio files to `./music`. To start the app after installation, run `npm run dev`.
