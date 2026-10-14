# بُعد · Events Website

React/TypeScript implementation of the BU’D Figma design system. This first slice is a local, interactive **Question & Condition** screen preview, with Arabic/English, RTL/LTR, Light/Dark and reduced-motion support.

## Run

Node.js 24:

```sh
npm ci
npm run dev
```

```sh
npm run build
npx playwright install chromium
npm test
```

Preview settings appear below the event screen. For a clean visual comparison use `/?canvas=1&lang=ar&theme=light`.

Vercel can build this as Vite (`npm run build`, output `dist`). No environment variables are needed for this preview. No live event, account, payment or email service is connected yet.

See [implementation scope](docs/implementation.md) and [asset notices](THIRD_PARTY_NOTICES.md). Implementation changes are reviewed in a feature branch before release.
