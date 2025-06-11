import { openai } from "@ai-sdk/openai";
import { gateway } from "@vercel/ai-sdk-gateway";

import { defineProviderAvailability, defineProviders } from "./provider-utils";

export const providerAvailability = defineProviderAvailability({
  gateway: () => {
    return true;
  },
  openai: () => {
    return true;
  },
  anthropic: () => {
    return false;
  },
});

export const modelProviders = defineProviders({
  "gpt-4o": {
    openai: ({ features }) => ({
      model: openai.responses("gpt-4o"),
      system: "Use your web search tool to find the most relevant information.",
      tools: features.searchToggle?.enabled
        ? { web_search_preview: openai.tools.webSearchPreview() }
        : undefined,
    }),
    gateway: gateway("openai/gpt-4o"),
  },
  "gpt-4o-mini": {
    openai: ({ features }) => ({
      model: openai.responses("gpt-4o-mini"),
      system: "Use your web search tool to find the most relevant information.",
      tools: features.searchToggle?.enabled
        ? { web_search_preview: openai.tools.webSearchPreview() }
        : undefined,
    }),
    gateway: gateway("openai/gpt-4o-mini"),
  },
  "gpt-4.1": {
    gateway: gateway("openai/gpt-4.1"),
    openai: openai("gpt-4.1"),
  },
  "gpt-4.1-mini": {
    gateway: gateway("openai/gpt-4.1-mini"),
    openai: openai("gpt-4.1-mini"),
  },
  "o4-mini": {
    openai: ({ features }) => ({
      model: openai.responses("o4-mini"),
      providerOptions: features.thinkSelectRequired?.enabled
        ? {
            openai: {
              reasoningEffort: features.thinkSelectRequired.value ?? "low",
            },
          }
        : undefined,
    }),
    gateway: gateway("openai/o4-mini"),
  },
  "claude-3.7-sonnet": {
    gateway: gateway("anthropic/claude-3.7-sonnet"),
  },
  "claude-3.7-sonnet-reasoning": {
    gateway: gateway("anthropic/claude-3.7-sonnet-reasoning"),
  },
  "claude-3.5-sonnet": {
    gateway: gateway("anthropic/claude-v3.5-sonnet"),
  },
  "claude-4-sonnet": {
    gateway: gateway("anthropic/claude-4-sonnet-20250514"),
  },
  "claude-4-opus": {
    gateway: gateway("anthropic/claude-4-opus-20250514"),
  },
  "grok-3": {
    gateway: gateway("xai/grok-3-beta"),
  },
  "grok-3-mini": {
    gateway: gateway("xai/grok-3-mini-beta"),
  },
  "gemini-2.0-flash": {
    gateway: gateway("vertex/gemini-2.0-flash-001"),
  },
  "gemini-2.0-flash-lite": {
    gateway: gateway("vertex/gemini-2.0-flash-lite-001"),
  },
  "gemini-2.5-flash": {
    // gateway: gateway("vertex/gemini-2.5-flash-001"),
  },
  "gemini-2.5-flash-thinking": {
    // gateway: gateway("vertex/gemini-2.5-flash-thinking-exp-01-21"),
  },
  "gemini-2.5-pro": {
    // gateway: gateway("vertex/gemini-2.5-pro-exp-01-21"),
  },
  "gpt-4.1-nano": {
    gateway: gateway("openai/gpt-4.1-nano"),
  },
  o3: {
    gateway: gateway("openai/o3"),
  },
  "o3-mini": {
    gateway: gateway("openai/o3-mini"),
  },
  "llama-4-scout": {
    gateway: gateway("groq/llama-4-scout-17b-16e-instruct"),
  },
  "llama-4-maverick": {
    gateway: gateway("vertex/llama-4-maverick-17b-128e-instruct-maas"),
  },
  "llama-3.3-70b": {
    gateway: gateway("groq/llama-3.3-70b-versatile"),
  },
  "deepseek-v3-0324": {
    gateway: gateway("fireworks/deepseek-v3"),
  },
  "deepseek-r1-0528": {
    gateway: gateway("deepseek/deepseek-r1-0528"),
  },
  "deepseek-r1-llama-distilled": {
    gateway: gateway("groq/deepseek-r1-distill-llama-70b"),
  },
  "qwen-qwq-32b": {
    gateway: gateway("groq/qwen-qwq-32b"),
  },
  "qwen-3-32b": {
    gateway: gateway("cerebras/qwen-3-32b"),
  },
});
