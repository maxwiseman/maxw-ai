# Autopilot on Vercel Sandbox

Autopilot runs its Next.js control plane on Vercel and creates one named,
persistent Vercel Sandbox for each active automation run. Chromium, Puppeteer,
the Responses API computer agent, the WebSocket server, and the MJPEG preview
all run inside that Sandbox.

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
   - `OPENAI_API_KEY` (used by the Sandbox's Responses API computer agent)
   - `OPENAI_COMPUTER_MODEL` (defaults to `gpt-5.6-terra`)
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
automations and do not call a model. Every other activity is given to an OpenAI
Responses API computer agent controlling the existing Chromium session through
screenshots and coordinate-based actions. Because it sees the rendered page,
nested iframe boundaries do not need special browser scoping. Settings become
explicit agent constraints, including quiz/PDF completion, external research,
and custom instructions. The agent advances with the terminal `next_activity`
tool instead of clicking Edgenuity's outer navigation itself. The tool prefers
an enabled top-level
footnav control, otherwise waits for visible end-of-activity audio or the
pulsing `.FrameRight` readiness state before advancing within `#stageFrame`.
It verifies that frame progress moved forward before reporting success; the
crawler then classifies the new frame before invoking another agent, so videos
remain deterministic and are never handed to the model.
The deterministic video path performs the same forward-transition check after
the required video finishes.

The worker writes structured `autopilot-computer-agent` and
`autopilot-crawler` events for generation turns, tool names and safe input
metadata, computer action types, tool errors, frame readiness, advancement
decisions, video routing, durations, and token counts. It deliberately omits
screenshots, model text, entered answers, credentials, full URLs, and activity
summaries. Failed or lost workers retain a labeled, bounded diagnostic tail in
the run record before their Sandbox is deleted.

The model uses each activity's own visible controls to answer, submit, retry,
and move between internal questions. It is prohibited from clicking the outer
Go Left, Go Right, FrameLeft, FrameRight, or frame-number controls and calls
`next_activity` only after the activity is complete. The deterministic tool
then owns outer navigation and verifies a forward transition.

After each activity, the agent stores a compact summary. The six most recent
summaries form a rolling context window for related follow-up activities; raw
browser transcripts and stale element references are not retained. If the
agent encounters MFA, CAPTCHA, missing facts, a prohibited action, or repeated
failure, it calls `requestUserInput`. The UI shows a blocking prompt and Web
Push alerts the user if the page is in the background.
