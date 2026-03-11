import { useEffect, useMemo, useState, useRef } from "react";
import { Search, Loader2, Menu, Settings2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useNavigate } from "react-router-dom";

export function Header({ setSidebarOpen }: { setSidebarOpen?: (val: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await api.search(query);
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!results) return [];
    const items: { type: string; id: string; label: string; sub?: string; navigateTo: string; navState: any }[] = [];
    results.customers?.forEach((c: any) =>
      items.push({
        type: "customer",
        id: c.id,
        label: c.name,
        sub: c.email,
        navigateTo: "/clients",
        navState: { customerId: c.id },
      }),
    );
    results.pets?.forEach((p: any) =>
      items.push({
        type: "pet",
        id: p.id,
        label: p.name,
        sub: p.breed,
        navigateTo: "/dogs",
        navState: { dogId: p.id },
      }),
    );
    results.appointments?.forEach((a: any) =>
      items.push({
        type: "appointment",
        id: a.id,
        label: `${a.petName} - ${a.service}`,
        navigateTo: "/calendar",
        navState: { appointmentId: a.id },
      }),
    );
    return items;
  }, [results]);

  // Reset active index when results change
  useEffect(() => {
    setActiveResultIdx(-1);
  }, [results, query]);

  useEffect(() => {
    function handleShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingField = !!target?.closest("input, textarea, [contenteditable='true']");

      if (event.key === "/" && !isTypingField) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setShowResults(false);
        setActiveResultIdx(-1);
      }

      // Arrow key navigation in search results
      if (
        showResults &&
        flatResults.length > 0 &&
        (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")
      ) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveResultIdx((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveResultIdx((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
        } else if (event.key === "Enter" && activeResultIdx >= 0 && activeResultIdx < flatResults.length) {
          event.preventDefault();
          const item = flatResults[activeResultIdx]!;
          navigate(item.navigateTo, { state: item.navState });
          setShowResults(false);
          setQuery("");
          setActiveResultIdx(-1);
        }
      }
    }

    document.addEventListener("keydown", handleShortcuts);
    return () => document.removeEventListener("keydown", handleShortcuts);
  }, [showResults, flatResults, activeResultIdx, navigate]);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-brand-100 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-x-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen && setSidebarOpen(true)}>
          <Menu className="h-6 w-6 text-brand-600" />
        </Button>
      </div>
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
        <div className="relative flex flex-1 max-w-2xl" ref={searchRef}>
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-brand-400"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-slate-900 placeholder:text-brand-300 focus:ring-0 sm:text-sm bg-transparent"
            placeholder="Search bookings, clients, or dogs..."
            type="search"
            name="search"
            role="combobox"
            aria-expanded={showResults && query.length > 0 && flatResults.length > 0}
            aria-controls="search-results-listbox"
            aria-activedescendant={activeResultIdx >= 0 ? `search-result-${activeResultIdx}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
            </div>
          )}

          {showResults && results && query.length > 0 && (
            <div
              id="search-results-listbox"
              role="listbox"
              aria-label="Search results"
              className="absolute top-full mt-2 w-full z-50 rounded-2xl border border-brand-100 bg-white shadow-lg overflow-hidden py-2"
              style={{ maxHeight: "400px", overflowY: "auto" }}
            >
              {flatResults.length > 0 ? (
                <>
                  {results.customers?.length > 0 && (
                    <div className="px-4 py-2">
                      <h3
                        className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2"
                        aria-hidden="true"
                      >
                        Clients
                      </h3>
                      {results.customers.map((c: any) => {
                        const idx = flatResults.findIndex((f) => f.type === "customer" && f.id === c.id);
                        return (
                          <div
                            key={c.id}
                            id={`search-result-${idx}`}
                            role="option"
                            aria-selected={activeResultIdx === idx}
                            className={`text-sm py-1.5 cursor-pointer rounded-lg px-2 transition-colors ${activeResultIdx === idx ? "bg-brand-100 text-brand-900" : "hover:bg-brand-50"}`}
                            onClick={() => {
                              navigate("/clients", { state: { customerId: c.id } });
                              setShowResults(false);
                              setQuery("");
                            }}
                          >
                            {c.name} <span className="text-slate-400 text-xs ml-2">{c.email}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {results.pets?.length > 0 && (
                    <div className="px-4 py-2">
                      <h3
                        className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2"
                        aria-hidden="true"
                      >
                        Dogs
                      </h3>
                      {results.pets.map((p: any) => {
                        const idx = flatResults.findIndex((f) => f.type === "pet" && f.id === p.id);
                        return (
                          <div
                            key={p.id}
                            id={`search-result-${idx}`}
                            role="option"
                            aria-selected={activeResultIdx === idx}
                            className={`text-sm py-1.5 cursor-pointer rounded-lg px-2 transition-colors ${activeResultIdx === idx ? "bg-brand-100 text-brand-900" : "hover:bg-brand-50"}`}
                            onClick={() => {
                              navigate("/dogs", { state: { dogId: p.id } });
                              setShowResults(false);
                              setQuery("");
                            }}
                          >
                            {p.name} <span className="text-slate-400 text-xs ml-2">{p.breed}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {results.appointments?.length > 0 && (
                    <div className="px-4 py-2">
                      <h3
                        className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2"
                        aria-hidden="true"
                      >
                        Appointments
                      </h3>
                      {results.appointments.map((a: any) => {
                        const idx = flatResults.findIndex((f) => f.type === "appointment" && f.id === a.id);
                        return (
                          <div
                            key={a.id}
                            id={`search-result-${idx}`}
                            role="option"
                            aria-selected={activeResultIdx === idx}
                            className={`text-sm py-1.5 cursor-pointer rounded-lg px-2 transition-colors ${activeResultIdx === idx ? "bg-brand-100 text-brand-900" : "hover:bg-brand-50"}`}
                            onClick={() => {
                              navigate("/calendar", { state: { appointmentId: a.id } });
                              setShowResults(false);
                              setQuery("");
                            }}
                          >
                            {a.petName} - {a.service}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center" role="status">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <Settings2 className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
