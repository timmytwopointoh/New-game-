# Peks Plunder v0.41 public Android test release

This is a publicly distributable APK snapshot of the independently developed Pek's Old Port Cove restaurant game, not a fork or replacement of the private VEILFORGE Engine-build repository.

- Android 6.0 / API 23 and newer, device CPU architecture independent: pure Java WebView shell with embedded HTML/JS/Canvas game.
- Game source SHA256: ea2f3ab73eef7c9c0b1b0d6f8da6aacb4b6a4d74ffbe85d3715e5ed71fe6721b
- Original crab launcher icon from earlier Peks Plunder builds.
- v0.41: Pixel crew faces, Eddie goalie mask, Spooderman, Jimothy, 19 characters, walls, Chowder Room door, crab tanks, occasional dolphin.
- Android APK is rebuilt directly from the same game source as browser; a hash check fails on divergence.
- First-install test distribution: this is a DEBUG-signed APK. Different GitHub Actions build runners may produce different signing certificates. Future updates require a persistent private release signing key via Actions secrets.
- Local saves stay on the device. Back up saves before replacing any installation signed differently.
- Sideloading requires users to authorize their download app under Android's Install unknown apps settings. Google Play is not involved.

Do not publish private signing keys, automation secrets, or VEILFORGE engine internals in this public repository.
