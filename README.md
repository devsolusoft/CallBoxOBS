# CallBox Server - Restore package

This package restores a minimal CallBox server and front-end so you can run tests locally.

## Restore steps (Windows 11)

1. Extract the ZIP to `C:\callbox-server` (or any folder).
2. Open PowerShell in that folder:
   ```powershell
   cd C:\callbox-server
   npm install
   npm start
   ```
3. Open in browser:
   - Nurse UI (example): http://localhost:3000/index.html
   - Display (OBS): http://localhost:3000/display.html
