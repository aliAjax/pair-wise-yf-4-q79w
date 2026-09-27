import { create } from 'zustand'
import type { WindowScene, SceneFormData, PendingConflict, ImportSummary, RouteStats } from '@/types'
import {
  getAllScenes,
  saveScene as storageSaveScene,
  deleteScene as storageDeleteScene,
  writeAllScenes,
  getScenesByRoute,
  getAllRouteNames,
  getRandomScene,
  getPendingConflicts,
  writePendingConflicts,
  getRouteStats,
} from '@/services/storage'
import {
  encodeExchangeCode,
  decodeExchangeCode,
  buildImportPlan,
  type ExchangeCodeError,
} from '@/services/exchange'

export type ImportOutcome =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: ExchangeCodeError }

interface SceneState {
  scenes: WindowScene[]
  routeNames: string[]
  routeStats: RouteStats[]
  currentRouteScenes: WindowScene[]
  selectedRoute: string
  randomScene: WindowScene | null
  pendingConflicts: PendingConflict[]

  loadAll: () => void
  saveScene: (data: SceneFormData) => void
  deleteScene: (id: string) => void
  selectRoute: (routeName: string) => void
  refreshRandom: () => void

  generateExportCode: () => string
  importExchangeCode: (code: string) => ImportOutcome
  resolveConflict: (id: string, choice: 'local' | 'incoming') => void
}

/** 从存储重新读取正式记录、路线计数/最近时间与待处理区，并同步当前路线列表 */
function snapshot(selectedRoute: string) {
  const scenes = getAllScenes()
  return {
    scenes,
    routeNames: getAllRouteNames(),
    routeStats: getRouteStats(),
    currentRouteScenes: selectedRoute ? getScenesByRoute(selectedRoute) : [],
    pendingConflicts: getPendingConflicts(),
  }
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  routeNames: [],
  routeStats: [],
  currentRouteScenes: [],
  selectedRoute: '',
  randomScene: null,
  pendingConflicts: [],

  loadAll: () => {
    set(snapshot(get().selectedRoute))
  },

  saveScene: (data: SceneFormData) => {
    const scene: WindowScene = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
    storageSaveScene(scene)
    set(snapshot(get().selectedRoute))
  },

  deleteScene: (id: string) => {
    storageDeleteScene(id)
    // 本地版本被删除后，相关待处理项一并失效
    writePendingConflicts(getPendingConflicts().filter((p) => p.id !== id))
    set(snapshot(get().selectedRoute))
  },

  selectRoute: (routeName: string) => {
    const currentRouteScenes = routeName ? getScenesByRoute(routeName) : []
    set({ selectedRoute: routeName, currentRouteScenes })
  },

  refreshRandom: () => {
    const randomScene = getRandomScene()
    set({ randomScene })
  },

  generateExportCode: () => {
    return encodeExchangeCode(getAllScenes())
  },

  importExchangeCode: (code: string) => {
    const decoded = decodeExchangeCode(code)
    if (decoded.ok === true) {
      const state = get()
      const plan = buildImportPlan(
        getAllScenes(),
        getPendingConflicts(),
        decoded.scenes
      )

      if (plan.toAdd.length > 0) {
        writeAllScenes([...getAllScenes(), ...plan.toAdd])
      }

      if (plan.conflicts.length > 0 || plan.removedPendingIds.length > 0) {
        const removed = new Set(plan.removedPendingIds)
        const nextConflicts = new Map<string, PendingConflict>()
        // 保留本批未涉及、且本地版本仍存在的旧待处理项
        for (const p of getPendingConflicts()) {
          if (!removed.has(p.id)) nextConflicts.set(p.id, p)
        }
        // 同编号冲突以最新外来版本覆盖待处理项，绝不重复制造
        for (const c of plan.conflicts) {
          nextConflicts.set(c.id, c)
        }
        writePendingConflicts(Array.from(nextConflicts.values()))
      }

      set(snapshot(state.selectedRoute))
      return { ok: true as const, summary: plan.summary }
    }
    return { ok: false as const, error: decoded.error }
  },

  resolveConflict: (id: string, choice: 'local' | 'incoming') => {
    const pending = getPendingConflicts().filter((p) => p.id !== id)
    const conflict = get().pendingConflicts.find((p) => p.id === id)

    if (conflict && choice === 'incoming') {
      // 采用对方：用外来版本替换同编号本地版本
      const scenes = getAllScenes().map((s) => (s.id === id ? conflict.incoming : s))
      writeAllScenes(scenes)
    }
    // 保留本地：正式记录不动，仅移走待处理项

    writePendingConflicts(pending)
    // 处理后路线计数与最近采样时间立即重算
    set(snapshot(get().selectedRoute))
  },
}))
