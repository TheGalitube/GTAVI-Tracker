# Install PortRace Tracker

Run the installer for your platform from the project folder. On Windows, it installs Node.js LTS with `winget` if Node.js is missing. On macOS and Linux, install Node.js 18 or newer (npm is included) first.

## Windows

Double-click `install.bat`, or run it from Command Prompt or PowerShell:

```bat
install.bat
```

The batch file launches PowerShell with an execution-policy bypass scoped to that process, so it does not change your machine's policy. If Node.js is missing, the installer uses `winget` to install Node.js LTS. If `winget` is unavailable, install Node.js from [nodejs.org](https://nodejs.org/), reopen your terminal, and run `install.bat` again. You can also run the installer directly in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

## macOS and Linux

```bash
bash ./install.sh
```

The installer installs the npm dependencies, creates `./music`, and creates `.env.local` from `.env.example` if neither `.env.local` nor `.env` already exists. Add audio files to `./music`. To start the app after installation, run `npm run dev`.
