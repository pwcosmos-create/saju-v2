<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment Context (Important)

- Homepage production server is Oracle Cloud VM.
- SSH target: `ubuntu@168.107.31.153` (identity file typically `~/.ssh/shinserver.key`).
- App directory on server: `/home/ubuntu/saju-v2`.
- Runtime/process manager: PM2, app name `saju-v2`.
- Active runtime port is `3001` (current PM2 start command: `npm start -- -p 3001`).
- Toss Appin deployment is managed in a different project; do not use `ait` flow for homepage deploys here.
