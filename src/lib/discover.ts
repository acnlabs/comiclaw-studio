/** 库里专栏系列的分类值。旧行是「漫记」;发现页对外叫「专栏」 */
export const COLUMN_SERIES_CATEGORY = "漫记";
export const DISCOVER_ALL_CAT = "全部";
export const DISCOVER_COLUMN_CAT = "专栏";
export const DISCOVER_CATEGORIES = [
  DISCOVER_ALL_CAT,
  "漫剧",
  DISCOVER_COLUMN_CAT,
] as const;

export function isDiscoverColumnCategory(category: string | null | undefined): boolean {
  return category === DISCOVER_COLUMN_CAT || category === COLUMN_SERIES_CATEGORY;
}

/** 发现卡/播放页的数量文案:专栏是记,漫剧是集 */
export function seriesCountKey(
  category: string | null | undefined,
): "column.issues" | "common.episodes" {
  return isDiscoverColumnCategory(category) ? "column.issues" : "common.episodes";
}

export function storedCategoriesForDiscover(cat: string): string[] | null {
  if (cat === DISCOVER_ALL_CAT) return null;
  if (cat === DISCOVER_COLUMN_CAT || cat === COLUMN_SERIES_CATEGORY) {
    return [DISCOVER_COLUMN_CAT, COLUMN_SERIES_CATEGORY];
  }
  return [cat];
}
