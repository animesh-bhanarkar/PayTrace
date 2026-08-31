import { useState, useEffect } from 'react'

interface HealthResponse {
  status: string
  service: string
}

export default function App() {
  const [backendHealth, setBackendHealth] = useState<string>('checking...')

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        setBackendHealth(`${data.service} (${data.status})`)
      })
      .catch(() => {
        setBackendHealth('Backend offline / not connected')
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            PT
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              PayTrace
            </h1>
            <p className="text-xs text-slate-400">Payment Incident Investigation Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Day 1: Initial Skeleton
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 mb-6 shadow-sm">
          <span className="text-cyan-400 font-semibold">FACTS FIRST</span>
          <span className="text-slate-600">→</span>
          <span className="text-indigo-400 font-semibold">AI SECOND</span>
          <span className="text-slate-600">→</span>
          <span className="text-emerald-400 font-semibold">VERIFICATION ALWAYS</span>
        </div>

        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white max-w-2xl mb-4">
          Autonomous Payment Incident Investigation
        </h2>

        <p className="text-slate-400 max-w-xl text-base sm:text-lg mb-8 leading-relaxed">
          PayTrace reconstructs ground truth from raw payment telemetry, isolates anomalies, and provides verifiable root-cause attribution.
        </p>

        {/* Status Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl text-left">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
            <div className="text-xs text-slate-400 font-medium mb-1">Frontend</div>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              React + TypeScript + Tailwind
            </div>
            <p className="text-xs text-slate-500 mt-2">Vite dev server running</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
            <div className="text-xs text-slate-400 font-medium mb-1">Backend API</div>
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
              FastAPI Skeleton
            </div>
            <p className="text-xs text-slate-400 font-mono mt-2 truncate">Status: {backendHealth}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
            <div className="text-xs text-slate-400 font-medium mb-1">Architecture Mode</div>
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              Repository Initialized
            </div>
            <p className="text-xs text-slate-500 mt-2">Ready for Day 1 integrations</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/30 px-6 py-4 text-center text-xs text-slate-500">
        PayTrace &bull; Razorpay AI Buildathon 2026
      </footer>
    </div>
  )
}
