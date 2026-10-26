export const LONG_TEXT_LIMITS = {
  brand_material: { warning: 2000, max: 3000 },
  core_product: { warning: 2000, max: 3000 },
  required_info: { warning: 2000, max: 3000 },
  prohibited_info: { warning: 2000, max: 3000 },
  additional_req: { warning: 2000, max: 3000 },
} as const;

export type LongTextField = keyof typeof LONG_TEXT_LIMITS;
