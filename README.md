# JU-Hack

## Setup
```bash
git clone https://github.com/Chitra9xh/JU-Hack
cd JU-Hack
npm install
npm run dev
```

Open `https://localhost:5173` on your laptop. The dev server uses a self-signed certificate, so the browser will warn once; accept it.

## Open it on a phone
1. Put the phone on the same Wi-Fi as the laptop.
2. Find the laptop's IP (`hostname -I` on Linux, `ipconfig` on Windows).
3. Open `https://<laptop-ip>:5173` in Android Chrome and accept the certificate warning.
4. If it doesn't load, allow port 5173 through the laptop's firewall.
