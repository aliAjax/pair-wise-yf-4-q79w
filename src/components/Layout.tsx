import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PenLine, Clock, Lightbulb, Bus, ArrowLeftRight } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'

const navItems = [
  { to: '/', icon: PenLine, label: '记录' },
  { to: '/timeline', icon: Clock, label: '时间线' },
  { to: '/inspire', icon: Lightbulb, label: '灵感' },
  { to: '/exchange', icon: ArrowLeftRight, label: '交换' },
]

export default function Layout() {
  const pendingCount = useSceneStore((s) => s.pendingConflicts.length)
  const loadAll = useSceneStore((s) => s.loadAll)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return (
    <div className="min-h-screen bg-teal-950 flex">
      <aside className="hidden md:flex flex-col w-64 bg-teal-950 border-r border-teal-850/60 p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-dusk-400/20 flex items-center justify-center">
            <Bus className="w-5 h-5 text-dusk-400" />
          </div>
          <div>
            <h1 className="font-serif text-mist-100 text-lg font-semibold leading-tight">窗景采样器</h1>
            <p className="text-mist-500 text-xs">公交车窗的观察笔记</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-dusk-400/15 text-dusk-300'
                    : 'text-mist-400 hover:text-mist-200 hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.to === '/exchange' && pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-dusk-400 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-teal-950">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-teal-850/60">
          <p className="text-mist-500 text-xs leading-relaxed">
            记录车窗外转瞬即逝的<br />城市片段
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-teal-950/95 backdrop-blur-md border-t border-teal-850/60">
          <nav className="flex justify-around py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs transition-all duration-200 ${
                    isActive ? 'text-dusk-400' : 'text-mist-500'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.to === '/exchange' && pendingCount > 0 && (
                  <span className="absolute right-1.5 top-1 min-w-4 h-4 rounded-full bg-dusk-400 px-1 text-[10px] font-semibold leading-4 text-teal-950">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
