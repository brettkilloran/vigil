export const HEARTGARDEN_NATIONS = [
  "Federated Pluvia",
  "Ashmark",
  "Saguna",
  "Arbili",
  "Oedenic Sovereignty",
] as const;

export type HeartgardenNation = (typeof HEARTGARDEN_NATIONS)[number];

export function isHeartgardenNation(
  value: string | null | undefined
): value is HeartgardenNation {
  if (!value) {
    return false;
  }
  return HEARTGARDEN_NATIONS.includes(value as HeartgardenNation);
}
