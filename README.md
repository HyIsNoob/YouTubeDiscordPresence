# YouTubeDiscordPresence — Enhanced README

This fork enhances the original YouTubeDiscordPresence extension and native host with better activity data, thumbnails, localized button labels, and small quality-of-life improvements.

## Overview
- Browser extension sends rich presence for YouTube and YouTube Music.
- Native desktop host (YTDPwin) bridges the extension to Discord’s Rich Presence API.
- This enhanced version focuses on:
  - Clear activity type (Watching vs Listening)
  - Smarter thumbnail selection
  - Author-first small text (Spotify-like)
  - Localized button labels (English/Vietnamese)
  - Robust native host reconnect

## What’s New (Enhancements)
- Activity type: `type=3` for YouTube (Watching), `type=2` for YouTube Music (Listening).
- Thumbnails:
  - YouTube: use the video thumbnail when available; livestream falls back to a live icon.
  - YouTube Music: prefer square album art from `lh3.googleusercontent.com` when `useAlbumThumbnail` is enabled; otherwise fall back to track thumbnail; icon fallback only when no thumbnail exists.
- Small text: shows the author (up to 64 chars). For livestreams, adds `[LIVE]` prefix.
- Localized buttons:
  - English: “Listen Along”, “Watch Livestream”, “Watch Video”, “View Channel”.
  - Vietnamese (auto-selected when `navigator.language` starts with `vi`): “Nghe cùng”, “Xem livestream”, “Xem video”, “Xem kênh”.
- Button behavior: Discord shows up to two buttons; they appear when you hover or interact with the activity card.
- Native host reconnect: exponential backoff on disconnect; resets on successful reconnect.
- Stable update cadence: 1s worker interval + 800ms send guard to avoid spamming.

## Install the Extension (Unpacked)
1. Open Chrome → `chrome://extensions/`.
2. Enable Developer mode.
3. Click “Load unpacked” and select the `Extension/` folder.
4. Note the extension ID (shown under the loaded extension).

## Configure Native Host Manifest (Whitelist Your Extension ID)
The native host must allow your extension ID. Edit `Host/main.json` and add your unpacked extension ID to `allowed_origins`.

Example `Host/main.json`:
```json
{
  "name": "com.ytdp.discord.presence",
  "description": "Component of the YouTubeDiscordPresence extension that allows the usage of native messaging.",
  "path": "YTDPwin.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hnmeidgkfcbpjjjpmjmpehjdljlaeaaa/",
    "chrome-extension://<YOUR-UNPACKED-ID>/"
  ]
}
```

Copy the manifest to the installed location (run PowerShell as Administrator):
```powershell
# Backup current manifest
Copy-Item "C:\Program Files\YouTubeDiscordPresence\main.json" "C:\Program Files\YouTubeDiscordPresence\main.json.bak"

# Overwrite with the edited manifest from the repo
Copy-Item "d:\assign-uit\YouTubeDiscordPresence\Host\main.json" "C:\Program Files\YouTubeDiscordPresence\main.json"
```
Restart Chrome and reopen YouTube/YouTube Music.

## Build the Desktop App and MSI
Prerequisites:
- Visual Studio 2022 (or 2019) with “Desktop development with C++”.
- Extension “Visual Studio Installer Projects” (for `.vdproj`).

Steps (GUI):
1. Open `YTDPwin/YTDPwin.sln` in Visual Studio.
2. Set configuration to `Release | x64`.
3. Build project `YTDPwin`.
4. Open `YTDPsetup/YTDPsetup.vdproj` and ensure it includes `Primary Output from YTDPwin (Release)`. Adjust Product Version if needed.
5. Build `YTDPsetup` to produce the `.msi` (typically under the setup project’s `Release` output folder).

Optional from command line (requires `devenv.com`):
```powershell
$devenv = "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\devenv.com"
& $devenv "d:\assign-uit\YouTubeDiscordPresence\YTDPwin\YTDPwin.sln" /build "Release|x64" /project "YTDPsetup\YTDPsetup.vdproj"
```

## Change the Discord App Name (Mini Status)
The short “app name” text shown next to your avatar is the Discord Application’s name. To customize it:
1. Create a new app at https://discord.com/developers/applications with your desired name (e.g., “YouTube Presence Enhance”).
2. Copy its Client ID (Application ID).
3. Update `Host/main.cpp`:
   ```cpp
   // Replace the old ID
   const int64_t APPLICATION_ID = <YOUR-CLIENT-ID>;
   ```
4. Rebuild the desktop app and MSI, reinstall.

Note: Discord does not allow dynamic mini status text via Rich Presence. Title/author/channel appear inside the activity card only.

## Troubleshooting
- No buttons visible: buttons only appear when hovering the activity card in Discord.
- “Native host disconnected”: ensure the MSI is installed correctly; the manifest path is valid; try reinstalling the MSI.
- Extension sends data but Discord times out: restart Discord; ensure the desktop host can reach Discord; the send cadence is limited to avoid timeouts.
- YouTube Music album art missing: album art is used when the thumbnail URL is from `lh3.googleusercontent.com` and `useAlbumThumbnail` is enabled; otherwise we fall back to track thumbnail.

## Limitations
- Discord Rich Presence supports only two buttons and does not expose a custom timeline bar UI.
- Square thumbnails (1:1) require cropping via a proxy or host-side image processing; not part of this enhanced extension.

## Quick Test
- YouTube Music: should show Listening, author small text, localized buttons, and album art or track thumbnail.
- YouTube: should show Watching, author small text, video thumbnail, and buttons for “Watch Video” and “View Channel”.

---
This enhanced README summarizes how to set up, build, and use the improved presence features while staying within Discord’s Rich Presence constraints.
