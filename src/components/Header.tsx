"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, PlusCircle, LayoutDashboard, Sparkles } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";

export function Header() {
  const pathname = usePathname();
  const { data: health, error } = useSWR("backend-health", () => api.getHealth(), {
    refreshInterval: 10000,
    shouldRetryOnError: true,
  });

  const isOnline = !!health && !error;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-1.5">
                Video Engine <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60">Studio</span>
              </span>
              <span className="text-xs text-slate-400">Autonomous Video Pipeline</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/" || pathname.startsWith("/jobs/") && !pathname.includes("/new")
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/jobs/new"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/jobs/new"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sparkles className="h-4 w-4 text-blue-400" />
              Generate Video
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-slate-900 border border-slate-800">
            <div
              className={`h-2 w-2 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-400">
              API: {isOnline ? "Online" : "Connecting..."}
            </span>
          </div>

          <Link
            href="/jobs/new"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-sm shadow-blue-500/30 active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New Video</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
