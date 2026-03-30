# Cloudnote

[中文文档](README.md)

A lightweight cloud notepad based on Cloudflare Workers + KV. No server needed — deployed on Cloudflare's global edge network for fast access and zero maintenance.

![Screenshot](Screenshot.png)

## Features

- **Rich Text Editing** — Bold, italic, underline, strikethrough, font color, highlight, alignment, ordered/unordered lists
- **Fonts & Sizes** — Common Chinese and English fonts, Word-standard sizes (8–72pt), custom size input
- **Auto Save** — Saves 1 second after typing, with real-time status (saving/saved/retry on failure)
- **Note Management** — Directory browsing, search, single delete, batch delete
- **Password Protection** — Optional Bearer Token authentication
- **Bilingual UI** — Chinese/English toggle, defaults based on browser language
- **Dark Theme** — Light/dark toggle, follows system preference, persisted
- **Mobile Optimized** — Responsive layout, single-panel mode on mobile, touch-friendly
- **Zero Dependencies** — Single-file app (API + frontend), no build tools required

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [Cloudflare account](https://dash.cloudflare.com/sign-up)

### Steps

1. **Clone the project**

```bash
git clone https://github.com/EdLovecraft/cloudnote.git
cd cloudnote
npm install
```

2. **Log in to Cloudflare**

```bash
npx wrangler login
```

3. **Create a KV namespace**

```bash
npx wrangler kv namespace create NOTES
```

Paste the returned `id` into `<YOUR_KV_NAMESPACE_ID>` in `wrangler.toml`.

4. **Set a password (optional)**

```bash
npx wrangler secret put PASSWORD
```

Enter your password. If not set, no password is required.

5. **Deploy**

```bash
npm run deploy
```

After deployment, you'll get your URL, e.g. `https://cloudnote.your-subdomain.workers.dev`.

## License

MIT
