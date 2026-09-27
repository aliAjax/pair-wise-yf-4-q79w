import type { ContentField } from '@/utils/conflict'

export const FIELD_LABELS: Record<ContentField, string> = {
  routeName: '线路',
  segment: '区间',
  seatDirection: '座位方向',
  timestamp: '采样时间',
  weather: '天气',
  signText: '招牌文字',
  treeDensity: '树木密度',
  pedestrianStatus: '行人状态',
  note: '笔记',
}

/** 差异值在卡片里的显示形式：时间转可读格式，空字符串显示占位 */
export function formatFieldValue(field: ContentField, value: string): string {
  if (field === 'timestamp') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  return value === '' ? '（空）' : value
}
