import { compareText } from "../canonical-json.js";
import type { CatalogComponent, RecommendationPolicy } from "./contracts.js";

export const recommendationPolicy: RecommendationPolicy = {
  $schema: "urn:mcgen:schema:catalog-recommendation-policy:1",
  schemaVersion: 1,
  id: "default-recommendation",
  version: "1.0.0",
  eligibleStatuses: ["verified", "legacy-verified"],
  eligibleChannels: ["release"],
  tieBreakOrder: [
    "official-marker",
    "status",
    "nondeprecated",
    "version",
    "evidence",
    "text",
  ],
  fallback: "none",
};

export type RecommendationCandidate = CatalogComponent & {
  officialMarker?: boolean;
};

function compareVersionDescending(left: string, right: string): number {
  const parts = (value: string) =>
    value.split(/([0-9]+)/u).filter((part) => part.length > 0);
  const leftParts = parts(left);
  const rightParts = parts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    if (leftPart === rightPart) continue;
    if (/^[0-9]+$/u.test(leftPart) && /^[0-9]+$/u.test(rightPart)) {
      const numeric = Number(rightPart) - Number(leftPart);
      if (numeric) return numeric;
    }
    return compareText(rightPart, leftPart);
  }
  return 0;
}

export function recommendedComponent(
  candidates: readonly RecommendationCandidate[],
): RecommendationCandidate | undefined {
  const eligible = candidates.filter(
    (candidate) =>
      (candidate.status === "verified" ||
        candidate.status === "legacy-verified") &&
      candidate.channel === "release",
  );
  return [...eligible].sort(
    (left, right) =>
      Number(Boolean(right.officialMarker)) -
        Number(Boolean(left.officialMarker)) ||
      compareVersionDescending(left.version, right.version) ||
      compareText(left.coordinate, right.coordinate) ||
      compareText(left.id, right.id),
  )[0];
}
