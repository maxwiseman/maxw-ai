import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Brain,
  Globe,
} from "lucide-react";

import {
  AnthropicIcon,
  DeepSeekIcon,
  GeminiIcon,
  MetaIcon,
  OpenAIIcon,
  QwenIcon,
  xAIIcon,
} from "@acme/ui/custom-icons";

import {
  defineModelBrands,
  defineModelFeatures,
  defineModels,
} from "./model-utils";

export const modelBrands = defineModelBrands({
  openai: {
    icon: OpenAIIcon,
    name: "OpenAI",
  },
  anthropic: {
    icon: AnthropicIcon,
    name: "Anthropic",
  },
  xai: {
    icon: xAIIcon,
    name: "xAI",
  },
  meta: {
    icon: MetaIcon,
    name: "Meta",
  },
  deepseek: {
    icon: DeepSeekIcon,
    name: "DeepSeek",
  },
  qwen: {
    icon: QwenIcon,
    name: "Qwen",
  },
  gemini: {
    icon: GeminiIcon,
    name: "Google",
  },
});

export const modelFeatures = defineModelFeatures({
  thinkToggle: {
    option: { type: "toggle", defaultValue: false },
    display: {
      icon: Brain,
      label: "Think",
      tooltip: "Think before responding",
    },
  },
  thinkSelect: {
    option: {
      type: "select",
      values: [
        { label: "Low", value: "low", icon: BatteryLow },
        { label: "Medium", value: "medium", icon: BatteryMedium },
        { label: "High", value: "high", icon: BatteryFull },
      ],
      defaultValue: "low",
    },
    display: {
      icon: Brain,
      label: "Think",
      tooltip: "Think before responding",
    },
  },
  thinkSelectRequired: {
    option: {
      type: "select",
      forceEnabled: true,
      values: [
        { label: "Low", value: "low", icon: BatteryLow },
        { label: "Medium", value: "medium", icon: BatteryMedium },
        { label: "High", value: "high", icon: BatteryFull },
      ],
      defaultValue: "low",
    },
    display: {
      icon: Brain,
      label: "Think",
      tooltip: "Reasoning effort",
    },
  },
  thinkRequired: {
    display: {
      icon: Brain,
      label: "Think",
      tooltip: "Thinks before responding",
    },
  },
  searchToggle: {
    option: { type: "toggle", defaultValue: false },
    display: { icon: Globe, label: "Search", tooltip: "Search the web" },
  },
});

export const models = defineModels({
  "gpt-4o": {
    name: "GPT-4o",
    description:
      "GPT-4o is a large language model that can generate text, images, and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/gpt-4o",
    features: [modelFeatures.searchToggle],
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    description:
      "GPT-4o Mini is a smaller language model that can generate text, images, and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/gpt-4o-mini",
    features: [modelFeatures.searchToggle],
  },
  "gpt-4.1": {
    name: "GPT-4.1",
    description:
      "GPT-4.1 is a large language model that can generate text, images, and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/gpt-4.1",
  },
  "gpt-4.1-mini": {
    name: "GPT-4.1 Mini",
    description:
      "GPT-4.1 Mini is a smaller language model that can generate text, images, and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/gpt-4.1-mini",
  },
  "gpt-4.1-nano": {
    name: "GPT 4.1 Nano",
    description: "GPT 4.1 Nano is a smaller version of GPT 4.1.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/gpt-4-1-nano",
  },
  "o4-mini": {
    name: "o4 Mini",
    description:
      "o4 Mini is a smaller reasoning model that can generate text, images, and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/o4-mini",
    features: [modelFeatures.thinkSelectRequired],
  },
  o3: {
    name: "o3",
    description: "o3 is a reasoning model that can generate text and code.",
    brand: modelBrands.openai,
    url: "https://openai.com/api/models/o3",
    features: [modelFeatures.thinkSelectRequired],
  },
  "claude-3.7-sonnet": {
    name: "Claude 3.7 Sonnet",
    description:
      "Claude 3.7 Sonnet is a large language model that can generate text, images, and code.",
    brand: modelBrands.anthropic,
    url: "https://openai.com/api/models/claude-3-7-sonnet",
    features: [modelFeatures.thinkSelect],
  },
  "claude-3.5-sonnet": {
    name: "Claude 3.5 Sonnet",
    description:
      "Claude 3.5 Sonnet is a large language model that can generate text, images, and code.",
    brand: modelBrands.anthropic,
    url: "https://openai.com/api/models/claude-3-5-sonnet",
  },
  "claude-4-sonnet": {
    name: "Claude 4 Sonnet",
    description:
      "Claude 4 Sonnet is a large language model that can generate text, images, and code.",
    brand: modelBrands.anthropic,
    url: "https://openai.com/api/models/claude-4-sonnet",
    features: [modelFeatures.thinkSelect],
  },
  "claude-4-opus": {
    name: "Claude 4 Opus",
    description:
      "Claude 4 Opus is a large language model that can generate text, images, and code.",
    brand: modelBrands.anthropic,
    url: "https://openai.com/api/models/claude-4-opus",
  },
  "grok-3": {
    name: "Grok 3",
    description:
      "Grok 3 is a large language model that can generate text, images, and code.",
    brand: modelBrands.xai,
    url: "https://openai.com/api/models/grok-3",
  },
  "grok-3-mini": {
    name: "Grok 3 Mini",
    description:
      "Grok 3 Mini is a smaller large language model that can generate text, images, and code.",
    brand: modelBrands.xai,
    url: "https://openai.com/api/models/grok-3-mini",
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    description:
      "Gemini 2.0 Flash is a large language model with advanced capabilities.",
    brand: modelBrands.gemini,
    url: "https://meta.com/api/models/gemini-2-0-flash",
    features: [modelFeatures.searchToggle],
  },
  "gemini-2.0-flash-lite": {
    name: "Gemini 2.0 Flash Lite",
    description:
      "Gemini 2.0 Flash Lite is a lighter version of Gemini 2.0 Flash.",
    brand: modelBrands.gemini,
    url: "https://meta.com/api/models/gemini-2-0-flash-lite",
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description: "Gemini 2.5 Flash is an enhanced version of Gemini 2.0 Flash.",
    brand: modelBrands.gemini,
    url: "https://meta.com/api/models/gemini-2-5-flash",
  },
  "gemini-2.5-flash-thinking": {
    name: "Gemini 2.5 Flash (Thinking)",
    description:
      "Gemini 2.5 Flash (Thinking) is a reasoning-focused version of Gemini 2.5 Flash.",
    brand: modelBrands.gemini,
    url: "https://meta.com/api/models/gemini-2-5-flash-thinking",
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    description: "Gemini 2.5 Pro is a professional-grade large language model.",
    brand: modelBrands.gemini,
    url: "https://meta.com/api/models/gemini-2-5-pro",
  },
  "llama-4-scout": {
    name: "Llama 4 Scout",
    description: "Llama 4 Scout is a large language model by Meta.",
    brand: modelBrands.meta,
    url: "https://meta.com/api/models/llama-4-scout",
  },
  "llama-4-maverick": {
    name: "Llama 4 Maverick",
    description: "Llama 4 Maverick is an advanced Meta language model.",
    brand: modelBrands.meta,
    url: "https://meta.com/api/models/llama-4-maverick",
  },
  "llama-3.3-70b": {
    name: "Llama 3.3 70b",
    description: "Llama 3.3 70b is a large Meta language model.",
    brand: modelBrands.meta,
    url: "https://meta.com/api/models/llama-3-3-70b",
  },
  "deepseek-v3-0324": {
    name: "DeepSeek v3 (0324)",
    description: "DeepSeek v3 (0324) is a version of DeepSeek v3.",
    brand: modelBrands.deepseek,
    url: "https://deepseek.com/api/models/v3-0324",
  },
  "deepseek-r1-0528": {
    name: "DeepSeek R1 (0528)",
    description: "DeepSeek R1 (0528) is a version of DeepSeek R1.",
    brand: modelBrands.deepseek,
    url: "https://deepseek.com/api/models/r1-0528",
  },
  "deepseek-r1-llama-distilled": {
    name: "DeepSeek R1 (Llama Distilled)",
    description: "DeepSeek R1 distilled from Llama models.",
    brand: modelBrands.deepseek,
    url: "https://deepseek.com/api/models/r1-llama-distilled",
  },
  "qwen-qwq-32b": {
    name: "Qwen qwq-32b",
    description: "Qwen qwq-32b is a large language model.",
    brand: modelBrands.qwen,
    url: "https://qwen.com/api/models/qwq-32b",
  },
  "qwen-3-32b": {
    name: "Qwen 3 32b",
    description: "Qwen 3 32b is an advanced large language model.",
    brand: modelBrands.qwen,
    url: "https://qwen.com/api/models/2-5-32b",
  },
});
