import { useEffect, useState, useRef } from "react";
import { Bell, Search, Loader2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useNavigate } from "react-router-dom";

export function Header() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const data = await api.getNotifications();
        setNotifications(data);
      } catch (e) {
        console.error(e);
      }
    }
    fetchNotifs();
  }, []);

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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
        <div className="relative flex flex-1 max-w-2xl" ref={searchRef}>
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-sm"
            placeholder="Search appointments, customers, or pets..."
            type="search"
            name="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}

          {showResults && results && (query.length > 0) && (
            <div className="absolute top-full mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden py-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {results.customers?.length > 0 && (
                <div className="px-4 py-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customers</h3>
                  {results.customers.map((c: any) => (
                    <div key={c.id} className="text-sm py-1 hover:bg-slate-50 cursor-pointer rounded px-2">{c.name} <span className="text-slate-400 text-xs ml-2">{c.email}</span></div>
                  ))}
                </div>
              )}
              {results.pets?.length > 0 && (
                <div className="px-4 py-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pets</h3>
                  {results.pets.map((p: any) => (
                    <div key={p.id} className="text-sm py-1 hover:bg-slate-50 cursor-pointer rounded px-2">{p.name} <span className="text-slate-400 text-xs ml-2">{p.breed}</span></div>
                  ))}
                </div>
              )}
              {results.appointments?.length > 0 && (
                <div className="px-4 py-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Appointments</h3>
                  {results.appointments.map((a: any) => (
                    <div key={a.id} className="text-sm py-1 hover:bg-slate-50 cursor-pointer rounded px-2">{a.petName} - {a.service}</div>
                  ))}
                </div>
              )}
              {results.customers?.length === 0 && results.pets?.length === 0 && results.appointments?.length === 0 && (
                <div className="p-4 text-sm text-slate-500 text-center">No results found</div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-500">
            <span className="sr-only">View notifications</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </Button>
          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
