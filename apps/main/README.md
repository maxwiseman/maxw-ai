# [maxw.ai](https://maxw.ai)

A powerful AI-powered chat application built with Next.js, supporting multiple AI providers and offering an intuitive conversational interface.

## 🚀 Features

- **Multi-Provider AI Support**: Integrated with multiple AI providers including:
  - OpenAI (GPT models)
  - Anthropic (Claude models)
  - Google (Gemini models)
  - Groq
  - Perplexity
  - xAI (Grok)
- **Instant Navigations**: Client side routing/caching and onMouseDown links
- **Persistent Conversations**: Chat history and session management
- **Chat Branching**: Branch a chat at a specific message
- **Model Features**: Supports model features such as web search and reasoning effort
- **Shareable Chats**: Share conversations with others
- **Attachment Support (WIP)**: Add attachments when chatting with LLMs
- **Syntax Highlighting**: Highlighted code blocks make code look like art
- **Modern UI**: Built with TailwindCSS and shadcn/ui
- **Type-safe**: Full TypeScript support with tRPC API layer

## 🛠 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: TanStack Query
- **AI Integration**: Vercel AI SDK
- **Authentication**: BetterAuth
- **Database**: SQLite (Turso)
- **Icons**: Tabler Icons & Lucide React

## 📋 Prerequisites

- Node.js ≥ 20.16.0
- Bun ≥ 1.2.8 (recommended package manager)

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the repository root with the following variables:

```bash
# Database
DATABASE_URL="your_database_url"
DATABASE_AUTH_TOKEN="your_database_auth_token"

# AI Provider API Keys (at least one required)
OPENAI_API_KEY="your_openai_api_key"
ANTRHOPIC_API_KEY="your_anthropic_api_key"
XAI_API_KEY="your_xai_api_key"
GOOGLE_GENERATIVE_AI_API_KEY="your_google_api_key"
PERPLEXITY_API_KEY="your_perplexity_api_key"
GROQ_API_KEY="your_groq_api_key"

# Optional
VERCEL_OIDC_TOKEN="your_vercel_token"
```

### 2. Installation

From the repository root:

```bash
# Install dependencies
bun install

# Push database schema
bun db:push
```

### 3. Development

```bash
# Start the development server
bun dev:main
```

The application will be available at `http://localhost:3000`.

## 📁 Project Structure

```
src/
├── app/                   # Next.js App Router
│   ├── api/               # API routes
│   ├── chats/             # Chat-related pages
│   ├── components/        # React components
│   ├── share/             # Shared chat functionality
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/                   # Utility libraries
├── trpc/                  # tRPC configuration
├── env.ts                 # Environment variables
└── _middleware.ts         # Middleware configuration
```

## 🔧 Available Scripts

```bash
# Development
bun dev                    # Start development server
bun build                  # Build for production
bun start                  # Start production server

# Code Quality
bun lint                   # Run ESLint
bun format                 # Check code formatting
bun format --write         # Fix code formatting

# Utilities
bun clean                  # Clean build artifacts
```

## 🏗 Monorepo Integration

This application is part of a larger monorepo with shared packages:

- `@acme/api` - Shared API logic
- `@acme/auth` - Authentication system
- `@acme/db` - Database configuration
- `@acme/ui` - Shared UI components
- `@acme/validators` - Shared validation schemas

## 🔒 Security

- Environment variables are validated using Zod schemas
- Type-safe API layer with tRPC
- Secure authentication system
- Input validation on all endpoints

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. Please contact the maintainer for contribution guidelines.

---

For more information about the broader ecosystem, see the root repository README.
