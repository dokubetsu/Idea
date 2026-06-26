"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api/client";
import { AdminMatter } from "@/entities/types";
import { Spinner, Button } from "@/shared/components/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS_DOT } from "@/shared/lib/constants";

export default function AdminMattersPage() {
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<string[]>([]);
  const limit = 10;

  // Build query string
  const queryParams = new URLSearchParams();
  if (status) queryParams.append("status", status);
  if (cursor) queryParams.append("cursor", cursor);
  queryParams.append("limit", limit.toString());

  const { data: matters = [], isLoading } = useQuery<AdminMatter[]>({
    queryKey: ["admin", "matters", status, cursor],
    queryFn: () => apiClient.get<AdminMatter[]>(`/admin/matters?${queryParams.toString()}`),
  });

  const handleNext = () => {
    if (matters.length > 0) {
      const lastItem = matters[matters.length - 1];
      setHistory((prev) => [...prev, cursor ?? "first"]);
      setCursor(lastItem.created_at);
    }
  };

  const handleBack = () => {
    const newHistory = [...history];
    const prevCursor = newHistory.pop();
    setHistory(newHistory);
    if (prevCursor === "first" || prevCursor === undefined) {
      setCursor(undefined);
    } else {
      setCursor(prevCursor);
    }
  };

  const hasNext = matters.length === limit;
  const hasPrev = history.length > 0;

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setCursor(undefined);
    setHistory([]);
  };

  return (
    <div className="animate-fade-in-up space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">All matters</p>
          <h1 className="mt-1 font-serif text-4xl font-bold">Platform matters.</h1>
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="min-h-10 rounded-xl border border-brand-gold/15 bg-base-100 px-3.5 text-sm outline-none focus:border-brand-gold"
        >
          <option value="">All statuses</option>
          {["draft", "intake", "assessment", "matching", "active", "resolved", "archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-8 w-8" />
        </div>
      ) : matters.length === 0 ? (
        <p className="py-16 text-center text-sm text-brand-blue-light/40">No matters found</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-brand-gold/12 bg-base-100">
            <table className="w-full text-sm">
              <thead className="border-b border-brand-gold/10 bg-base-200/50">
                <tr>
                  {["Title", "User", "Lawyer", "Category", "Status", "Created"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-blue-light/45"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-gold/8">
                {matters.map((m) => {
                  const statusStr = m.status || "";
                  return (
                    <tr key={m.id} className="hover:bg-base-200/30 transition-colors">
                      <td className="px-4 py-3 font-semibold max-w-[200px] truncate">{m.title || "—"}</td>
                      <td className="px-4 py-3 text-brand-blue-light/60">{m.up?.full_name || "—"}</td>
                      <td className="px-4 py-3 text-brand-blue-light/60">{m.lp?.full_name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-brand-blue-light/60">
                        {(m.category || "").replace("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              STATUS_DOT[statusStr] || "bg-base-300"
                            }`}
                          />
                          {statusStr.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-blue-light/50">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-brand-blue-light/50">
              Showing page {history.length + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBack}
                disabled={!hasPrev}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
