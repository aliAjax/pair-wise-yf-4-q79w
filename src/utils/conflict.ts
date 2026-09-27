import type { WindowScene, PendingConflict } from '@/types'

/** 参与「内容一致」判定的字段：编号之外的全部采样内容 */
const CONTENT_FIELDS = [
  'routeName',
  'segment',
  'seatDirection',
  'timestamp',
  'weather',
  'signText',
  'treeDensity',
  'pedestrianStatus',
  'note',
] as const satisfies readonly (keyof WindowScene)[]

export type ContentField = (typeof CONTENT_FIELDS)[number]

/**
 * 同一编号下两份内容是否一致。
 * 逐字段比较，不依赖 JSON 序列化的键顺序。
 */
export function isSameContent(a: WindowScene, b: WindowScene): boolean {
  return CONTENT_FIELDS.every((field) => a[field] === b[field])
}

/** 列出两份记录之间存在差异的内容字段，供页面高亮 */
export function diffFields(local: WindowScene, incoming: WindowScene): ContentField[] {
  return CONTENT_FIELDS.filter((field) => local[field] !== incoming[field])
}

export interface ImportClassification {
  /** 本机没有同编号记录，需要直接新增的 */
  newScenes: WindowScene[]
  /** 编号相同且内容一致，跳过不重复制造副本的 */
  duplicatedScenes: WindowScene[]
  /** 同编号但内容不同，需要进入待处理区的 */
  conflicts: PendingConflict[]
  /** 同编号的待处理项已存在，更新对方版本即可（不新增待处理项） */
  updatedConflictIds: string[]
}

/**
 * 把交换码里解出的记录与本机现状比对分类。纯函数，不读写存储。
 *
 * @param incoming 交换码中解析出的记录
 * @param existing 本机现有记录
 * @param existingPending 本机待处理区现状
 * @param fromDevice 来源设备名
 */
export function classifyImport(
  incoming: WindowScene[],
  existing: WindowScene[],
  existingPending: PendingConflict[],
  fromDevice: string,
): ImportClassification {
  const existingById = new Map(existing.map((s) => [s.id, s]))
  const pendingById = new Map(existingPending.map((p) => [p.id, p]))
  const now = new Date().toISOString()

  const result: ImportClassification = {
    newScenes: [],
    duplicatedScenes: [],
    conflicts: [],
    updatedConflictIds: [],
  }

  for (const scene of incoming) {
    const pending = pendingById.get(scene.id)
    const local = existingById.get(scene.id)
    if (local) {
      // 同一编号两边都有：内容一致则跳过，不一致则不能顶掉本地版本
      if (isSameContent(local, scene)) {
        result.duplicatedScenes.push(scene)
      } else {
        result.conflicts.push({
          id: scene.id,
          local,
          incoming: scene,
          importedAt: now,
          fromDevice,
        })
        if (pending) result.updatedConflictIds.push(scene.id)
      }
      continue
    }

    // 本机主记录里没有：可能是全新记录，也可能本地版本已被删除但待处理项还在
    if (pending) {
      result.conflicts.push({
        id: pending.id,
        local: pending.local,
        incoming: scene,
        importedAt: now,
        fromDevice,
      })
      result.updatedConflictIds.push(scene.id)
    } else {
      result.newScenes.push(scene)
    }
  }

  return result
}
