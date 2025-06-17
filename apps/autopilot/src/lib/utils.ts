import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toTitleCase(str: string): string {
  const uncapitalizedWords = new Set([
    "and",
    "or",
    "of",
    "the",
    "in",
    "a",
    "an",
    "to",
    "for",
    "but",
    "nor",
    "on",
    "at",
    "by",
    "with",
  ]);

  return str
    .split(" ")
    .map((word, index) => {
      // Capitalize the first word or any word that is not in the uncapitalized set
      if (index === 0 || !uncapitalizedWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/* Inserting a generic type alias for converting null values to undefined */
export type NullToUndefined<T> = T extends null
  ? undefined
  : T extends (infer U)[]
    ? NullToUndefined<U>[]
    : T extends object
      ? { [K in keyof T]: NullToUndefined<T[K]> }
      : T;

/**
 * Recursively converts all nulls in an object/array to undefined.
 * @param  {*} value  Any value: primitive, object, or array
 * @return {*}        A new value with nulls -> undefined
 */
export function nullsToUndefined<T>(value: T): NullToUndefined<T> {
  if (value === null) {
    return undefined as NullToUndefined<T>;
  }

  if (Array.isArray(value)) {
    return value.map(nullsToUndefined) as NullToUndefined<T>;
  }

  if (typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = nullsToUndefined(val);
    }
    return result as NullToUndefined<T>;
  }

  return value as NullToUndefined<T>;
}
