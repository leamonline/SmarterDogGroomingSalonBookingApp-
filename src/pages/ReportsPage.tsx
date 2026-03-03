import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { BarChart3, TrendingUp, DollarSign, Calendar as CalendarIcon, Users, Download, Filter } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from "date-fns";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface ReportAppointment {
    id: string;
    petName: string;
    ownerName: string;
    service: string;
    date: string;
    duration: number;
    status: string;
    price: number;
}

interface ReportAuditEntry {
    id: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before: string;
    after: string;
    createdAt: string;
}

// ────────────────────────────────────────────
// Reports Page
// ────────────────────────────────────────────
export function ReportsPage() {
    const [appointments, setAppointments] = useState<ReportAppointment[]>([]);
    const [auditLog, setAuditLog] = useState<ReportAuditEntry[]>([]);
    const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "services" | "audit">("overview");
    const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
    const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [appts, audit] = await Promise.all([
                api.getAppointments(1, 1000),
                api.getAuditLog?.().catch(() => []),
            ]);
            setAppointments(Array.isArray(appts) ? appts : appts?.data || []);
            setAuditLog(Array.isArray(audit) ? audit : audit?.data || []);
        } catch {
            toast.error("Failed to load report data");
        }
    };

    // ────── Date filtering ──────
    const getDateRange = () => {
        const end = new Date();
        switch (dateRange) {
            case "7d": return { start: subDays(end, 7), end };
            case "30d": return { start: subDays(end, 30), end };
            case "90d": return { start: subDays(end, 90), end };
            case "custom": return { start: new Date(customStart), end: new Date(customEnd) };
        }
    };

    const { start: rangeStart, end: rangeEnd } = getDateRange();

    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            const d = new Date(a.date);
            return d >= rangeStart && d <= rangeEnd;
        });
    }, [appointments, rangeStart, rangeEnd]);

    // ────── Metrics ──────
    const totalBookings = filteredAppointments.length;
    const completedBookings = filteredAppointments.filter(a => a.status === "completed").length;
    const cancelledBookings = filteredAppointments.filter(a => a.status?.includes("cancelled")).length;
    const noShows = filteredAppointments.filter(a => a.status === "no-show").length;
    const totalRevenue = filteredAppointments
        .filter(a => a.status === "completed")
        .reduce((sum, a) => sum + (a.price || 0), 0);
    const avgTicket = completedBookings > 0 ? totalRevenue / completedBookings : 0;
    const cancellationRate = totalBookings > 0 ? ((cancelledBookings + noShows) / totalBookings * 100) : 0;

    // ────── Revenue by day ──────
    const revenueByDay = useMemo(() => {
        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        return days.map(day => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayRevenue = filteredAppointments
                .filter(a => a.date?.startsWith(dayStr) && a.status === "completed")
                .reduce((sum, a) => sum + (a.price || 0), 0);
            return { date: dayStr, label: format(day, "dd MMM"), revenue: dayRevenue };
        });
    }, [filteredAppointments, rangeStart, rangeEnd]);

    const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);

    // ────── Service breakdown ──────
    const serviceBreakdown = useMemo(() => {
        const map: Record<string, { count: number; revenue: number }> = {};
        filteredAppointments.filter(a => a.status === "completed").forEach(a => {
            if (!map[a.service]) map[a.service] = { count: 0, revenue: 0 };
            map[a.service].count++;
            map[a.service].revenue += a.price || 0;
        });
        return Object.entries(map)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [filteredAppointments]);

    const totalServiceRevenue = serviceBreakdown.reduce((sum, s) => sum + s.revenue, 0) || 1;

    // ────── CSV Export ──────
    const exportCSV = () => {
        const headers = ["ID", "Pet Name", "Owner", "Service", "Date", "Duration", "Status", "Price"];
        const rows = filteredAppointments.map(a => [
            a.id, a.petName, a.ownerName, a.service,
            a.date, String(a.duration), a.status, String(a.price)
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `petspa-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Report exported");
    };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
                    <p className="text-slate-500">Business insights and audit trail.</p>
                </div>
                <Button variant="outline" onClick={exportCSV}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                {(["overview", "revenue", "services", "audit"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Date Range Filter */}
            {activeTab !== "audit" && (
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    {(["7d", "30d", "90d", "custom"] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setDateRange(r)}
                            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${dateRange === r ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                        >
                            {r === "custom" ? "Custom" : r}
                        </button>
                    ))}
                    {dateRange === "custom" && (
                        <div className="flex items-center gap-1 ml-2">
                            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-xs" />
                            <span className="text-xs text-slate-400">to</span>
                            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-xs" />
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Overview Tab ═══ */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">Total Bookings</p>
                                        <p className="text-2xl font-bold text-slate-900">{totalBookings}</p>
                                    </div>
                                    <CalendarIcon className="h-8 w-8 text-slate-200" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">Revenue</p>
                                        <p className="text-2xl font-bold text-green-600">£{totalRevenue.toFixed(0)}</p>
                                    </div>
                                    <DollarSign className="h-8 w-8 text-slate-200" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">Avg. Ticket</p>
                                        <p className="text-2xl font-bold text-slate-900">£{avgTicket.toFixed(0)}</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-slate-200" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">Cancel / No-show</p>
                                        <p className="text-2xl font-bold text-red-500">{cancellationRate.toFixed(1)}%</p>
                                    </div>
                                    <Users className="h-8 w-8 text-slate-200" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Status Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Status Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: "Completed", count: completedBookings, colour: "bg-green-100 text-green-800" },
                                    { label: "Confirmed", count: filteredAppointments.filter(a => a.status === "confirmed" || a.status === "scheduled").length, colour: "bg-blue-100 text-blue-800" },
                                    { label: "Cancelled", count: cancelledBookings, colour: "bg-red-100 text-red-800" },
                                    { label: "No Show", count: noShows, colour: "bg-orange-100 text-orange-800" },
                                ].map(s => (
                                    <div key={s.label} className="text-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${s.colour}`}>{s.label}</span>
                                        <p className="text-xl font-bold text-slate-900 mt-1">{s.count}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ═══ Revenue Tab ═══ */}
            {activeTab === "revenue" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue by Day</CardTitle>
                        <CardDescription>Completed appointment revenue over the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48 flex items-end gap-[2px]">
                            {revenueByDay.map((d, i) => (
                                <div key={d.date} className="flex-1 flex flex-col items-center group">
                                    <div className="relative w-full flex justify-center">
                                        <div className="absolute -top-5 bg-slate-900 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                            £{d.revenue}
                                        </div>
                                        <div
                                            className="w-full max-w-[20px] bg-slate-900 rounded-t transition-all hover:bg-slate-700"
                                            style={{ height: `${Math.max((d.revenue / maxRevenue) * 160, d.revenue > 0 ? 4 : 0)}px` }}
                                        />
                                    </div>
                                    {(i % Math.max(Math.floor(revenueByDay.length / 7), 1) === 0) && (
                                        <span className="text-[8px] text-slate-400 mt-1 transform -rotate-45">{d.label}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-4 text-sm">
                            <span className="text-slate-500">Total: <strong>£{totalRevenue.toFixed(2)}</strong></span>
                            <span className="text-slate-500">Daily avg: <strong>£{(totalRevenue / Math.max(revenueByDay.length, 1)).toFixed(2)}</strong></span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ═══ Services Tab ═══ */}
            {activeTab === "services" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Service Performance</CardTitle>
                        <CardDescription>Revenue and booking count per service type.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {serviceBreakdown.length === 0 ? (
                            <p className="text-sm text-slate-400 py-6 text-center">No completed appointments in this period.</p>
                        ) : (
                            <div className="space-y-3">
                                {serviceBreakdown.map(s => (
                                    <div key={s.name} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-slate-900">{s.name}</span>
                                            <span className="text-slate-600">£{s.revenue.toFixed(0)} ({s.count} bookings)</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-slate-900 rounded-full transition-all"
                                                style={{ width: `${(s.revenue / totalServiceRevenue) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══ Audit Tab ═══ */}
            {activeTab === "audit" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Audit Log</CardTitle>
                        <CardDescription>System activity trail (owner-only).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {auditLog.length === 0 ? (
                            <p className="text-sm text-slate-400 py-6 text-center">No audit entries yet.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                                {auditLog.map(entry => (
                                    <div key={entry.id} className="flex items-start gap-3 p-2 rounded border border-slate-100 bg-white text-sm">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900">{entry.action}</span>
                                                <span className="text-[10px] text-slate-400">{entry.entity}/{entry.entityId?.slice(0, 8)}</span>
                                            </div>
                                            {entry.after && (
                                                <pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap">
                                                    {typeof entry.after === 'string' ? entry.after.slice(0, 100) : JSON.stringify(entry.after).slice(0, 100)}
                                                </pre>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                            {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM HH:mm") : ""}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
