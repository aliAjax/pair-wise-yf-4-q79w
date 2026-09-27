import { create } from 'zustand'
import type { WindowScene, SceneFormData, PendingConflict, RouteStat } from '@/types'
import {
  getAllScenes,
  saveScene as storageSaveScene,
  deleteScene as storageDeleteScene,
  getScenesByRoute,
  getAllRouteNames,
  getRandomScene,
  getAllPending,
  upsertPending,
  removePending,
  addScenes,
  replaceScene,
  getRouteStats,
} from '@/services/storage'
import { decodeExchangeCode } from '@/services/exchange'
import { classifyImport } from '@/utils/conflict'

export interface ImportOutcome {
  added: number
  duplicated: number
  conflicted: number
  updated: number
  invalid: number
  fromDevice: string
  total: number
}

interface SceneState {
  scenes: WindowScene[]
  routeNames: string[]
  currentRouteScenes: WindowScene[]
  selectedRoute: string
  randomScene: WindowScene | null
  pending: PendingConflict[]
  routeStats: RouteStat[]

  loadAll: () => void
  saveScene: (data: SceneFormData) => void
  deleteScene: (id: string) => void
  selectRoute: (routeName: string) => void
  refreshRandom: () => void
  importExchangeCode: (code: string) => ImportOutcome | { error: string }
  /** 保留本地版本：仅移除待处理项，主记录不动 */
  resolveKeepLocal: (id: string) => void
  /** 采用对方版本：替换主记录并移除待处理项 */
  resolveAdoptIncoming: (id: string) => void
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  routeNames: [],
  currentRouteScenes: [],
  selectedRoute: '',
  randomScene: null,
  pending: [],
  routeStats: [],

  loadAll: () => {
    const scenes = getAllScenes()
    const routeNames = getAllRouteNames()
    const pending = getAllPending()
    const routeStats = getRouteStats()
    set((state) => ({
      scenes,
      routeNames,
      pending,
      routeStats,
      currentRouteScenes: state.selectedRoute
        ? getScenesByRoute(state.selectedRoute)
        : state.currentRouteScenes,
    }))
  },

  saveScene: (data: SceneFormData) => {
    const scene: WindowScene = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
    storageSaveScene(scene)
    get().loadAll()
  },

  deleteScene: (id: string) => {
    storageDeleteScene(id)
    get().loadAll()
  },

  selectRoute: (routeName: string) => {
    const currentRouteScenes = routeName ? getScenesByRoute(routeName) : []
    set({ selectedRoute: routeName, currentRouteScenes })
  },

  refreshRandom: () => {
    const randomScene = getRandomScene()
    set({ randomScene })
  },

  importExchangeCode: (code) => {
    const decoded = decodeExchangeCode(code)
    if (!decoded.ok || !decoded.payload) {
      return { error: decoded.error ?? '交换码解析失败' }
    }

    const { scenes: incoming, device } = decoded.payload
    const classification = classifyImport(
      incoming,
      getAllScenes(),
      getAllPending(),
      device,
    )

    addScenes(classification.newScenes)
    for (const conflict of classification.conflicts) {
      upsertPending(conflict)
    }

    get().loadAll()

    return {
      added: classification.newScenes.length,
      duplicated: classification.duplicatedScenes.length,
      conflicted: classification.conflicts.length,
      updated: classification.updatedConflictIds.length,
      invalid: decoded.invalidCount ?? 0,
      fromDevice: device,
      total: incoming.length,
    }
  },

  resolveKeepLocal: (id) => {
    removePending(id)
    // 主记录保持不变，但计数与最近采样时间仍统一重算
    get().loadAll()
  },

  resolveAdoptIncoming: (id) => {
    const conflict = get().pending.find((p) => p.id === id)
    if (!conflict) return
    replaceScene(conflict.incoming)
    removePending(id)
    get().loadAll()
  },
}))
