import React, { useState, useRef, useEffect } from "react";
import type { NavigationTab } from "../types";
import {
  Mail,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  demoMode,
  onToggleDemoMode,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close profile popover on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileOpen]);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText("animesh.bhanarkar@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode; badge?: string }> = [
    {
      id: "overview",
      label: "Overview",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: "incidents",
      label: "Incidents",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: "patterns",
      label: "Pattern Explorer",
      badge: "NEW",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: "search",
      label: "Search",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: "timeline",
      label: "Timeline Explorer",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "evidence",
      label: "Evidence",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "investigations",
      label: "AI Investigations",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
    {
      id: "reports",
      label: "Reports",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800/80 justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab("incidents")}>
            {/* Dot-matrix Brand Glyph */}
            <div className="w-7 h-7 grid grid-cols-3 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
              <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              PAYTRACE
            </span>
          </div>

          {/* Close button for mobile */}
          <button
            type="button"
            className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={onCloseMobile}
          >
            ✕
          </button>
        </div>

        {/* Navigation Link List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span className={isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3 relative">
          {/* Demo Mode Toggle Card */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🎮</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Demo Mode
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Replay real incident flows
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={onToggleDemoMode}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Developer Profile Card */}
          <div
            ref={profileRef}
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className={`flex items-center gap-3 p-2 rounded-lg transition cursor-pointer border ${
              isProfileOpen
                ? "bg-slate-100 dark:bg-slate-800 border-indigo-300 dark:border-indigo-800/80 shadow-2xs"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent"
            }`}
            title="View Developer Contact & Profiles"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Developed by
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                Animesh Bhanarkar
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {isProfileOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>

          {/* Developer Profile Popover */}
          {isProfileOpen && (
            <div
              ref={popoverRef}
              className="absolute left-3 right-3 bottom-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Profile Popover Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    A
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 leading-tight">Developed by</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      Animesh Bhanarkar
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 text-xs cursor-pointer"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Contact Links */}
              <div className="space-y-1.5 text-xs">
                {/* Email */}
                <a
                  href="mailto:animesh.bhanarkar@gmail.com"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium">Email</div>
                      <div className="font-mono text-[11px] truncate text-slate-800 dark:text-slate-200">
                        animesh.bhanarkar@gmail.com
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
                    title="Copy email address"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://www.linkedin.com/in/animesh-bhanarkar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium">LinkedIn</div>
                      <div className="text-[11px] font-semibold truncate text-slate-800 dark:text-slate-200">
                        Animesh Bhanarkar | LinkedIn
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" />
                </a>

                {/* GitHub */}
                <a
                  href="https://github.com/animesh-bhanarkar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium">GitHub</div>
                      <div className="text-[11px] font-mono truncate text-slate-800 dark:text-slate-200">
                        github.com/animesh-bhanarkar
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white shrink-0" />
                </a>
              </div>

              {/* Popover Footer Note */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-center text-slate-500 dark:text-slate-400">
                ❤️ Thanks for checking out PayTrace!
              </div>
            </div>
          )}

          {/* Subtle Copyright */}
          <div className="text-[10px] text-slate-400 px-2">
            © 2026 PayTrace
          </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
