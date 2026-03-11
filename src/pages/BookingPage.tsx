import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";
import {
  Scissors,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle,
  Calendar as CalendarIcon,
  Dog,
  CreditCard,
} from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { formatCurrency } from "@/src/lib/utils";
import {
  BOOKING_CLOSE_TIME,
  BOOKING_OPEN_TIME,
  formatScheduleTime,
  normalizeScheduleDays,
} from "@/src/lib/bookingSchedule";

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

const hasDeposit = (service: Pick<BookableService, "depositRequired" | "depositAmount">) =>
  Boolean(service.depositRequired && (service.depositAmount ?? 0) > 0);

const formatServicePrice = (service: Pick<BookableService, "price" | "priceType">) =>
  service.priceType === "from" ? `From ${formatCurrency(service.price)}` : formatCurrency(service.price);

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
type Step = "service" | "auth" | "datetime" | "pet" | "confirm" | "done";

type PublicScheduleDay = {
  isClosed: boolean;
  availableSlots: number;
};

export function BookingPage() {
  const defaultDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [step, setStep] = useState<Step>("service");
  const [authed, setAuthed] = useState(false);
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
  const [schedule, setSchedule] = useState<Record<string, PublicScheduleDay>>({});
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [findingFirstAvailable, setFindingFirstAvailable] = useState(false);
  const [noAvailability, setNoAvailability] = useState(false);
  const [dogCount, setDogCount] = useState(1);

  // Pet info
  const [petName, setPetName] = useState("");
  const [breed, setBreed] = useState("");
  const [petNotes, setPetNotes] = useState("");

  // Result
  const [bookingResult, setBookingResult] = useState<any>(null);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i + 1));
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Check if already authed (no step change — user starts on service regardless)
  useEffect(() => {
    const token = localStorage.getItem("petspa_booking_token");
    const savedEmail = localStorage.getItem("petspa_booking_email");
    if (token && savedEmail) {
      setAuthed(true);
      setUserEmail(savedEmail);
    }
  }, []);

  // Load services and schedule (both are public)
  useEffect(() => {
    publicFetch("/api/public/services")
      .then(setServices)
      .catch(() => setServices([]));

    // Fetch actual schedule so the calendar disables correct days
    fetch("/api/public/schedule")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const map: Record<string, PublicScheduleDay> = {};
        normalizeScheduleDays(rows).forEach((row) => {
          map[row.day] = {
            isClosed: row.isClosed,
            availableSlots: row.slots.filter((slot) => slot.isAvailable).length,
          };
        });
        setSchedule(map);
      })
      .catch(() => {
        /* schedule not critical for booking to work */
      });
  }, []);

  // Load slots when date or service changes.
  // Pass the date in yyyy-MM-dd form; the server must parse it as a local date.
  useEffect(() => {
    if (selectedDate && selectedService) {
      setLoadingSlots(true);
      setNoAvailability(false);
      publicFetch(
        `/api/public/available-slots?date=${selectedDate}&duration=${selectedService.duration}&dogCount=${dogCount}`,
      )
        .then((data) => {
          const nextSlots = data.slots || [];
          setSlots(nextSlots);
          setSelectedSlot((current) => (nextSlots.includes(current) ? current : ""));
        })
        .catch(() => setSlots([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedDate, selectedService, dogCount]);

  useEffect(() => {
    if (Object.keys(schedule).length === 0) return;
    const current = dates.find((date) => format(date, "yyyy-MM-dd") === selectedDate);
    if (current && !isDayDisabled(current)) return;

    const firstAvailableDate = dates.find((date) => !isDayDisabled(date));
    if (firstAvailableDate) {
      setSelectedDate(format(firstAvailableDate, "yyyy-MM-dd"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recalculate when schedule loads or date is cleared
  }, [schedule, selectedDate]);

  // ────── Auth Handlers ──────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isRegister ? "/api/public/register" : "/api/public/login";
      const body = isRegister ? { email, password, firstName, lastName, phone } : { email, password };

      const data = await publicFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      localStorage.setItem("petspa_booking_token", data.token);
      localStorage.setItem("petspa_booking_email", data.user.email);
      setAuthed(true);
      setUserEmail(data.user.email);
      setStep("datetime");
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
          dogCount,
          petName,
          breed,
          notes: petNotes,
        }),
      });
      setBookingResult(result);
      setStep("done");
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // A day is disabled if the schedule marks it as closed.
  // Falls back to allowing all days if the schedule hasn't loaded yet.
  const isDayDisabled = (d: Date) => {
    if (Object.keys(schedule).length === 0) return false; // schedule not yet loaded
    const dayName = DAY_NAMES[d.getDay()];
    const daySchedule = schedule[dayName];
    if (!daySchedule) return false;
    return daySchedule.isClosed === true || daySchedule.availableSlots === 0;
  };

  const resetBookingDraft = () => {
    setSelectedService(null);
    setSelectedDate(defaultDate);
    setSlots([]);
    setSelectedSlot("");
    setNoAvailability(false);
    setDogCount(1);
    setPetName("");
    setBreed("");
    setPetNotes("");
    setBookingResult(null);
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("petspa_booking_token");
    localStorage.removeItem("petspa_booking_email");
    localStorage.removeItem("petspa_booking_customer_id");
    setAuthed(false);
    setUserEmail("");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setIsRegister(false);
    resetBookingDraft();
    setStep("service");
    toast.success("Signed out. You can book with a different account now.");
  };

  const findFirstAvailableSlot = async () => {
    if (!selectedService) return;

    setFindingFirstAvailable(true);
    setNoAvailability(false);
    try {
      for (const date of dates) {
        if (isDayDisabled(date)) continue;

        const dateKey = format(date, "yyyy-MM-dd");
        const data = await publicFetch(
          `/api/public/available-slots?date=${dateKey}&duration=${selectedService.duration}&dogCount=${dogCount}`,
        );
        const nextSlots = data.slots || [];

        if (nextSlots.length > 0) {
          setSelectedDate(dateKey);
          setSlots(nextSlots);
          setSelectedSlot(nextSlots[0]);
          setNoAvailability(false);
          toast.success(`Earliest slot selected for ${format(new Date(nextSlots[0]), "EEE d MMM • h:mm a")}`);
          return;
        }
      }

      setNoAvailability(true);
    } catch (err: any) {
      toast.error(err.message || "Couldn't find the earliest available slot.");
    } finally {
      setFindingFirstAvailable(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-brand-50">
      {/* Header */}
      <header className="bg-white border-b border-brand-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent p-2">
              <Scissors className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-purple font-heading">Smarter Dog</h1>
              <p className="text-xs text-slate-500">Book your appointment online</p>
            </div>
          </div>
          {authed && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{userEmail}</span>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="font-medium text-brand-600 underline underline-offset-4"
              >
                Switch account
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Progress Steps */}
      {step !== "done" && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2">
            {(["service", "auth", "datetime", "pet", "confirm"] as const).map((s, i) => {
              const labels = ["Service", "Account", "Date & Time", "Pet Details", "Confirm"];
              const shortLabels = ["Service", "Account", "Date", "Pet", "Confirm"];
              const stepOrder = ["service", "auth", "datetime", "pet", "confirm"];
              const current = stepOrder.indexOf(step);
              const thisIdx = i;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`flex-1 h-0.5 ${thisIdx <= current ? "bg-brand-600" : "bg-slate-200"}`} />}
                  <div
                    aria-label={`Step ${i + 1}: ${labels[i]}${thisIdx < current ? " (completed)" : thisIdx === current ? " (current)" : ""}`}
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      thisIdx < current ? "text-accent" : thisIdx === current ? "text-purple" : "text-slate-400"
                    }`}
                  >
                    {thisIdx < current ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          thisIdx === current ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}
                    <span className="sm:hidden">{shortLabels[i]}</span>
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
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-purple">{isRegister ? "Create an Account" : "Sign In to Book"}</h2>
              <Button size="sm" variant="outline" onClick={() => setStep("service")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Services
              </Button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {isRegister ? "Create an account to manage your bookings." : "Sign in with your existing account."}
            </p>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">First Name *</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Last Name</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Password *</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                />
                {isRegister && (
                  <p className="text-xs text-slate-500">
                    Use at least one uppercase letter, one lowercase letter, and one number.
                  </p>
                )}
              </div>
              {isRegister && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </div>
              )}
              <Button type="submit" className="w-full">
                {isRegister ? "Create Account" : "Sign In"}
              </Button>
              <p className="text-center text-sm text-slate-500">
                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-brand-600 font-medium underline"
                >
                  {isRegister ? "Sign in" : "Register"}
                </button>
              </p>
            </form>
          </div>
        )}

        {/* ═══ Step 2: Service ═══ */}
        {step === "service" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-purple">Choose a Service</h2>
              <p className="text-sm text-slate-500">
                Pick the service first and we&apos;ll guide you to the best available time.
              </p>
            </div>
            {authed && (
              <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Booking account</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{userEmail}</p>
                    <p className="text-sm text-slate-500">
                      Your appointment details will be saved against this customer profile.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={handleSwitchAccount}>
                    Switch account
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedService(svc);
                    setSelectedSlot("");
                    setStep(authed ? "datetime" : "auth");
                  }}
                  className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                    selectedService?.id === svc.id
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-purple">{svc.name}</h3>
                      {svc.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{svc.description}</p>}
                    </div>
                    {svc.category && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {svc.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                      <span className="flex items-center gap-1 text-slate-600">
                        <CreditCard className="h-3.5 w-3.5" />
                        Price
                      </span>
                      <span className="mt-1 block font-semibold text-slate-900">{formatServicePrice(svc)}</span>
                    </span>
                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="h-3.5 w-3.5" /> {svc.duration}m
                      </span>
                      <span className="mt-1 block font-semibold text-slate-900">Duration</span>
                    </span>
                    {hasDeposit(svc) && (
                      <span className="rounded-lg bg-warning-light px-3 py-2 text-warning">
                        <span className="block text-xs font-medium uppercase tracking-wide">Deposit</span>
                        <span className="mt-1 block font-semibold">{formatCurrency(svc.depositAmount)}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {hasDeposit(svc)
                      ? "We’ll confirm your slot and collect the deposit after you submit the booking."
                      : "No deposit is needed to request this service."}
                  </p>
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
              <h2 className="text-lg font-bold text-purple">Pick a Date & Time</h2>
              <Button size="sm" variant="outline" onClick={() => setStep("service")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </div>
            <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Selected service</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedService.name}</h3>
                  <p className="text-sm text-slate-500">
                    Choose a day below and we&apos;ll help you lock in a time that suits.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
                    <p className="font-semibold text-slate-900">{formatServicePrice(selectedService)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                    <p className="font-semibold text-slate-900">{selectedService.duration} min</p>
                  </div>
                  {hasDeposit(selectedService) && (
                    <div className="rounded-lg bg-warning-light px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-warning">Deposit</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(selectedService.depositAmount)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Booking windows run from {formatScheduleTime(BOOKING_OPEN_TIME)} to{" "}
                {formatScheduleTime(BOOKING_CLOSE_TIME)}. Start times open in 30-minute steps, each slot can take up to
                2 dogs, and 3 or 4 dogs need back-to-back drop-off windows.
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">How many dogs?</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => {
                    const isSelected = dogCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setDogCount(count);
                          setSelectedSlot("");
                          setNoAvailability(false);
                        }}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                          isSelected
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
                        }`}
                      >
                        {count} {count === 1 ? "dog" : "dogs"}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Online booking supports up to 4 dogs per request. We&apos;ll always offer the earliest valid drop-off
                  slot or slot pair.
                </p>
              </div>
            </div>

            {/* Date picker */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent z-10 rounded-l-xl" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent z-10 rounded-r-xl" />
              <div
                className="flex gap-2 overflow-x-auto pb-2 scroll-smooth"
                role="radiogroup"
                aria-label="Select a date"
              >
                {dates.map((d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  const isSelected = ds === selectedDate;
                  const disabled = isDayDisabled(d);
                  return (
                    <button
                      key={ds}
                      onClick={() => setSelectedDate(ds)}
                      disabled={disabled}
                      className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-md"
                          : disabled
                            ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-brand-400"
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase block">{format(d, "EEE")}</span>
                      <span className="text-lg font-bold block">{format(d, "d")}</span>
                      <span className="text-[10px] block">{format(d, "MMM")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Available Times</h3>
              {loadingSlots ? (
                <p className="text-sm text-slate-400 py-4 text-center">Loading slots...</p>
              ) : slots.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center"
                  data-testid="booking-no-slots-card"
                >
                  <p className="text-sm font-medium text-slate-900">No available slots on this date.</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another day, or let us jump to the next available appointment for you.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={findFirstAvailableSlot}
                    disabled={findingFirstAvailable}
                  >
                    {findingFirstAvailable ? "Finding next slot..." : "Find first available"}
                  </Button>
                  {noAvailability && (
                    <div
                      className="mt-4 rounded-xl border border-gold bg-gold-light p-4 text-left"
                      data-testid="booking-no-availability-banner"
                    >
                      <p className="text-sm font-semibold text-purple">
                        No appointments available in the next two weeks
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        We're fully booked right now. Give us a call and we'll find the perfect slot for you.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((slot) => {
                    const t = new Date(slot);
                    const isSelected = slot === selectedSlot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-md"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-brand-400"
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
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3"
                data-testid="booking-selected-slot-summary"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Selected time</p>
                  <p className="font-semibold text-slate-900">
                    {format(new Date(selectedSlot), "EEEE d MMMM • h:mm a")}
                  </p>
                </div>
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
              <h2 className="text-lg font-bold text-purple">
                {dogCount > 1 ? "Your Dogs' Details" : "Your Dog's Details"}
              </h2>
              <Button size="sm" variant="outline" onClick={() => setStep("datetime")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto">
              <div className="flex justify-center">
                <Dog className="h-12 w-12 text-slate-300" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  {dogCount > 1 ? "Dog Name(s) *" : "Dog's Name *"}
                </label>
                <Input
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder={dogCount > 1 ? "e.g. Buddy, Bella & Milo" : "e.g. Buddy"}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Breed</label>
                <Input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={petNotes}
                  onChange={(e) => setPetNotes(e.target.value)}
                  placeholder={
                    dogCount > 1
                      ? "List each dog plus any allergies, behaviour notes, or special requirements..."
                      : "Any allergies, behaviour notes, or special requirements..."
                  }
                  className="w-full min-h-[80px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!petName) {
                    toast.error("Dog's name is required");
                    return;
                  }
                  setStep("confirm");
                }}
              >
                Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ Step 5: Confirm ═══ */}
        {step === "confirm" && selectedService && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-purple">Confirm Your Booking</h2>
              <Button size="sm" variant="outline" onClick={() => setStep("pet")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-md mx-auto">
              <div className="bg-purple text-white px-6 py-4">
                <h3 className="font-bold text-lg">{selectedService.name}</h3>
                <p className="text-slate-300 text-sm">{selectedService.duration} minutes</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" /> Date
                  </span>
                  <span className="font-medium">{format(new Date(selectedSlot), "EEE d MMMM yyyy")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Time
                  </span>
                  <span className="font-medium">{format(new Date(selectedSlot), "h:mm a")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Dog className="h-3.5 w-3.5" /> {dogCount > 1 ? "Dogs" : "Dog"}
                  </span>
                  <span className="font-medium">
                    {petName} {breed && `(${breed})`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Number of dogs</span>
                  <span className="font-medium">{dogCount}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-bold">
                  <span>Price</span>
                  <span>{formatServicePrice(selectedService)}</span>
                </div>
                {hasDeposit(selectedService) && (
                  <div className="flex justify-between text-sm text-warning">
                    <span>Deposit Required</span>
                    <span>{formatCurrency(selectedService.depositAmount)}</span>
                  </div>
                )}
                {petNotes && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">Notes for the salon</p>
                    <p className="mt-1 whitespace-pre-wrap">{petNotes}</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                <Button className="w-full" onClick={handleBook}>
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Done ═══ */}
        {step === "done" && bookingResult && (
          <div className="text-center py-12 max-w-md mx-auto">
            <div className="rounded-full bg-sage-light p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-purple mb-2">
              {bookingResult.status === "pending-approval" ? "Booking Request Submitted!" : "Booking Confirmed!"}
            </h2>
            <p className="text-slate-500 mb-6">{bookingResult.message}</p>
            {bookingResult.depositRequired > 0 && (
              <div className="bg-warning-light border border-warning rounded-lg p-4 mb-6 text-sm text-slate-800">
                <strong>Deposit Required:</strong> {formatCurrency(bookingResult.depositRequired)} — we'll be in touch
                with payment details.
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                resetBookingDraft();
                setStep("service");
              }}
            >
              Book Another Appointment
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
