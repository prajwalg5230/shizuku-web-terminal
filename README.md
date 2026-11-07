# ⚡ Shizuku ADB Web Terminal

Modern, cyberpunk rootless elevated ADB Shell Web Dashboard for Android devices powered by Shizuku Binder IPC.

## 🚀 Features
- **Rootless ADB Shell:** Execute elevated commands (`uid=2000 shell`) directly from your browser.
- **Auto Status Polling:** Real-time authorization detection without page reloads.
- **Quick Action Chips:** Pre-built 1-click ADB commands (`pm`, `dumpsys`, `getprop`, `wm`, `top`, `ip`, `df`).
- **Interactive Terminal:** Command history navigation (Arrow Up/Down), Copy Output, and Clear screen.

## ⚡ Quick Start
1. Ensure Shizuku is running on your Android device.
2. In Shizuku App > **Authorized Applications** > Toggle **Termux** to **ON**.
3. Run the bridge:
   ```bash
   node server.js
   ```
4. Open `http://localhost:8080` in your browser.
