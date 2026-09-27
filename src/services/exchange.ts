import type {
  WindowScene,
  SeatDirection,
  Weather,
  TreeDensity,
  PedestrianStatus,
} from '@/types'

/** 交换码前缀：BWS = Bus Window Scene，1 为格式版本 */
export const EXCHANGE_PREFIX = 'BWS1:'

const EXCHANGE_VERSION = 1
const DEVICE_KEY = 'bus_window_device_id'

export interface ExchangePayload {
  version: number
  device: string
  exportedAt: string
  scenes: WindowScene[]
}

export interface DecodeResult {
  ok: boolean
  payload?: ExchangePayload
  /** 解析阶段被丢弃的非法记录条数 */
  invalidCount?: number
  error?: string
}

// ---------- UTF-8 安全的 base64（中文笔记不会乱码） ----------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---------- 设备标识：仅用于在待处理项里标注「对方」 ----------

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

// ---------- 生成交换码 ----------

export function encodeScenes(scenes: WindowScene[]): string {
  const payload: ExchangePayload = {
    version: EXCHANGE_VERSION,
    device: getDeviceId(),
    exportedAt: new Date().toISOString(),
    scenes,
  }
  const json = JSON.stringify(payload)
  return EXCHANGE_PREFIX + bytesToBase64(new TextEncoder().encode(json))
}

// ---------- 解析交换码 ----------

const SEAT_DIRECTIONS: readonly SeatDirection[] = ['左', '右']
const WEATHERS: readonly Weather[] = ['晴', '多云', '阴', '小雨', '大雨', '雪', '雾']
const TREE_DENSITIES: readonly TreeDensity[] = ['稀疏', '适中', '茂密']
const PEDESTRIAN_STATUSES: readonly PedestrianStatus[] = ['稀少', '零星', '密集']

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return isString(v) && (allowed as readonly string[]).includes(v)
}

/** 单条记录结构校验，任何字段缺失或枚举非法都视为无效 */
export function isValidScene(v: unknown): v is WindowScene {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    isString(s.id) && s.id.length > 0 &&
    isString(s.routeName) && s.routeName.length > 0 &&
    isString(s.segment) &&
    oneOf(s.seatDirection, SEAT_DIRECTIONS) &&
    isString(s.timestamp) && !Number.isNaN(new Date(s.timestamp).getTime()) &&
    oneOf(s.weather, WEATHERS) &&
    isString(s.signText) &&
    oneOf(s.treeDensity, TREE_DENSITIES) &&
    oneOf(s.pedestrianStatus, PEDESTRIAN_STATUSES) &&
    isString(s.note)
  )
}

export function decodeExchangeCode(code: string): DecodeResult {
  const trimmed = code.trim()
  if (!trimmed.startsWith(EXCHANGE_PREFIX)) {
    return { ok: false, error: '交换码格式不正确：缺少前缀 BWS1' }
  }

  let parsed: unknown
  try {
    const json = new TextDecoder().decode(base64ToBytes(trimmed.slice(EXCHANGE_PREFIX.length)))
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: '交换码已损坏，无法解码' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: '交换码内容无效' }
  }
  const p = parsed as Record<string, unknown>
  if (p.version !== EXCHANGE_VERSION) {
    return { ok: false, error: `不支持的交换码版本：${String(p.version)}` }
  }
  if (!Array.isArray(p.scenes)) {
    return { ok: false, error: '交换码中没有记录数据' }
  }

  const valid = p.scenes.filter(isValidScene)
  // 同编号重复时只保留第一条，避免码内自身冲突
  const seen = new Set<string>()
  const scenes = valid.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  return {
    ok: true,
    invalidCount: p.scenes.length - scenes.length,
    payload: {
      version: EXCHANGE_VERSION,
      device: isString(p.device) ? p.device : '未知设备',
      exportedAt: isString(p.exportedAt) ? p.exportedAt : '',
      scenes,
    },
  }
}
