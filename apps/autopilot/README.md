# Autopilot on Vercel Sandbox

Autopilot runs its Next.js control plane on Vercel and creates one named,
persistent Vercel Sandbox for each active automation run. Chromium, Puppeteer,
Vercel's `agent-browser`, the WebSocket server, and the MJPEG preview all run
inside that Sandbox.

## Why Workflow and Sandbox are separate

- Vercel Workflow durably owns provisioning, the completion hook, the 24-hour
  deadline, retries, and cleanup.
- Vercel Sandbox owns the continuous Bun/Chromium process and published port.
- Turso stores the run ID, deterministic Sandbox name, Workflow run ID, state,
  and worker URL.
- The browser receives a signed run token, never Sandbox or Vercel credentials.

Reloading the page does not start a second run. `GET /api/autopilot/run` looks
up the current run by user, issues a fresh signed token, and reconnects the UI
to the same named Sandbox. The worker deliberately keeps its Puppeteer task
alive when a WebSocket disconnects. When the replacement connection opens, it
sends the current running/stopped state, its accumulated status list, and any
pending agent question. The question promise lives in the worker, so a reload
does not discard it or make the agent continue without an answer.

If the Sandbox itself reaches its platform timeout or crashes, its filesystem
can be restored, but a live Chromium process cannot. That case becomes a new
Autopilot run rather than pretending the browser session was recoverable.

## One-time deployment setup

1. Use a Vercel Pro or Enterprise project if runs need longer than Hobby's
   Sandbox duration limit.
2. Set these project environment variables:
   - `AUTOPILOT_WORKER_SECRET` (at least 32 random characters)
   - `AI_GATEWAY_API_KEY` (a long-lived AI Gateway key for the Sandbox)
   - `AI_GATEWAY_MODEL` (defaults to `openai/gpt-5.6-terra`)
   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
   - `AUTH_SECRET`
   - `BETTER_AUTH_URL`
   - the existing OAuth variables
3. Optionally set `AUTOPILOT_SANDBOX_REPO_URL`,
   `AUTOPILOT_SANDBOX_REPO_REF`, and `AUTOPILOT_SANDBOX_VCPUS`.
4. If the Git repository is private, also set
   `AUTOPILOT_SANDBOX_REPO_USERNAME=x-access-token` and a fine-grained GitHub
   token in `AUTOPILOT_SANDBOX_REPO_PASSWORD`.
5. Generate VAPID keys with `bunx web-push generate-vapid-keys`, then set
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and a contact such as
   `VAPID_SUBJECT=mailto:you@example.com`. Without these values, the desktop
   notification switch remains unavailable.
6. Apply the new run, configuration, and push-subscription schema:

   ```bash
   bun db:push
   ```

7. Deploy `apps/autopilot` to Vercel. Vercel OIDC authenticates Sandbox and
   Workflow automatically in production.

For local Sandbox provisioning, link/pull the Vercel project so an OIDC token is
available, or set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.

## Lifecycle

1. Start creates a database run and starts `manageAutopilotRun`.
2. Workflow registers its private completion hook before provisioning.
3. The first run for a deployed Git revision creates a shared base Sandbox,
   installs Bun and Chromium dependencies, and snapshots it. Each user Sandbox
   starts from that prepared snapshot and launches `@acme/autopilot-backend` on
   port 8080 without repeating the installation. A new deployment revision
   automatically creates a new base snapshot; an unchanged deployment rebuilds
   it after the seven-day snapshot expiration. The database stores the snapshot
   ID by revision so runs can reuse it even if Vercel has already removed the
   stopped base Sandbox record.
4. The client polls until the worker is ready, then opens the signed WebSocket.
5. The worker heartbeats independently of browser activity. Workflow checks it
   every five minutes and treats a stale heartbeat as a lost worker.
6. Worker completion resumes the Workflow hook.
7. Workflow deletes the disposable user Sandbox without snapshotting it,
   records the reason, and sends a Web Push notification for completion,
   failure, timeout, or worker loss. Manual cancellation deliberately does not
   notify.
8. A 24-hour durable timeout performs the same cleanup if no callback arrives.

## Activity routing

Microsoft sign-in and required video playback remain deterministic Puppeteer
automations and do not call a model. Every other activity is given to an AI SDK
tool-loop agent controlling the existing Chromium session through
`agent-browser`. It can inspect nested frames, click or type, follow links, and
open/switch/close research tabs. Settings become explicit agent constraints,
including quiz/PDF completion, external research, and custom instructions.

After each activity, the agent stores a compact summary. The six most recent
summaries form a rolling context window for related follow-up activities; raw
browser transcripts and stale element references are not retained. If the
agent encounters MFA, CAPTCHA, missing facts, a prohibited action, or repeated
failure, it calls `requestUserInput`. The UI shows a blocking prompt and Web
Push alerts the user if the page is in the background.
