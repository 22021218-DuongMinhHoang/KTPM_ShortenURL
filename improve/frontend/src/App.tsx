import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Github, Zap } from "lucide-react";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Stats from "./pages/Stats";

function App() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen font-sans text-slate-100 selection:bg-orange-900 selection:text-orange-100">
      {/* Dark Glassmorphic Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/60 supports-[backdrop-filter]:bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="p-2 bg-orange-600 rounded-lg text-white shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white">
                  Short<span className="text-orange-500">URL</span>
                </span>
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800/50">
                <Link
                  to="/"
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/")
                      ? "bg-slate-800 text-orange-500 shadow-sm ring-1 ring-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  Create
                </Link>
                <Link
                  to="/dashboard"
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/dashboard")
                      ? "bg-slate-800 text-orange-500 shadow-sm ring-1 ring-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stats/:id" element={<Stats />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
