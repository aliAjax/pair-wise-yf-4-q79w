import type {
  WindowScene,
  PendingConflict,
  ImportSummary,
  Weather,
  TreeDensity,
  PedestrianStatus,
  SeatDirection,
} from '@/types'

/**
 * 交换码与冲突判定层
 * 只负责：交换码编解码、内容一致性比较、生成导入计划。
 * 不直接读写 localStorage，落库由数据层 (storage.ts) 完成。
 */

const CODE_PREFIX = 'BUSWSC1:'

const SEAT_DIRECTIONS: SeatDirection[] = ['左', '右']
const WEATHERS: Weather[] = ['晴', '多云', '阴', '小雨', '大雨', '雪', '雾']
const TREE_DENSITIES: TreeDensity[] = ['稀疏', '适中', '茂密']
const PEDESTRIAN_STATUSES: PedestrianStatus[] = ['稀少', '零星', '密集']

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

/** 校验一条记录字段是否齐全且取值合法 */
export function isValidScene(value: unknown): value is WindowScene {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    isString(s.id) && s.id.length > 0 &&
    isString(s.routeName) &&
    isString(s.segment) &&
    SEAT_DIRECTIONS.includes(s.seatDirection as SeatDirection) &&
    isString(s.timestamp) && !Number.isNaN(new Date(s.timestamp).getTime()) &&
    WEATHERS.includes(s.weather as Weather) &&
    isString(s.signText) &&
    TREE_DENSITIES.includes(s.treeDensity as TreeDensity) &&
    PEDESTRIAN_STATUSES.includes(s.pedestrianStatus as PedestrianStatus) &&
    isString(s.note)
  )
}

/* ---------------- 交换码编解码 ---------------- */

/** 分块 Unicode 安全编码，避免 btoa 处理多字节中文报错 */
function unicodeToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function unicodeFromBase64(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeExchangeCode(scenes: WindowScene[]): string {
  return CODE_PREFIX + unicodeToBase64(JSON.stringify(scenes))
}

export type ExchangeCodeError = 'EMPTY' | 'PREFIX' | 'CORRUPT'

export type DecodeResult =
  | { ok: true; scenes: WindowScene[] }
  | { ok: false; error: ExchangeCodeError }

export function decodeExchangeCode(code: string): DecodeResult {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, error: 'EMPTY' }
  if (!trimmed.startsWith(CODE_PREFIX)) return { ok: false, error: 'PREFIX' }
  try {
    const payload = unicodeFromBase64(trimmed.slice(CODE_PREFIX.length))
    const parsed: unknown = JSON.parse(payload)
    if (!Array.isArray(parsed)) return { ok: false, error: 'CORRUPT' }
    return { ok: true, scenes: parsed as WindowScene[] }
  } catch {
    return { ok: false, error: 'CORRUPT' }
  }
}

/* ---------------- 内容一致性 ---------------- */

const COMPARE_FIELDS: (keyof WindowScene)[] = [
  'routeName',
  'segment',
  'seatDirection',
  'timestamp',
  'weather',
  'signText',
  'treeDensity',
  'pedestrianStatus',
  'note',
]

/** 相同编号且内容完全一致才视为重复 */
export function isSameScene(a: WindowScene, b: WindowScene): boolean {
  return COMPARE_FIELDS.every((field) => a[field] === b[field])
}

/** 需要重点比对的三项：采样时间、天气、笔记 */
export const TRACKED_FIELDS = ['timestamp', 'weather', 'note'] as const

/** 返回两版本实际不同的字段，供待处理区高亮（三项核心差异一定包含在内） */
export function getDifferingFields(
  local: WindowScene,
  incoming: WindowScene
): (keyof WindowScene)[] {
  return COMPARE_FIELDS.filter((field) => local[field] !== incoming[field])
}

/* ---------------- 导入计划 ---------------- */

export interface ImportPlan {
  /** 本地没有的新记录，直接入库 */
  toAdd: WindowScene[]
  /** 同编号冲突，按编号去重后 upsert 进待处理区（id 即记录编号） */
  conflicts: PendingConflict[]
  /** 待处理区中本地版本已被删除、应当清掉的失效项 */
  removedPendingIds: string[]
  summary: ImportSummary
}

/**
 * 依据当前正式记录与待处理区，对一批外来记录生成导入计划：
 * - 编号相同、内容一致：跳过，不制造副本；
 * - 编号相同、内容不同（含采样时间/天气/笔记差异）：保留本地版本，
 *   外来版本进待处理区，绝不直接顶掉；
 * - 本地无此编号：作为新记录加入。
 */
export function buildImportPlan(
  localScenes: WindowScene[],
  existingPending: PendingConflict[],
  incomingScenes: unknown[]
): ImportPlan {
  const localById = new Map(localScenes.map((s) => [s.id, s]))
  const pendingById = new Map(existingPending.map((p) => [p.id, p]))
  const conflictMap = new Map<string, PendingConflict>()
  const toAdd: WindowScene[] = []
  const seenIncoming = new Set<string>()

  let skipped = 0
  let invalid = 0

  for (const raw of incomingScenes) {
    if (!isValidScene(raw)) {
      invalid += 1
      continue
    }
    // 同一份交换码内部出现重复编号时只处理一次
    if (seenIncoming.has(raw.id)) continue
    seenIncoming.add(raw.id)

    const local = localById.get(raw.id)
    if (local) {
      if (isSameScene(local, raw)) {
        skipped += 1
      } else {
        conflictMap.set(raw.id, {
          id: raw.id,
          local,
          incoming: raw,
          createdAt: pendingById.get(raw.id)?.createdAt ?? new Date().toISOString(),
        })
      }
    } else {
      toAdd.push(raw)
    }
  }

  // 本地版本已删除而遗留的待处理项，随导入一并清理
  const removedPendingIds = existingPending
    .filter((p) => !localById.has(p.id))
    .map((p) => p.id)

  return {
    toAdd,
    conflicts: Array.from(conflictMap.values()),
    removedPendingIds,
    summary: {
      added: toAdd.length,
      skipped,
      conflicted: conflictMap.size,
      invalid,
    },
  }
}
