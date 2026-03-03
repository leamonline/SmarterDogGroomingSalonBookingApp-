import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";
import { Scissors, ArrowLeft, ArrowRight, Clock, CheckCircle, Calendar as CalendarIcon, Dog, CreditCard } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
interface BookableService {
    id: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    category: string;
    priceType?: string;
    depositRequired?: boolean;
    depositAmount?: number;
}

// ────────────────────────────────────────
// API helpers (public, no auth)
// ────────────────────────────────────────
async function publicFetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }
    const token = localStorage.getItem("petspa_booking_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Request failed");
    }
    return res.json();
}

// ────────────────────────────────────────
// Main Booking Page
// ────────────────────────────────────────
type Step = "auth" | "service" | "datetime" | "pet" | "confirm" | "done";

export function BookingPage() {
    const [step, setStep] = useState<Step>("auth");
    const [authed, setAuthed] = useState(false);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState("");

    // Auth
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    // Service selection
    const [services, setServices] = useState<BookableService[]>([]);
    const [selectedService, setSelectedService] = useState<BookableService | null>(null);

    // Date/time
    const [schedule, setSchedule] = useState<Record<string, { isClosed: boolean }>>({});
    const [selectedDate, setSelectedDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    const [slots, setSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string>("");
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Pet info
    const [petName, setPetName] = useState("");
    const [breed, setBreed] = useState("");
    const [petNotes, setPetNotes] = useState("");

    // Result
    const [bookingResult, setBookingResult] = useState<any>(null);

    // Check if already authed
    useEffect(() => {
        const token = localStorage.getItem("petspa_booking_token");
        const savedEmail = localStorage.getItem("petspa_booking_email");
        const savedCustId = localStorage.getItem("petspa_booking_customer_id");
        if (token && savedEmail) {
            setAuthed(true);
            setUserEmail(savedEmail);
            setCustomerId(savedCustId);
            setStep("service");
        }
    }, []);

    // Load services and schedule (both are public)
    useEffect(() => {
        publicFetch("/api/public/services")
            .then(setServices)
            .catch(() => setServices([]));

        // Fetch actual schedule so the calendar disables correct days
        fetch('/api/public/schedule')
            .then(r => r.ok ? r.json() : [])
            .then((rows: any[]) => {
                const map: Record<string, { isClosed: boolean }> = {};
                rows.forEach(r => { map[r.day] = { isClosed: !!r.isClosed }; });
                setSchedule(map);
            })
            .catch(() => {/* schedule not critical for booking to work */ });
    }, []);

    // Load slots when date or service changes.
    // Pass the date in yyyy-MM-dd form; the server must parse it as a local date.
    useEffect(() => {
        if (selectedDate && selectedService) {
            setLoadingSlots(true);
            publicFetch(`/api/public/available-slots?date=${selectedDate}&duration=${selectedService.duration}`)
                .then((data) => {
                    setSlots(data.slots || []);
                    setSelectedSlot("");
                })
                .catch(() => setSlots([]))
                .finally(() => setLoadingSlots(false));
        }
    }, [selectedDate, selectedService]);

    // ────── Auth Handlers ──────
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const endpoint = isRegister ? "/api/public/register" : "/api/public/login";
            const body = isRegister
                ? { email, password, firstName, lastName, phone }
                : { email, password };

            const data = await publicFetch(endpoint, {
                method: "POST",
                body: JSON.stringify(body),
            });

            localStorage.setItem("petspa_booking_token", data.token);
            localStorage.setItem("petspa_booking_email", data.user.email);
            if (data.user.customerId) {
                localStorage.setItem("petspa_booking_customer_id", data.user.customerId);
                setCustomerId(data.user.customerId);
            }
            setAuthed(true);
            setUserEmail(data.user.email);
            setStep("service");
            toast.success(isRegister ? "Account created!" : "Logged in!");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    // ────── Booking Submit ──────
    const handleBook = async () => {
        try {
            const result = await publicFetch("/api/public/bookings", {
                method: "POST",
                body: JSON.stringify({
                    serviceId: selectedService!.id,
                    date: selectedSlot,
                    petName,
                    breed,
                    notes: petNotes,
                    customerId,
                }),
            });
            setBookingResult(result);
            setStep("done");
            toast.success(result.message);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    // ────── Render Helpers ──────
    const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i + 1));
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // A day is disabled if the schedule marks it as closed.
    // Falls back to allowing all days if the schedule hasn't loaded yet.
    const isDayDisabled = (d: Date) => {
        if (Object.keys(schedule).length === 0) return false; // schedule not yet loaded
        const dayName = DAY_NAMES[d.getDay()];
        return schedule[dayName]?.isClosed === true;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-slate-900 p-2">
                            <Scissors className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900">Savvy Pet Spa</h1>
                            <p className="text-xs text-slate-500">Book your appointment online</p>
                        </div>
                    </div>
                    {authed && (
                        <div className="text-sm text-slate-500">
                            {userEmail}
                        </div>
                    )}
                </div>
            </header>

            {/* Progress Steps */}
            {step !== "done" && (
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-2">
                        {(["auth", "service", "datetime", "pet", "confirm"] as const).map((s, i) => {
                            const labels = ["Account", "Service", "Date & Time", "Pet Details", "Confirm"];
                            const stepOrder = ["auth", "service", "datetime", "pet", "confirm"];
                            const current = stepOrder.indexOf(step);
                            const thisIdx = i;
                            return (
                                <React.Fragment key={s}>
                                    {i > 0 && <div className={`flex-1 h-0.5 ${thisIdx <= current ? "bg-slate-900" : "bg-slate-200"}`} />}
                                    <div className={`flex items-center gap-1.5 text-xs font-medium ${thisIdx < current ? "text-green-600" :
                                        thisIdx === current ? "text-slate-900" : "text-slate-400"
                                        }`}>
                                        {thisIdx < current ? (
                                            <CheckCircle className="h-4 w-4" />
                                        ) : (
                                            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${thisIdx === current ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                                                }`}>{i + 1}</span>
                                        )}
                                        <span className="hidden sm:inline">{labels[i]}</span>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            <main className="max-w-3xl mx-auto px-4 pb-12">
                {/* ═══ Step 1: Auth ═══ */}
                {step === "auth" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-md mx-auto">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">
                            {isRegister ? "Create an Account" : "Sign In to Book"}
                        </h2>
                        <p className="text-sm text-slate-500 mb-6">
                            {isRegister ? "Create an account to manage your bookings." : "Sign in with your existing account."}
                        </p>
                        <form onSubmit={handleAuth} className="space-y-4">
                            {isRegister && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">First Name *</label>
                                        <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">Last Name</label>
                                        <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Email *</label>
                                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Password *</label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            {isRegister && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Phone</label>
                                    <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            )}
                            <Button type="submit" className="w-full">{isRegister ? "Create Account" : "Sign In"}</Button>
                            <p className="text-center text-sm text-slate-500">
                                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                                <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-slate-900 font-medium underline">
                                    {isRegister ? "Sign in" : "Register"}
                                </button>
                            </p>
                        </form>
                    </div>
                )}

                {/* ═══ Step 2: Service ═══ */}
                {step === "service" && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-900">Choose a Service</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {services.map(svc => (
                                <button
                                    key={svc.id}
                                    onClick={() => { setSelectedService(svc); setStep("datetime"); }}
                                    className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${selectedService?.id === svc.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <h3 className="font-semibold text-slate-900">{svc.name}</h3>
                                    {svc.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{svc.description}</p>}
                                    <div className="flex items-center gap-3 mt-3 text-sm">
                                        <span className="flex items-center gap-1 text-slate-600">
                                            <CreditCard className="h-3.5 w-3.5" />
                                            {svc.priceType === "from" ? "From " : ""}£{svc.price}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-600">
                                            <Clock className="h-3.5 w-3.5" /> {svc.duration}m
                                        </span>
                                        {svc.depositRequired && svc.depositAmount && (
                                            <span className="text-xs text-orange-600 font-medium">
                                                £{svc.depositAmount} deposit
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                        {services.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <Scissors className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm">No services are currently available for online booking.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Step 3: Date & Time ═══ */}
                {step === "datetime" && selectedService && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Pick a Date & Time</h2>
                            <Button size="sm" variant="outline" onClick={() => setStep("service")}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
                        </div>
                        <p className="text-sm text-slate-500">{selectedService.name} — {selectedService.duration} min</p>

                        {/* Date picker */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {dates.map(d => {
                                const ds = format(d, "yyyy-MM-dd");
                                const isSelected = ds === selectedDate;
                                const disabled = isDayDisabled(d);
                                return (
                                    <button
                                        key={ds}
                                        onClick={() => setSelectedDate(ds)}
                                        disabled={disabled}
                                        className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all ${isSelected ? "bg-slate-900 text-white shadow-md" :
                                            disabled ? "bg-slate-100 text-slate-300 cursor-not-allowed" :
                                                "bg-white border border-slate-200 text-slate-700 hover:border-slate-400"
                                            }`}
                                    >
                                        <span className="text-[10px] font-medium uppercase block">{format(d, "EEE")}</span>
                                        <span className="text-lg font-bold block">{format(d, "d")}</span>
                                        <span className="text-[10px] block">{format(d, "MMM")}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Time slots */}
                        <div>
                            <h3 className="text-sm font-medium text-slate-700 mb-2">Available Times</h3>
                            {loadingSlots ? (
                                <p className="text-sm text-slate-400 py-4 text-center">Loading slots...</p>
                            ) : slots.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">No available slots on this date.</p>
                            ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {slots.map(slot => {
                                        const t = new Date(slot);
                                        const isSelected = slot === selectedSlot;
                                        return (
                                            <button
                                                key={slot}
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${isSelected ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-700 hover:border-slate-400"
                                                    }`}
                                            >
                                                {format(t, "h:mm a")}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {selectedSlot && (
                            <div className="flex justify-end">
                                <Button onClick={() => setStep("pet")}>
                                    Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Step 4: Pet Details ═══ */}
                {step === "pet" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Your Dog's Details</h2>
                            <Button size="sm" variant="outline" onClick={() => setStep("datetime")}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto">
                            <div className="flex justify-center">
                                <Dog className="h-12 w-12 text-slate-300" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Dog's Name *</label>
                                <Input value={petName} onChange={e => setPetName(e.target.value)} placeholder="e.g. Buddy" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Breed</label>
                                <Input value={breed} onChange={e => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Notes</label>
                                <textarea
                                    value={petNotes}
                                    onChange={e => setPetNotes(e.target.value)}
                                    placeholder="Any allergies, behaviour notes, or special requirements..."
                                    className="w-full min-h-[80px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                                />
                            </div>
                            <Button className="w-full" onClick={() => { if (!petName) { toast.error("Dog's name is required"); return; } setStep("confirm"); }}>
                                Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ═══ Step 5: Confirm ═══ */}
                {step === "confirm" && selectedService && selectedSlot && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">Confirm Your Booking</h2>
                            <Button size="sm" variant="outline" onClick={() => setStep("pet")}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-md mx-auto">
                            <div className="bg-slate-900 text-white px-6 py-4">
                                <h3 className="font-bold text-lg">{selectedService.name}</h3>
                                <p className="text-slate-300 text-sm">{selectedService.duration} minutes</p>
                            </div>
                            <div className="px-6 py-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Date</span>
                                    <span className="font-medium">{format(new Date(selectedSlot), "EEE d MMMM yyyy")}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</span>
                                    <span className="font-medium">{format(new Date(selectedSlot), "h:mm a")}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-1.5"><Dog className="h-3.5 w-3.5" /> Dog</span>
                                    <span className="font-medium">{petName} {breed && `(${breed})`}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-bold">
                                    <span>Price</span>
                                    <span>£{selectedService.price}</span>
                                </div>
                                {selectedService.depositRequired && selectedService.depositAmount && (
                                    <div className="flex justify-between text-sm text-orange-600">
                                        <span>Deposit Required</span>
                                        <span>£{selectedService.depositAmount}</span>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                                <Button className="w-full" onClick={handleBook}>Confirm Booking</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Done ═══ */}
                {step === "done" && bookingResult && (
                    <div className="text-center py-12 max-w-md mx-auto">
                        <div className="rounded-full bg-green-100 p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">
                            {bookingResult.status === "pending-approval" ? "Booking Request Submitted!" : "Booking Confirmed!"}
                        </h2>
                        <p className="text-slate-500 mb-6">{bookingResult.message}</p>
                        {bookingResult.depositRequired > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-sm text-orange-800">
                                <strong>Deposit Required:</strong> £{bookingResult.depositRequired} — we'll be in touch with payment details.
                            </div>
                        )}
                        <Button variant="outline" onClick={() => {
                            setStep("service");
                            setSelectedService(null);
                            setSelectedSlot("");
                            setPetName("");
                            setBreed("");
                            setPetNotes("");
                            setBookingResult(null);
                        }}>
                            Book Another Appointment
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
