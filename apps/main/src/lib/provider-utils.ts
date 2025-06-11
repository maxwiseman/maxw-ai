import type {
  LanguageModel,
  PrepareStepFunction,
  streamText,
  ToolSet,
} from "ai";

import type { ModelFeatureResponse, ModelId } from "./model-utils";
import { modelProviders, providerAvailability } from "./providers";

type FirstArgument<F> = F extends (arg: infer A, ...args: any[]) => any
  ? A
  : never;
export type ProviderId = keyof typeof providerAvailability;
export type ProviderFunction =
  | ((opt: {
      features: ModelFeatureResponse;
      // steps: StepResult<NoInfer<ToolSet>>[];
      // stepNumber: number;
    }) => Partial<
      // ReturnType<PrepareStepFunction<NoInfer<ToolSet>>> & { tools?: ToolSet }
      FirstArgument<typeof streamText>
    > & { model: LanguageModel })
  | LanguageModel;

export function defineProviderAvailability<
  T extends Record<string, () => boolean>,
>(providers: T) {
  return providers;
}
export function defineProviders<
  T extends Record<ModelId, Partial<Record<ProviderId, ProviderFunction>>>,
>(providers: T) {
  return providers;
}

export function getProvider(model: ModelId, features?: ModelFeatureResponse) {
  const possibleProviders = modelProviders[model];
  const provider = Object.entries(possibleProviders).find(([providerId]) =>
    providerAvailability[providerId as keyof typeof providerAvailability](),
  ) as [ProviderId, ProviderFunction | LanguageModel];
  if (!provider) {
    throw new Error(`No provider found for model ${model}`);
  }
  const returnData =
    typeof provider[1] === "function"
      ? provider[1]({ features: features ?? {} })
      : { model: provider[1] };
  console.log("Return Data: ", returnData);
  return returnData;
}

export function getAvailableModelIds() {
  return Object.entries(modelProviders)
    .filter(([_, providers]) =>
      Object.entries(providers).some(([providerId]) =>
        providerAvailability[providerId as keyof typeof providerAvailability](),
      ),
    )
    .map((i) => i[0]);
}
