import { Model } from "@/types";

export const MODEL_STORAGE_KEY = "selectedModelName";

export function selectInitialModel(
  models: Model[],
  storedName?: string | null,
): Model | null {
  if (models.length === 0) {
    return null;
  }

  if (!storedName) {
    return models[0];
  }

  const match = models.find((model) => model.name === storedName);
  return match ?? models[0];
}
