import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  Clock,
  CloudSun,
  FileText,
  MapPin,
  Armchair,
  Signpost,
  TreePine,
  Users,
  ShieldCheck,
  Inbox,
} from 'lucide-react'
import { useSceneStore, type ImportOutcome } from '@/store/useSceneStore'
import type { ExchangeCodeError } from '@/services/exchange'
import {
  formatTimestamp,
  getWeatherIcon,
  getTreeIcon,
  getPedestrianIcon,
} from '@/utils/sceneHelpers'
import { getDifferingFields } from '@/services/exchange'
import type { WindowScene } from '@/types'

const ERROR_TEXT: Record<ExchangeCodeError, string> = {
  EMPTY: '请先粘贴交换码',
  PREFIX: '交换码格式不对，应以 BUSWSC1: 开头',
  CORRUPT: '交换码已损坏或不是有效的窗景交换码',
}

function Field({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
        highlight ? 'bg-dusk-400/15 ring-1 ring-dusk-400/60' : ''
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${highlight ? 'text-dusk-400' : 'text-mist-500'}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <span className="mr-1 text-mist-500">{label}</span>
        <span className={highlight ? 'font-medium text-dusk-300' : 'text-mist-200'}>{value}</span>
      </div>
    </div>
  )
}

/** 单个版本卡片：本地 / 对方，差异字段（采样时间、天气、笔记等）高亮 */
function VersionCard({
  scene,
  differing,
  badge,
  badgeClass,
  action,
}: {
  scene: WindowScene
  differing: Set<string>
  badge: string
  badgeClass: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border border-teal-800 bg-teal-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
          {badge}
        </span>
        <span className="text-[11px] text-mist-500">{getTimeLabel(scene)}</span>
      </div>

      <div className="space-y-1.5">
        <Field
          icon={<Clock className="w-3.5 h-3.5" />}
          label="采样"
          value={formatTimestamp(scene.timestamp)}
          highlight={differing.has('timestamp')}
        />
        <Field
          icon={<CloudSun className="w-3.5 h-3.5" />}
          label="天气"
          value={<span className="inline-flex items-center gap-1">{getWeatherIcon(scene.weather)}{scene.weather}</span>}
          highlight={differing.has('weather')}
        />
        <Field
          icon={<FileText className="w-3.5 h-3.5" />}
          label="笔记"
          value={scene.note || '（无）'}
          highlight={differing.has('note')}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2.5 pt-1 text-[11px] text-mist-400">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />{scene.routeName} · {scene.segment}
          </span>
          <span className="inline-flex items-center gap-1">
            <Armchair className="w-3 h-3" />{scene.seatDirection}侧
          </span>
          {scene.signText && (
            <span className="inline-flex items-center gap-1">
              <Signpost className="w-3 h-3" />{scene.signText}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <TreePine className="w-3 h-3" />{getTreeIcon(scene.treeDensity)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" />{getPedestrianIcon(scene.pedestrianStatus)}
          </span>
        </div>
      </div>

      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

function getTimeLabel(scene: WindowScene) {
  return `${scene.routeName} · ${scene.segment}`
}

export default function ExchangePage() {
  const {
    routeStats,
    pendingConflicts,
    loadAll,
    generateExportCode,
    importExchangeCode,
    resolveConflict,
  } = useSceneStore()

  const [exportCode, setExportCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const totalCount = useMemo(
    () => routeStats.reduce((sum, r) => sum + r.count, 0),
    [routeStats]
  )

  const handleGenerate = () => {
    setExportCode(generateExportCode())
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!exportCode) return
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // 非安全上下文下退化为手动选择
      const el = document.getElementById('exchange-code-output') as HTMLTextAreaElement | null
      el?.select()
    }
  }

  const handleImport = () => {
    const result = importExchangeCode(importText)
    setOutcome(result)
    if (result.ok) setImportText('')
  }

  return (
    <div className="min-h-screen bg-teal-950 font-serif text-mist-100">
      <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <div className="mb-6 flex items-center gap-3">
          <ArrowLeftRight className="w-7 h-7 text-dusk-400" />
          <div>
            <h1 className="text-3xl font-bold tracking-wide text-dusk-400">本机交换区</h1>
            <p className="mt-0.5 text-xs text-mist-500">
              数据只存于浏览器 · 共 {totalCount} 条记录 · {pendingConflicts.length} 项待处理
            </p>
          </div>
        </div>

        {/* 导出交换码 */}
        <section className="mb-6 rounded-2xl border border-teal-800 bg-teal-900/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-mist-100">
            <Upload className="w-4 h-4 text-dusk-400" />
            生成交换码
          </h2>
          <p className="mb-3 text-xs leading-relaxed text-mist-400">
            把当前所有窗景打包成一段文字码，发给同事即可；不会覆盖对方任何记录。
          </p>
          {exportCode ? (
            <div className="space-y-2">
              <textarea
                id="exchange-code-output"
                readOnly
                value={exportCode}
                rows={4}
                className="w-full resize-none rounded-lg border border-teal-800 bg-teal-950/70 p-3 font-sans text-[11px] leading-relaxed text-mist-300 focus:border-dusk-400 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-dusk-400 py-2.5 text-sm font-medium text-teal-950 transition active:scale-[0.98]"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '已复制' : '复制交换码'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dusk-400/40 bg-dusk-400/10 py-2.5 text-sm text-dusk-300 transition hover:bg-dusk-400/20 active:scale-[0.98]"
            >
              <Upload className="w-4 h-4" />
              打包当前 {totalCount} 条记录
            </button>
          )}
        </section>

        {/* 导入交换码 */}
        <section className="mb-6 rounded-2xl border border-teal-800 bg-teal-900/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-mist-100">
            <Download className="w-4 h-4 text-dusk-400" />
            粘贴导入
          </h2>
          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              setOutcome(null)
            }}
            rows={4}
            placeholder="粘贴另一台设备生成的 BUSWSC1: 交换码…"
            className="w-full resize-none rounded-lg border border-teal-800 bg-teal-950/70 p-3 font-sans text-[11px] leading-relaxed text-mist-100 placeholder:text-mist-500 focus:border-dusk-400 focus:outline-none"
          />
          <button
            onClick={handleImport}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-dusk-400 py-2.5 text-sm font-medium text-teal-950 transition active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            导入
          </button>

          {outcome &&
            (outcome.ok === true ? (
              <div className="mt-3 space-y-1 rounded-lg border border-teal-800 bg-teal-950/50 p-3 text-xs text-mist-300">
                <p className="flex items-center gap-1.5 text-mist-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-dusk-400" />
                  导入完成
                </p>
                <p>· 新增 {outcome.summary.added} 条新窗景</p>
                <p>· {outcome.summary.conflicted} 条与本地版本有分歧，已放入待处理区</p>
                <p className="text-mist-500">
                  · 内容一致跳过 {outcome.summary.skipped} 条
                  {outcome.summary.invalid > 0 ? ` · 无法识别 ${outcome.summary.invalid} 条` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                {ERROR_TEXT[outcome.error]}
              </p>
            ))}
        </section>

        {/* 待处理区 */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-mist-100">
              <Inbox className="w-4 h-4 text-dusk-400" />
              待处理区
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                pendingConflicts.length > 0
                  ? 'bg-dusk-400/20 text-dusk-300'
                  : 'bg-teal-900 text-mist-500'
              }`}
            >
              {pendingConflicts.length} 项
            </span>
          </div>

          {pendingConflicts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-teal-800 py-10 text-center text-sm text-mist-500">
              没有待处理的分歧，所有窗景都已对齐
            </div>
          ) : (
            <div className="space-y-4">
              {pendingConflicts.map((p) => {
                const differing = new Set(getDifferingFields(p.local, p.incoming))
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-dusk-400/25 bg-dusk-400/5 p-3"
                  >
                    <p className="mb-2.5 flex items-center gap-1.5 px-1 text-xs text-dusk-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      同一记录编号，两版本在
                      {differing.has('timestamp') && '采样时间、'}
                      {differing.has('weather') && '天气、'}
                      {differing.has('note') && '笔记、'}
                      上不同，请选择保留哪一版
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <VersionCard
                        scene={p.local}
                        differing={differing}
                        badge="本地版本"
                        badgeClass="bg-teal-800 text-mist-200"
                        action={
                          <button
                            onClick={() => resolveConflict(p.id, 'local')}
                            className="w-full rounded-lg border border-teal-700 bg-teal-800/60 py-2 text-xs font-medium text-mist-100 transition hover:bg-teal-800 active:scale-[0.98]"
                          >
                            保留本地
                          </button>
                        }
                      />
                      <VersionCard
                        scene={p.incoming}
                        differing={differing}
                        badge="对方版本"
                        badgeClass="bg-dusk-400/20 text-dusk-300"
                        action={
                          <button
                            onClick={() => resolveConflict(p.id, 'incoming')}
                            className="w-full rounded-lg bg-dusk-400 py-2 text-xs font-medium text-teal-950 transition hover:bg-dusk-300 active:scale-[0.98]"
                          >
                            采用对方
                          </button>
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 路线计数与最近采样时间 */}
        <section className="rounded-2xl border border-teal-800 bg-teal-900/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-mist-100">
            <Clock className="w-4 h-4 text-dusk-400" />
            路线统计
          </h2>
          {routeStats.length === 0 ? (
            <p className="py-4 text-center text-xs text-mist-500">暂无记录</p>
          ) : (
            <ul className="divide-y divide-teal-800/70">
              {routeStats.map((r) => (
                <li key={r.routeName} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-mist-200">
                    <MapPin className="w-3.5 h-3.5 text-dusk-400" />
                    {r.routeName}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-mist-400">
                    <span className="rounded-full bg-teal-800/80 px-2 py-0.5 text-mist-200">
                      {r.count} 条
                    </span>
                    <Clock className="w-3 h-3 text-mist-500" />
                    {r.latestTimestamp ? formatTimestamp(r.latestTimestamp) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
