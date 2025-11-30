import { useState } from "react";
import {
  Link as LinkIcon,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    originalUrl: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to shorten URL");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const shortUrl = result ? `${window.location.origin}/short/${result.id}` : "";

  const copyToClipboard = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center pt-10 pb-20">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wide mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Sparkles className="w-3 h-3" />
        <span>New Generation Shortener</span>
      </div>

      {/* Hero Text */}
      <div className="text-center max-w-3xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          Shorten links with <br />
          <span className="text-orange-500">extreme speed</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          The world's fastest URL shortener, powered by ScyllaDB and Bun.
          Experience zero-latency redirects and real-time analytics.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/50 border border-slate-800 p-2 sm:p-3">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-slate-300 mb-2 ml-1"
                >
                  Paste your long URL
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                  </div>
                  <input
                    type="url"
                    id="url"
                    required
                    className="block w-full pl-11 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                    placeholder="https://super-long-url.com/very/complicated/path..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg shadow-orange-900/20 text-base font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-orange-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Shortening...
                  </>
                ) : (
                  <>
                    Shorten URL Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                <div className="p-1 bg-red-900/20 rounded-full shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold block mb-0.5">Error</span>
                  {error}
                </div>
              </div>
            )}

            {result && (
              <div className="mt-8 pt-8 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-orange-950/10 rounded-2xl p-6 border border-orange-500/10">
                  <span className="block text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">
                    Success! Your Short Link
                  </span>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-sm">
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 text-lg sm:text-xl font-bold text-white hover:text-orange-500 transition-colors truncate w-full"
                    >
                      {shortUrl}
                    </a>
                    <button
                      onClick={copyToClipboard}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        copied
                          ? "bg-green-600 text-white shadow-md shadow-green-900/20"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 px-1">
                    <span className="font-medium text-slate-400">
                      Original:
                    </span>
                    <span className="truncate max-w-md">
                      {result.originalUrl}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-20 max-w-4xl w-full px-4">
        {[
          {
            title: "Lightning Fast",
            desc: "Powered by Bun & Elysia",
            icon: "⚡",
          },
          {
            title: "Secure & Scalable",
            desc: "ScyllaDB Architecture",
            icon: "🛡️",
          },
          { title: "Real-time Stats", desc: "Instant Analytics", icon: "📊" },
        ].map((feature, i) => (
          <div
            key={i}
            className="text-center p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 hover:bg-slate-800/60 transition-colors"
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="font-bold text-white mb-1">{feature.title}</h3>
            <p className="text-sm text-slate-400">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
