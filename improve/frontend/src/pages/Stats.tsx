import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import {
  ArrowLeft,
  MousePointer2,
  Clock,
  Globe,
  Shield,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ClickLog {
  id: string;
  created_at: string;
  ip: string;
  ua: string;
  referrer: string;
}

interface StatsData {
  clicks: string;
  recent_clicks: ClickLog[];
}

export default function Stats() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR<StatsData>(
    `/api/stats/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-500">
        <AlertCircle className="h-10 w-10 mb-4" />
        <h3 className="text-lg font-bold text-white">Failed to load stats</h3>
        <p className="text-slate-400 mt-1">
          Could not retrieve data for ID: {id}
        </p>
        <Link
          to="/dashboard"
          className="mt-6 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/dashboard"
          className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-orange-500 hover:border-orange-500/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Report</h2>
          <p className="text-slate-400 flex items-center gap-2 text-sm mt-1">
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              /{id}
            </span>
          </p>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
            <MousePointer2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Clicks</p>
            <p className="text-3xl font-bold text-white">
              {parseInt(data?.clicks || "0").toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Last Activity</p>
            <p className="text-lg font-bold text-white">
              {data?.recent_clicks?.[0]
                ? new Date(data.recent_clicks[0].created_at).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  )
                : "N/A"}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Top Referrer</p>
            <p
              className="text-lg font-bold text-white truncate max-w-[150px]"
              title={data?.recent_clicks?.[0]?.referrer}
            >
              {data?.recent_clicks?.[0]?.referrer || "Direct"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/30">
          <h3 className="font-bold text-white">Recent Activity Log</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {data?.recent_clicks?.map((log, i) => (
            <div
              key={i}
              className="p-4 sm:px-6 hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-slate-800 rounded-lg text-slate-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{log.ip}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{log.ua}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">{log.referrer}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {(!data?.recent_clicks || data.recent_clicks.length === 0) && (
            <div className="p-12 text-center text-slate-500">
              No activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
