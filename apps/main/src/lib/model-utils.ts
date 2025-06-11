import type { modelBrands, modelFeatures, models } from "./models";

export type ModelId = keyof typeof models;

export interface ModelFeatureDisplay {
  icon: React.ComponentType<any>;
  label: string;
}
export interface ModelFeature {
  id: string;
  option?:
    | { type: "toggle"; defaultValue: boolean }
    | {
        type: "select";
        forceEnabled?: boolean;
        values: (ModelFeatureDisplay & { value: string })[];
        defaultValue: string;
      };
  display: ModelFeatureDisplay & { tooltip: string };
}
export interface ModelFeatureReturn {
  enabled: boolean;
  value: string | null;
}
export type ModelFeatureResponse = Partial<
  Record<keyof typeof modelFeatures, ModelFeatureReturn>
>;
export interface ModelBrand {
  icon: React.ComponentType<any>;
  name: string;
}

export interface ModelEntry {
  name: string;
  description: string;
  brand: (typeof modelBrands)[keyof typeof modelBrands];
  url: string;
  features?: ModelFeature[];
}

export function defineModelFeatures<
  T extends Record<string, Omit<ModelFeature, "id">>,
>(features: T) {
  return Object.fromEntries(
    Object.entries(features).map(([k, v]) => [k, { id: k, ...v }]),
  ) as Record<keyof T, ModelFeature>;
}
export function defineModelBrands<T extends Record<string, ModelBrand>>(
  brands: T,
) {
  return brands;
}
export function defineModels<T extends string>(models: Record<T, ModelEntry>) {
  return models;
}
