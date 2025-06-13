# maxw-ai

A TypeScript monorepo for AI-powered applications built with modern web technologies.

## Overview

This repository contains multiple AI-focused applications sharing common packages and infrastructure. Built with TurboRepo for efficient development and deployment.

## Structure

```text
apps/
  ├── main/              # Primary Next.js application with AI features
  └── rapid-grader/      # AI-powered grading application

packages/
  ├── api/               # tRPC API layer with type-safe endpoints
  ├── auth/              # Authentication using Better Auth
  ├── db/                # Database layer with Drizzle ORM
  ├── ui/                # Shared UI components (shadcn/ui based)
  └── validators/        # Shared Zod validation schemas

tooling/
  ├── eslint/           # Shared ESLint configurations
  ├── prettier/         # Shared Prettier configuration
  ├── tailwind/         # Shared Tailwind CSS configuration
  └── typescript/       # Shared TypeScript configurations
```

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Language**: TypeScript
- **Database**: Turso (libSQL) with Drizzle ORM
- **Authentication**: Better Auth with GitHub/Discord OAuth
- **API**: tRPC v11 for type-safe APIs
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI**: Vercel AI SDK with OpenAI, Anthropic support
- **Build Tool**: TurboRepo with Bun package manager
- **Deployment**: Vercel (web apps)

## Applications

### Main App (`apps/main`)

The primary application featuring:

- AI chat interface using Vercel AI SDK
- Support for OpenAI and Anthropic models
- Persistent chat history with React Query
- Authentication and user management
- Modern UI with motion animations

### Rapid Grader (`apps/rapid-grader`)

An AI-powered grading application for educational use:

- Automated assignment grading
- AI feedback generation
- Educational content analysis

## Quick Start

### Prerequisites

- Node.js >=20.16.0
- Bun ^1.2.8

### Installation

```bash
# Clone the repository
git clone https://github.com/maxwiseman/maxw-ai.git
cd maxw-ai

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up the database
bun db:push

# Start development servers
bun dev
```

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Database
DATABASE_URL="libsql://[DB-NAME].aws-us-east-1.turso.io"
DATABASE_AUTH_TOKEN=""

# Authentication
AUTH_SECRET="supersecret"
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_DISCORD_ID=""
AUTH_DISCORD_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"

# AI
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
...

# Optional
PORT="3000"
```

## Development

```bash
# Start all apps in development mode
bun dev

# Start only the main app
bun dev:next

# Run linting
bun lint

# Format code
bun format:fix

# Database operations
bun db:push     # Push schema changes
bun db:studio   # Open Drizzle Studio
```

## Deployment

### Web Applications

Deploy to Vercel:

1. Connect your GitHub repository to Vercel
2. Set the root directory to `apps/main` or `apps/rapid-grader`
3. Add your environment variables
4. Deploy

### Environment Setup

- **Database**: Set up a Turso database and add connection details
- **Authentication**: Configure OAuth apps for GitHub/Discord
- **AI**: Add your API keys

## Package Management

This monorepo uses Bun workspaces. To add dependencies:

```bash
# Add to specific app
bun add <package> --filter @acme/main

# Add to specific package
bun add <package> --filter @acme/ui

# Add dev dependency to root
bun add -D <package>
```

## Scripts

- `bun dev` - Start all apps in development
- `bun build` - Build all packages and apps
- `bun lint` - Lint all workspaces
- `bun format` - Format all code
- `bun clean` - Clean all build artifacts
- `bun db:push` - Push database schema
- `bun db:studio` - Open database studio
- `bun ui-add` - Add new UI components

## License

MIT © Max Wiseman
