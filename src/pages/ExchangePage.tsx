import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Copy,
  Check,
  Download,
  Upload,
  ClipboardPaste,
  AlertTriangle,
  Clock,
  Route as RouteIcon,
  Inbox,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { useSceneStore, type ImportOutcome } from '@/store/useSceneStore'
import { encodeScenes } from '@/services/exchange'
import { diffFields } from '@/utils/conflict'
import { FIELD_LABELS, formatFieldValue } from '@/utils/fieldLabels'
import { formatTimestamp } from '@/utils/sceneHelpers'
import type { PendingConflict } from '@/types'

type ImportResult = ImportOutcome | { error: string }

function isErrorResult(r: ImportResult): r is { error: string } {
  return 'error' in r
}

export default function ExchangePage() {
  const {
    scenes,
    pending,
    routeStats,
    loadAll,
    importExchangeCode,
    resolveKeepLocal,
    resolveAdoptIncoming,
  } = useSceneStore()

  const [exchangeCode, setExchangeCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const importInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const statsSummary = useMemo(
    () => ({ routes: routeStats.length, scenes: scenes.length }),
    [routeStats, scenes],
  )

  const handleGenerate = () => {
    const sorted = [...scenes].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    setExchangeCode(encodeScenes(sorted))
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!exchangeCode) return
    try {
      await navigator.clipboard.writeText(exchangeCode)
    } catch {
      // 部分手机浏览器不支持 Clipboard API，退回手动选区
      const ta = document.createElement('textarea')
      ta.value = exchangeCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setImportText(text)
      setImportResult(null)
    } catch {
      importInputRef.current?.focus()
    }
  }

  const handleImport = () => {
    if (!importText.trim()) {
      setImportResult({ error: '请先粘贴交换码' })
      return
    }
    const result = importExchangeCode(importText)
    setImportResult(result)
    if (!isErrorResult(result)) {
      setImportText('')
    }
  }

  return (
    <div className="min-h-screen bg-teal-950 pb-24">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dusk-400/20 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-dusk-400" />
          </div>
          <div>
            <h1 className="text-mist-100 font-serif text-2xl leading-tight">本机交换区</h1>
            <p className="text-mist-500 text-xs">生成交换码给同事，或粘贴对方的码导入，记录只存在浏览器里</p>
          </div>
          {pending.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 text-xs text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              {pending.length} 项待处理
            </span>
          )}
        </div>

        {/* 生成交换码 */}
        <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5 space-y-3">
          <h2 className="font-serif text-lg text-dusk-400 flex items-center gap-2">
            <Upload className="w-4 h-4" />导出我的窗景
          </h2>
          <p className="text-xs text-mist-400 leading-relaxed">
            当前本机共 <span className="text-mist-200">{statsSummary.scenes}</span> 条窗景、
            <span className="text-mist-200">{statsSummary.routes}</span> 条路线，
            打包成一段交换码，复制后发给同事。
          </p>
          {exchangeCode ? (
            <>
              <textarea
                readOnly
                value={exchangeCode}
                rows={4}
                className="w-full rounded-xl bg-teal-850 text-mist-300 text-[11px] leading-relaxed font-mono px-3 py-2 outline-none resize-none break-all"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 rounded-xl bg-dusk-400 text-teal-950 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制交换码'}
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2.5 rounded-xl border border-teal-700 text-mist-300 text-sm hover:bg-teal-800 transition"
                >
                  重新生成
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={scenes.length === 0}
              className="w-full py-2.5 rounded-xl bg-dusk-400 text-teal-950 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />生成交换码
            </button>
          )}
        </section>

        {/* 粘贴导入 */}
        <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5 space-y-3">
          <h2 className="font-serif text-lg text-dusk-400 flex items-center gap-2">
            <Download className="w-4 h-4 rotate-180" />导入对方窗景
          </h2>
          <div className="relative">
            <textarea
              ref={importInputRef}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              placeholder="把同事的交换码粘贴到这里…"
              className="w-full rounded-xl bg-teal-850 text-mist-100 text-[11px] leading-relaxed font-mono px-3 py-2 outline-none focus:ring-1 focus:ring-dusk-400 resize-none break-all placeholder:font-sans placeholder:text-xs placeholder:text-mist-500"
            />
            <button
              type="button"
              onClick={handlePaste}
              title="从剪贴板粘贴"
              className="absolute right-2 top-2 p-1.5 rounded-lg bg-teal-800/80 text-mist-300 hover:text-mist-100 transition"
            >
              <ClipboardPaste className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleImport}
            className="w-full py-2.5 rounded-xl border border-dusk-400/50 bg-dusk-400/10 text-dusk-300 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition hover:bg-dusk-400/20"
          >
            <Upload className="w-4 h-4" />解析并导入
          </button>

          {importResult && !isErrorResult(importResult) && (
            <div className="rounded-xl border border-dusk-400/30 bg-dusk-400/10 p-3 text-xs text-mist-200 space-y-1 animate-slide-down">
              <p className="flex items-center gap-1.5 text-dusk-300 font-medium">
                <Smartphone className="w-3.5 h-3.5" />
                来自设备 {importResult.fromDevice.slice(0, 8)} 的导入完成
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-mist-300">
                <span>新记录：{importResult.added} 条</span>
                <span>内容一致跳过：{importResult.duplicated} 条</span>
                <span className="text-amber-300">进入待处理：{importResult.conflicted} 条</span>
                <span>其中更新旧待处理：{importResult.updated} 条</span>
                {importResult.invalid > 0 && (
                  <span className="col-span-2 text-red-300">无法识别已忽略：{importResult.invalid} 条</span>
                )}
              </div>
              {importResult.conflicted > 0 && (
                <p className="text-amber-300/90 pt-1">同编号内容不同的记录没有覆盖本地版本，请在下方逐条处理。</p>
              )}
            </div>
          )}
          {importResult && isErrorResult(importResult) && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {importResult.error}
            </div>
          )}
        </section>

        {/* 待处理区 */}
        <section className="space-y-3">
          <h2 className="font-serif text-lg text-dusk-400 flex items-center gap-2 px-1">
            <Inbox className="w-4 h-4" />待处理冲突
            <span className="text-xs text-mist-500 font-sans">
              （{pending.length}）同编号两边内容不同，本地版本始终保留
            </span>
          </h2>

          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-teal-800 py-12 flex flex-col items-center gap-2 text-mist-500">
              <ShieldCheck className="w-8 h-8 opacity-40" />
              <p className="text-sm">没有待处理项，窗景都已各就各位</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onKeepLocal={() => resolveKeepLocal(conflict.id)}
                  onAdoptIncoming={() => resolveAdoptIncoming(conflict.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 路线计数 */}
        <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5 space-y-3">
          <h2 className="font-serif text-lg text-dusk-400 flex items-center gap-2">
            <RouteIcon className="w-4 h-4" />路线统计
            <span className="text-xs text-mist-500 font-sans">处理冲突后立即重算</span>
          </h2>
          {routeStats.length === 0 ? (
            <p className="text-sm text-mist-500">还没有任何窗景记录</p>
          ) : (
            <ul className="divide-y divide-teal-800/70">
              {routeStats.map((stat) => (
                <li key={stat.routeName} className="flex items-center gap-3 py-2.5">
                  <RouteIcon className="w-4 h-4 text-dusk-400/70 shrink-0" />
                  <span className="text-sm text-mist-100">{stat.routeName}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-mist-400">
                    {stat.count} 条
                  </span>
                  {stat.latestTimestamp && (
                    <span className="inline-flex items-center gap-1 text-xs text-mist-500 w-36 justify-end">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(stat.latestTimestamp)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ConflictCard({
  conflict,
  onKeepLocal,
  onAdoptIncoming,
}: {
  conflict: PendingConflict
  onKeepLocal: () => void
  onAdoptIncoming: () => void
}) {
  const changed = diffFields(conflict.local, conflict.incoming)

  return (
    <article className="rounded-2xl border border-amber-500/30 bg-teal-900/60 overflow-hidden animate-slide-up">
      <header className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-300" />
        <div className="text-sm">
          <span className="text-mist-100 font-medium">{conflict.local.routeName}</span>
          <span className="text-mist-500 mx-1.5">·</span>
          <span className="text-mist-300">{conflict.local.segment}</span>
        </div>
        <span className="ml-auto text-[10px] text-mist-500">
          来自 {conflict.fromDevice.slice(0, 8)}
        </span>
      </header>

      <div className="p-4 space-y-2">
        <p className="text-xs text-mist-500">
          {changed.length} 个字段不同：{changed.map((f) => FIELD_LABELS[f]).join('、')}
        </p>
        <div className="rounded-xl border border-teal-800 divide-y divide-teal-800/70 overflow-hidden">
          {changed.map((field) => (
            <div key={field} className="grid grid-cols-[72px_1fr_1fr] text-xs">
              <div className="px-2.5 py-2 bg-teal-850/60 text-mist-400 flex items-center">
                {FIELD_LABELS[field]}
              </div>
              <div className="px-2.5 py-2 text-mist-300 border-l border-teal-800/70">
                <span className="block text-[10px] text-mist-500 mb-0.5">本地</span>
                <span className="break-all">{formatFieldValue(field, conflict.local[field])}</span>
              </div>
              <div className="px-2.5 py-2 text-dusk-200 bg-dusk-400/5 border-l border-teal-800/70">
                <span className="block text-[10px] text-dusk-400/70 mb-0.5">对方</span>
                <span className="break-all">{formatFieldValue(field, conflict.incoming[field])}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onKeepLocal}
            className="flex-1 py-2.5 rounded-xl bg-teal-850 border border-teal-700 text-mist-200 text-sm font-medium hover:bg-teal-800 active:scale-[0.98] transition"
          >
            保留本地
          </button>
          <button
            onClick={onAdoptIncoming}
            className="flex-1 py-2.5 rounded-xl bg-dusk-400/90 text-teal-950 text-sm font-medium hover:bg-dusk-400 active:scale-[0.98] transition"
          >
            采用对方
          </button>
        </div>
      </div>
    </article>
  )
}
