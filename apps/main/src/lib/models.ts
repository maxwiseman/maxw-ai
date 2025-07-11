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
  PerplexityIcon,
  QwenIcon,
  xAIIcon,
} from "@acme/ui/custom-icons";

import type { ModelId } from "./model-utils";
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
  perplexity: {
    icon: PerplexityIcon,
    name: "Perplexity",
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
  searchRequired: {
    display: { icon: Globe, label: "Search", tooltip: "Search the web" },
  },
});

export const defaultModel: ModelId = "gpt-4.1-mini";

export const models = defineModels({
  "gemini-2.5-flash-lite": {
    name: "Gemini 2.5 Flash Lite",
    description: "",
    brand: modelBrands.gemini,
    url: "https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite",
    features: [modelFeatures.searchToggle, modelFeatures.thinkToggle],
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description: "",
    brand: modelBrands.gemini,
    url: "https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash",
    features: [modelFeatures.searchToggle, modelFeatures.thinkToggle],
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    description: "",
    brand: modelBrands.gemini,
    url: "https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro",
    features: [modelFeatures.searchToggle, modelFeatures.thinkRequired],
  },
  "gpt-4o-mini": {
    name: "GPT-4o mini",
    description:
      "GPT-4o mini from OpenAI is their most advanced and cost-efficient small model. It is multi-modal (accepting text or image inputs and outputting text) and has higher intelligence than gpt-3.5-turbo but is just as fast.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/gpt-4o-mini",
    features: [modelFeatures.searchToggle],
  },
  "gpt-4o": {
    name: "GPT-4o",
    description:
      "GPT-4o from OpenAI has broad general knowledge and domain expertise allowing it to follow complex instructions in natural language and solve difficult problems accurately. It matches GPT-4 Turbo performance with a faster and cheaper API.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/gpt-4o",
    features: [modelFeatures.searchToggle],
  },
  "gpt-4.1": {
    name: "GPT-4.1",
    description:
      "GPT 4.1 is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/gpt-4.1",
  },
  "gpt-4.1-mini": {
    name: "GPT-4.1 mini",
    description:
      "GPT 4.1 mini provides a balance between intelligence, speed, and cost that makes it an attractive model for many use cases.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/gpt-4.1-mini",
  },
  "gpt-4.1-nano": {
    name: "GPT-4.1 nano",
    description:
      "GPT-4.1 nano is the fastest, most cost-effective GPT 4.1 model.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/gpt-4.1-nano",
  },
  o3: {
    name: "o3",
    description:
      "OpenAI's o3 is their most powerful reasoning model, setting new state-of-the-art benchmarks in coding, math, science, and visual perception. It excels at complex queries requiring multi-faceted analysis, with particular strength in analyzing images, charts, and graphics.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/o3",
    features: [modelFeatures.thinkSelectRequired],
  },
  "o3-mini": {
    name: "o3 mini",
    description:
      "o3-mini is OpenAI's most recent small reasoning model, providing high intelligence at the same cost and latency targets of o1-mini.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/o3-mini",
    features: [modelFeatures.thinkSelectRequired],
  },
  "o4-mini": {
    name: "o4 mini",
    description:
      "OpenAI's o4-mini delivers fast, cost-efficient reasoning with exceptional performance for its size, particularly excelling in math (best-performing on AIME benchmarks), coding, and visual tasks.",
    brand: modelBrands.openai,
    url: "https://platform.openai.com/docs/models/o4-mini",
    features: [modelFeatures.thinkSelectRequired],
  },
  sonar: {
    name: "Sonar",
    description:
      "Perplexity's lightweight offering with search grounding, quicker and cheaper than Sonar Pro.",
    brand: modelBrands.perplexity,
    url: "https://docs.perplexity.ai/models/models/sonar",
    features: [modelFeatures.searchRequired],
  },
  "sonar-pro": {
    name: "Sonar Pro",
    description:
      "Perplexity's premier offering with search grounding, supporting advanced queries and follow-ups.",
    brand: modelBrands.perplexity,
    url: "https://docs.perplexity.ai/models/models/sonar-pro",
    features: [modelFeatures.searchRequired],
  },
  "sonar-reasoning": {
    name: "Sonar Reasoning",
    description:
      "A reasoning-focused model that outputs Chain of Thought (CoT) in responses, providing detailed explanations with search grounding.",
    brand: modelBrands.perplexity,
    url: "https://docs.perplexity.ai/models/models/sonar-reasoning",
    features: [modelFeatures.searchRequired, modelFeatures.thinkRequired],
  },
  "sonar-reasoning-pro": {
    name: "Sonar Reasoning Pro",
    description:
      "A premium reasoning-focused model that outputs Chain of Thought (CoT) in responses, providing comprehensive explanations with enhanced search capabilities and multiple search queries per request.",
    brand: modelBrands.perplexity,
    url: "https://docs.perplexity.ai/models/models/sonar-reasoning-pro",
    features: [modelFeatures.searchRequired, modelFeatures.thinkRequired],
  },
  "claude-opus-4": {
    name: "Claude Opus 4",
    description:
      "Claude Opus 4 is Anthropic's most powerful model yet and the best coding model in the world, leading on SWE-bench (72.5%) and Terminal-bench (43.2%). It delivers sustained performance on long-running tasks that require focused effort and thousands of steps, with the ability to work continuously for several hours—dramatically outperforming all Sonnet models and significantly expanding what AI agents can accomplish.",
    brand: modelBrands.anthropic,
    url: "https://docs.anthropic.com/claude/docs/models-overview",
    features: [modelFeatures.thinkToggle],
  },
  "claude-sonnet-4": {
    name: "Claude Sonnet 4",
    description:
      "Claude Sonnet 4 significantly improves on Sonnet 3.7's industry-leading capabilities, excelling in coding with a state-of-the-art 72.7% on SWE-bench. The model balances performance and efficiency for internal and external use cases, with enhanced steerability for greater control over implementations. While not matching Opus 4 in most domains, it delivers an optimal mix of capability and practicality.",
    brand: modelBrands.anthropic,
    url: "https://docs.anthropic.com/claude/docs/models-overview",
    features: [modelFeatures.thinkToggle],
  },
  "claude-3.7-sonnet": {
    name: "Claude 3.7 Sonnet",
    description:
      "Claude 3.7 Sonnet is the first hybrid reasoning model and Anthropic's most intelligent model to date. It delivers state-of-the-art performance for coding, content generation, data analysis, and planning tasks, building upon its predecessor Claude 3.5 Sonnet's capabilities in software engineering and computer use.",
    brand: modelBrands.anthropic,
    url: "https://docs.anthropic.com/claude/docs/models-overview",
    features: [modelFeatures.thinkToggle],
  },
  "claude-3.5-sonnet": {
    name: "Claude 3.5 Sonnet",
    description:
      "Claude 3.5 Sonnet strikes the ideal balance between intelligence and speed—particularly for enterprise workloads. It delivers strong performance at a lower cost compared to its peers, and is engineered for high endurance in large-scale AI deployments.",
    brand: modelBrands.anthropic,
    url: "https://docs.anthropic.com/claude/docs/models-overview",
  },
  "llama-3.3-70b": {
    name: "Llama 3.3 70b",
    description:
      "Where performance meets efficiency. This model supports high-performance conversational AI designed for content creation, enterprise applications, and research, offering advanced language understanding capabilities, including text summarization, classification, sentiment analysis, and code generation.",
    brand: modelBrands.meta,
    url: "https://www.llama.com/docs/model-cards-and-prompt-formats/llama3_3/",
  },
  "llama-4-maverick": {
    name: "Llama 4 Maverick",
    description:
      "As a general purpose LLM, Llama 4 Maverick contains 17 billion active parameters, 128 experts, and 400 billion total parameters, offering high quality at a lower price compared to Llama 3.3 70B.",
    brand: modelBrands.meta,
    url: "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
  },
  "llama-4-scout": {
    name: "Llama 4 Scout",
    description:
      "Llama 4 Scout is the best multimodal model in the world in its class and is more powerful than our Llama 3 models, while fitting in a single H100 GPU. Additionally, Llama 4 Scout supports an industry-leading context window of up to 10M tokens.",
    brand: modelBrands.meta,
    url: "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
  },
  "deepseek-v3": {
    name: "Deepseek V3",
    description:
      "DeepSeek-V3 is an open-source large language model that builds upon LLaMA (Meta's foundational language model) to enable versatile functionalities such as text generation, code completion, and more, served by Fireworks AI.",
    brand: modelBrands.deepseek,
    url: "https://fireworks.ai/models/fireworks/deepseek-v3",
  },
  "deepseek-r1": {
    name: "Deepseek R1",
    description:
      "DeepSeek Reasoner is a specialized model developed by DeepSeek that uses Chain of Thought (CoT) reasoning to improve response accuracy. Before providing a final answer, it generates detailed reasoning steps that are accessible through the API, allowing users to examine and leverage the model's thought process, served by Fireworks AI.",
    brand: modelBrands.deepseek,
    url: "https://fireworks.ai/models/fireworks/deepseek-r1",
    features: [modelFeatures.thinkRequired],
  },
  "deepseek-r1-distill": {
    name: "Deepseek R1 Distill",
    description:
      "DeepSeek-R1-Distill-Llama-70B is a distilled, more efficient variant of the 70B Llama model. It preserves strong performance across text-generation tasks, reducing computational overhead for easier deployment and research. Served by Groq with their custom Language Processing Units (LPUs) hardware to provide fast and efficient inference.",
    brand: modelBrands.deepseek,
    url: "https://console.groq.com/playground?model=deepseek-r1-distill-llama-70b",
    features: [modelFeatures.thinkRequired],
  },
  "grok-4": {
    name: "Grok 4",
    description:
      "xAI's latest and greatest flagship model, offering unparalleled performance in natural language, math and reasoning - the perfect jack of all trades.",
    brand: modelBrands.xai,
    url: "https://docs.x.ai/docs/models",
  },
  "grok-3-mini": {
    name: "Grok 3 Mini",
    description:
      "xAI's lightweight model that thinks before responding. Great for simple or logic-based tasks that do not require deep domain knowledge. The raw thinking traces are accessible.",
    brand: modelBrands.xai,
    url: "https://docs.x.ai/docs/models",
    features: [modelFeatures.thinkRequired],
  },
  "qwen-qwq-32b": {
    name: "Qwen QWQ 32b",
    description:
      "Qwen QWQ-32B is a powerful large language model with strong reasoning capabilities and versatile applications across various tasks. Served by Groq with their custom Language Processing Units (LPUs) hardware to provide fast and efficient inference.",
    brand: modelBrands.qwen,
    url: "https://qwenlm.github.io/blog/qwq-32b-preview/",
    features: [modelFeatures.thinkRequired],
  },
  "qwen-3-32b": {
    name: "Qwen 3 32b",
    description:
      "Qwen3-32B is a world-class model with comparable quality to DeepSeek R1 while outperforming GPT-4.1 and Claude Sonnet 3.7. It excels in code-gen, tool-calling, and advanced reasoning, making it an exceptional model for a wide range of production use cases.",
    brand: modelBrands.qwen,
    url: "https://qwenlm.github.io/",
  },
});
