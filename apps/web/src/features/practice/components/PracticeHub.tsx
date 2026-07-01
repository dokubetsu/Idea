import { useState } from "react";
import Link from "next/link";
import { Award, Compass, Search } from "lucide-react";
import { useScenarios } from "../hooks/usePractice";
import { ScenarioCard } from "./ScenarioCard";
import { Button, Select } from "@/shared/components/ui";

export function PracticeHub({ role }: { role: "user" | "lawyer" }) {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const domain = domainFilter === "all" ? undefined : domainFilter;
  const difficulty = difficultyFilter === "all" ? undefined : difficultyFilter;

  const { data, isLoading } = useScenarios({
    domain,
    difficulty,
  });

  // Filter local results by search query
  const scenarios = data?.scenarios ?? [];
  const filteredScenarios = scenarios.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const domains = ["all", "Cheque Bounce", "Consumer Protection", "RERA"];
  const difficulties = ["all", "beginner", "intermediate", "advanced"];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Interactive Court Simulator
          </p>
          <h1 className="mt-1 font-serif text-4xl font-bold">Legal Practice Hub.</h1>
          <p className="mt-1.5 text-sm text-brand-blue-light/55">
            Test and sharpen your courtroom litigation instincts on real Indian legal scenarios.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href={`/${role}/practice/profile`}>
            <Button variant="primary" className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-gold" />
              Skill Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-brand-gold/12 bg-base-100/50 backdrop-blur-sm shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue-light/45" />
          <input
            type="text"
            placeholder="Search scenarios or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-brand-gold/15 bg-base-100 text-brand-blue-dark outline-none focus:border-brand-gold focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase tracking-wider text-brand-blue-light/40 mb-1">
              Difficulty
            </span>
            <Select
              id="difficulty-filter"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="text-xs min-h-9 !py-1"
            >
              {difficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Domain Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-black/5 pb-2">
        {domains.map((dom) => (
          <button
            key={dom}
            onClick={() => setDomainFilter(dom)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              domainFilter === dom
                ? "bg-brand-blue-dark text-brand-gold shadow-sm"
                : "text-brand-blue-light/60 hover:bg-black/5"
            }`}
          >
            {dom === "all" ? "All Domains" : dom}
          </button>
        ))}
      </div>

      {/* Scenarios Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
        </div>
      ) : filteredScenarios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scen) => (
            <ScenarioCard key={scen.id} scenario={scen} role={role} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-brand-gold/15 rounded-xl bg-base-100/30">
          <Compass className="w-12 h-12 text-brand-gold/40 animate-pulse mb-3" />
          <h3 className="font-serif text-lg font-bold text-brand-blue-dark">
            No Scenarios Found
          </h3>
          <p className="text-xs text-brand-blue-light/50 max-w-sm mt-1">
            Try adjusting your difficulty filters or search query to discover available cases.
          </p>
        </div>
      )}
    </div>
  );
}
