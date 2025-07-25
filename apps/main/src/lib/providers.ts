import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { perplexity } from "@ai-sdk/perplexity";
import { xai } from "@ai-sdk/xai";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

import { env } from "~/env";
import { defineProviderAvailability, defineProviders } from "./provider-utils";

export const providerAvailability = defineProviderAvailability({
  gateway: () => {
    return !!env.VERCEL_OIDC_TOKEN || !!env.VERCEL;
  },
  openai: () => {
    return !!env.OPENAI_API_KEY;
  },
  anthropic: () => {
    return !!env.ANTRHOPIC_API_KEY;
  },
  google: () => {
    return !!env.GOOGLE_GENERATIVE_AI_API_KEY;
  },
  perplexity: () => {
    return !!env.PERPLEXITY_API_KEY;
  },
  groq: () => {
    return !!env.GROQ_API_KEY;
  },
  xai: () => {
    return !!env.XAI_API_KEY;
  },
  deepseek: () => {
    return !!env.DEEPSEEK_API_KEY;
  },
});

export const modelProviders = defineProviders({
  "gpt-4o": {
    openai: ({ features }) => ({
      model: openai.responses("gpt-4o"),
      system: features.searchToggle?.enabled
        ? "Use your web search tool to find the most relevant information."
        : undefined,
      // tools: features.searchToggle?.enabled
      //   ? {
      //       web_search_preview: openai.tools.webSearchPreview({
      //         searchContextSize: "medium",
      //       }),
      //     }
      //   : undefined,
    }),
    gateway: gateway("openai/gpt-4o"),
  },
  "gpt-4o-mini": {
    openai: ({ features }) => ({
      model: openai.responses("gpt-4o-mini"),
      system: features.searchToggle?.enabled
        ? "Use your web search tool to find the most relevant information."
        : undefined,
      // tools: features.searchToggle?.enabled
      //   ? {
      //       web_search_preview: openai.tools.webSearchPreview({
      //         searchContextSize: "medium",
      //       }),
      //     }
      //   : undefined,
    }),
    gateway: gateway("openai/gpt-4o-mini"),
  },
  "gpt-4.1": {
    openai: openai("gpt-4.1"),
    gateway: gateway("openai/gpt-4.1"),
  },
  "gpt-4.1-mini": {
    openai: openai("gpt-4.1-mini"),
    gateway: gateway("openai/gpt-4.1-mini"),
  },
  "gpt-4.1-nano": {
    openai: openai("gpt-4.1-nano"),
    gateway: gateway("openai/gpt-4.1-nano"),
  },
  "o4-mini": {
    openai: ({ features }) => ({
      model: openai.responses("o4-mini"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("openai/o4-mini"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
  },
  o3: {
    openai: ({ features }) => ({
      model: openai.responses("o3"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("openai/o3"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
  },
  "o3-mini": {
    openai: ({ features }) => ({
      model: openai.responses("o3-mini"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("openai/o3-mini"),
      providerOptions: {
        openai: {
          reasoningEffort: features.thinkSelectRequired?.value ?? "low",
          //   reasoningSummary: "auto",
        },
      },
    }),
  },
  sonar: {
    perplexity: perplexity("sonar"),
    gateway: gateway("perplexity/sonar"),
  },
  "sonar-pro": {
    perplexity: perplexity("sonar-pro"),
    gateway: gateway("perplexity/sonar-pro"),
  },
  "sonar-reasoning": {
    perplexity: perplexity("sonar-reasoning"),
    gateway: gateway("perplexity/sonar-reasoning"),
  },
  "sonar-reasoning-pro": {
    perplexity: perplexity("sonar-reasoning-pro"),
    gateway: gateway("perplexity/sonar-reasoning-pro"),
  },
  "claude-3.7-sonnet": {
    anthropic: ({ features }) => ({
      model: anthropic(
        features.thinkToggle?.enabled
          ? "anthropic/claude-3.7-sonnet-reasoning"
          : "anthropic/claude-3.7-sonnet",
      ),
    }),
    gateway: ({ features }) => ({
      model: gateway(
        features.thinkToggle?.enabled
          ? "anthropic/claude-3.7-sonnet-reasoning"
          : "anthropic/claude-3.7-sonnet",
      ),
    }),
  },
  "claude-3.5-sonnet": {
    anthropic: ({ features }) => ({
      model: anthropic(
        features.thinkToggle?.enabled
          ? "anthropic/claude-3.5-sonnet-reasoning"
          : "anthropic/claude-3.5-sonnet",
      ),
    }),
    gateway: ({ features }) => ({
      model: gateway(
        features.thinkToggle?.enabled
          ? "anthropic/claude-3.5-sonnet-reasoning"
          : "anthropic/claude-3.5-sonnet",
      ),
    }),
  },
  "claude-sonnet-4": {
    anthropic: ({ features }) => ({
      model: anthropic("claude-sonnet-4"),
      providerOptions: {
        anthropic: {
          thinking: features.thinkToggle?.enabled
            ? { type: "enabled", budgetTokens: 12000 }
            : { type: "disabled", budgetTokens: 0 },
        } satisfies AnthropicProviderOptions,
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("anthropic/claude-4-sonnet"),
      providerOptions: {
        anthropic: {
          thinking: features.thinkToggle?.enabled
            ? { type: "enabled", budgetTokens: 12000 }
            : { type: "disabled", budgetTokens: 0 },
        } satisfies AnthropicProviderOptions,
      },
    }),
  },
  "claude-opus-4": {
    gateway: ({ features }) => ({
      model: gateway("anthropic/claude-4-opus"),
      providerOptions: {
        anthropic: {
          thinking: features.thinkToggle?.enabled
            ? { type: "enabled", budgetTokens: 12000 }
            : { type: "disabled", budgetTokens: 0 },
        } satisfies AnthropicProviderOptions,
      },
    }),
  },
  "grok-4": {
    xai: xai("grok-4-latest"),
    gateway: gateway("xai/grok-4"),
  },
  "grok-3-mini": {
    xai: xai("grok-3-mini-latest"),
    gateway: gateway("xai/grok-3-mini"),
  },
  "gemini-2.5-flash-lite": {
    google: ({ features }) => ({
      model: google("gemini-2.5-flash-lite-preview-06-17"),
      providerOptions: {
        google: {
          useSearchGrounding: features.searchToggle?.enabled ?? false,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }),
    // gateway: ({ features }) => ({
    //   model: gateway("google/gemini-2.5-flash-lite"),
    //   providerOptions: {
    //     google: {
    //       useSearchGrounding: features.searchToggle?.enabled ?? false,
    //     } satisfies GoogleGenerativeAIProviderOptions,
    //   },
    // }),
  },
  "gemini-2.5-flash": {
    google: ({ features }) => ({
      model: google("gemini-2.5-flash"),
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: features.thinkToggle?.enabled ?? false,
            thinkingBudget: features.thinkToggle?.enabled ? 12000 : 0,
          },
          useSearchGrounding: features.searchToggle?.enabled ?? false,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("google/gemini-2.5-flash"),
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: features.thinkToggle?.enabled ?? false,
            thinkingBudget: features.thinkToggle?.enabled ? 12000 : 0,
          },
          useSearchGrounding: features.searchToggle?.enabled ?? false,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }),
  },
  "gemini-2.5-pro": {
    google: ({ features }) => ({
      model: google("gemini-2.5-pro"),
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 12000,
          },
          useSearchGrounding: features.searchToggle?.enabled ?? false,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }),
    gateway: ({ features }) => ({
      model: gateway("google/gemini-2.5-pro"),
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: 12000,
          },
          useSearchGrounding: features.searchToggle?.enabled ?? false,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }),
  },
  "llama-4-scout": {
    groq: groq("llama-4-scout-17b-16e-instruct"),
    gateway: gateway("meta/llama-4-scout"),
  },
  "llama-4-maverick": {
    groq: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
    gateway: gateway("meta/llama-4-maverick"),
  },
  "llama-3.3-70b": {
    groq: groq("llama-3.3-70b-versatile"),
    gateway: gateway("meta/llama-3.3-70b"),
  },
  "deepseek-v3": {
    gateway: gateway("deepseek/deepseek-v3"),
  },
  "deepseek-r1": {
    gateway: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: gateway("deepseek/deepseek-r1"),
    }),
  },
  "deepseek-r1-distill": {
    groq: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: groq("deepseek-r1-distill-llama-70b"),
    }),
    gateway: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: gateway("deepseek/deepseek-r1-distill-llama-70b"),
    }),
  },
  "qwen-qwq-32b": {
    groq: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: groq("qwen-qwq-32b"),
    }),
    gateway: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: gateway("alibaba/qwq-32b"),
    }),
  },
  "qwen-3-32b": {
    gateway: wrapLanguageModel({
      middleware: extractReasoningMiddleware({ tagName: "think" }),
      model: gateway("alibaba/qwen-3-32b"),
    }),
  },
});
