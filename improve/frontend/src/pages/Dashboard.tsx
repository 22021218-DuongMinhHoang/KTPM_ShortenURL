import { useState } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  BarChart2,
  Calendar,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Globe,
  MousePointer2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LinkData {
  id: string;
  url: string;
  created_at: string;
  clicks: string;
}

interface ApiResponse {
  links: LinkData[];
  hasMore: boolean;
}

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const apiUrl = `/api/links?page=${page}&limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    apiUrl,
    fetcher
  );

  const handleNext = () => {
    if (data?.hasMore) setPage((p) => p + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-slate-800 animate-pulse"></div>
          <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-4 text-slate-400 font-medium">Loading your links...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-500">
        <div className="p-4 bg-red-950/30 rounded-full mb-4 border border-red-900/50">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">
          Failed to load links
        </h3>
        <p className="text-slate-400">
          Please check your connection and try again.
        </p>
        <button
          onClick={() => mutate()}
          className="mt-6 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Dashboard
          </h2>
          <p className="text-slate-400 mt-1">
            Manage and track your shortened links.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => mutate()}
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-orange-500 hover:border-orange-500/30 hover:shadow-sm transition-all"
            title="Refresh List"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium text-slate-300 shadow-sm">
            Page <span className="text-orange-500 font-bold">{page}</span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-900/50 rounded-2xl shadow-xl shadow-black/20 border border-slate-800 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr className="bg-slate-950/50">
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Link Details
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Performance
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900">
              {data?.links?.map((link) => (
                <tr
                  key={link.id}
                  className="group hover:bg-slate-800/50 transition-colors duration-150"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-slate-800 rounded-xl text-orange-500 shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {window.location.origin}/short/{link.id}
                          </span>
                        </div>
                        <div
                          className="text-sm text-slate-500 truncate max-w-[200px] sm:max-w-xs mt-0.5"
                          title={link.url}
                        >
                          {link.url}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-950/30 text-emerald-400 text-xs font-bold border border-emerald-900/50 flex items-center gap-1.5">
                        <MousePointer2 className="w-3 h-3" />
                        {parseInt(link.clicks).toLocaleString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-slate-500">
                      <Calendar className="h-4 w-4 mr-2 text-slate-600" />
                      {new Date(link.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <a
                        href={`/short/${link.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                        title="Visit Link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Link
                        to={`/stats/${link.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-400 bg-orange-950/30 hover:bg-orange-900/50 border border-orange-900/30 rounded-lg transition-colors"
                      >
                        <BarChart2 className="h-4 w-4" />
                        Analytics
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.links?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-slate-800 rounded-full mb-4">
                        <Globe className="h-8 w-8 text-slate-600" />
                      </div>
                      <h3 className="text-lg font-medium text-white">
                        No links created yet
                      </h3>
                      <p className="text-slate-500 mt-1 mb-6">
                        Create your first shortened link to get started.
                      </p>
                      <Link
                        to="/"
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                      >
                        Create Link
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={page <= 1}
            className="flex items-center px-4 py-2.5 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={!data?.hasMore}
            className="flex items-center px-4 py-2.5 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
