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

export async function fileToFileUIPart(
  file: File,
): Promise<{ type: "file"; mediaType: string; url: string; name: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return {
    type: "file",
    mediaType: file.type,
    url: `data:${file.type};base64,${base64}`,
    name: file.name,
  };
}
