# Autopilot on Vercel Sandbox

Autopilot runs its Next.js control plane on Vercel and creates one named,
persistent Vercel Sandbox for each active automation run. Chromium, Puppeteer,
the WebSocket server, and the MJPEG preview all run inside that Sandbox.

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
sends the current running/stopped state and its accumulated status list.

If the Sandbox itself reaches its platform timeout or crashes, its filesystem
can be restored, but a live Chromium process cannot. That case becomes a new
Autopilot run rather than pretending the browser session was recoverable.

## One-time deployment setup

1. Use a Vercel Pro or Enterprise project if runs need longer than Hobby's
   Sandbox duration limit.
2. Set these project environment variables:
   - `AUTOPILOT_WORKER_SECRET` (at least 32 random characters)
   - `OPENAI_API_KEY`
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
5. Apply the new `autopilot_run` table:

   ```bash
   bun db:push
   ```

6. Deploy `apps/autopilot` to Vercel. Vercel OIDC authenticates Sandbox and
   Workflow automatically in production.

For local Sandbox provisioning, link/pull the Vercel project so an OIDC token is
available, or set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.

## Lifecycle

1. Start creates a database run and starts `manageAutopilotRun`.
2. Workflow registers its private completion hook before provisioning.
3. A named Sandbox checks out the exact Vercel Git commit, installs Bun and
   Chromium dependencies, and starts `@acme/autopilot-backend` on port 8080.
4. The client polls until the worker is ready, then opens the signed WebSocket.
5. Worker completion resumes the Workflow hook.
6. Workflow stops and snapshots the Sandbox and marks the run stopped.
7. A 24-hour durable timeout performs the same cleanup if no callback arrives.
