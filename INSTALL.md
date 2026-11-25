# Install PortRace Tracker

Install Node.js 18 or newer (npm is included), then run the installer for your platform from the project folder.

## Windows

Double-click `install.bat`, or run it from Command Prompt or PowerShell:

```bat
install.bat
```

The batch file launches the installer with a PowerShell execution-policy bypass scoped to that process, so it does not change your machine's policy. You can also run the installer directly in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

## macOS and Linux

```bash
bash ./install.sh
```

The installer installs the npm dependencies, creates `./music`, and creates `.env.local` from `.env.example` if neither `.env.local` nor `.env` already exists. Add audio files to `./music`. To start the app after installation, run `npm run dev`.
