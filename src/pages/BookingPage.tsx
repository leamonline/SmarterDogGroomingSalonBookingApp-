import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Scissors, CheckCircle, ArrowRight } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { normalizeScheduleDays } from "@/src/lib/bookingSchedule";
import {
  ServiceStep,
  DateTimeStep,
  AuthStep,
  PetStep,
  ConfirmStep,
  DoneStep,
  publicFetch,
} from "./booking";
import type { BookableService, Step, PublicScheduleDay, BookingResult } from "./booking";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BookingPage() {
  const defaultDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [step, setStep] = useState<Step>("service");
  const [authed, setAuthed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");

  // Auth form state
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
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i + 1));

  // ── Check existing session via httpOnly cookie ──
  useEffect(() => {
    publicFetch("/api/public/me")
      .then((data) => {
        if (data?.email) {
          setAuthed(true);
          setUserEmail(data.email);
          setCustomerId(data.customerId || null);
        }
      })
      .catch(() => {
        // Not logged in — that's fine
      });
  }, []);

  // Load services and schedule
  useEffect(() => {
    publicFetch("/api/public/services")
      .then(setServices)
      .catch(() => setServices([]));

    fetch('/api/public/schedule')
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<Record<string, unknown>>) => {
        const map: Record<string, PublicScheduleDay> = {};
        normalizeScheduleDays(rows).forEach((row) => {
          map[row.day] = {
            isClosed: row.isClosed,
            availableSlots: row.slots.filter((slot) => slot.isAvailable).length,
          };
        });
        setSchedule(map);
      })
      .catch(() => {/* schedule not critical */});
  }, []);

  // Skip the next automatic slot fetch when findFirstAvailable already populated slots
  const skipNextSlotFetch = React.useRef(false);
  // Skip the auto-select-date useEffect when findFirstAvailable explicitly chose a date
  const skipAutoSelectDate = React.useRef(false);

  // Load slots when date or service changes
  useEffect(() => {
    if (selectedDate && selectedService) {
      // findFirstAvailableSlot already fetched and set slots/selectedSlot for this date;
      // skip the redundant refetch that would clear the selected slot.
      if (skipNextSlotFetch.current) {
        skipNextSlotFetch.current = false;
        return;
      }
      setLoadingSlots(true);
      setNoAvailability(false);
      publicFetch(`/api/public/available-slots?date=${selectedDate}&duration=${selectedService.duration}&dogCount=${dogCount}`)
        .then((data) => {
          const nextSlots = data.slots || [];
          setSlots(nextSlots);
          setSelectedSlot((current) => nextSlots.includes(current) ? current : "");
        })
        .catch(() => setSlots([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedDate, selectedService, dogCount]);

  // Auto-select first available date
  useEffect(() => {
    if (skipAutoSelectDate.current) {
      skipAutoSelectDate.current = false;
      return;
    }
    if (Object.keys(schedule).length === 0) return;
    const current = dates.find((date) => format(date, "yyyy-MM-dd") === selectedDate);
    if (current && !isDayDisabled(current)) return;
    const firstAvailableDate = dates.find((date) => !isDayDisabled(date));
    if (firstAvailableDate) {
      setSelectedDate(format(firstAvailableDate, "yyyy-MM-dd"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, selectedDate]);

  // ── Helpers ──
  const isDayDisabled = (d: Date) => {
    if (Object.keys(schedule).length === 0) return false;
    const dayName = DAY_NAMES[d.getDay()]!;
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

  // ── Auth handler ──
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

      setAuthed(true);
      setUserEmail(data.user.email);
      if (data.user.customerId) {
        setCustomerId(data.user.customerId);
      }
      setStep("pet");
      toast.success(isRegister ? "Account created!" : "Logged in!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  // ── Book ──
  const handleBook = async () => {
    if (isBooking) return;
    setIsBooking(true);
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
          customerId,
        }),
      });
      setBookingResult(result);
      setStep("done");
      toast.success(result.message);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setIsBooking(false);
    }
  };

  // ── Switch account ──
  const handleSwitchAccount = () => {
    publicFetch("/api/public/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setCustomerId(null);
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

  // ── Find first available ──
  const findFirstAvailableSlot = async () => {
    if (!selectedService) return;
    setFindingFirstAvailable(true);
    setNoAvailability(false);
    try {
      for (const date of dates) {
        const dateKey = format(date, "yyyy-MM-dd");
        const data = await publicFetch(`/api/public/available-slots?date=${dateKey}&duration=${selectedService.duration}&dogCount=${dogCount}`);
        const nextSlots = data.slots || [];
        if (nextSlots.length > 0) {
          // Prevent useEffects from overriding the date/slot we just selected
          skipNextSlotFetch.current = true;
          skipAutoSelectDate.current = true;
          setSelectedDate(dateKey);
          setSlots(nextSlots);
          setSelectedSlot(nextSlots[0]);
          setNoAvailability(false);
          toast.success(`Earliest slot selected for ${format(new Date(nextSlots[0]), "EEE d MMM • h:mm a")}`);
          return;
        }
      }
      setNoAvailability(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't find the earliest available slot.");
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
            {(["service", "datetime", "auth", "pet", "confirm"] as const).map((s, i) => {
              const labels = ["Service", "Date & Time", "Account", "Pet Details", "Confirm"];
              const shortLabels = ["Service", "Date", "Account", "Pet", "Confirm"];
              const stepOrder = ["service", "datetime", "auth", "pet", "confirm"];
              const current = stepOrder.indexOf(step);
              const thisIdx = i;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`flex-1 h-0.5 ${thisIdx <= current ? "bg-brand-600" : "bg-slate-200"}`} />}
                  <div
                    aria-label={`Step ${i + 1}: ${labels[i]}${thisIdx < current ? ' (completed)' : thisIdx === current ? ' (current)' : ''}`}
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      thisIdx < current ? "text-accent" :
                      thisIdx === current ? "text-purple" : "text-slate-400"
                    }`}>
                    {thisIdx < current ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        thisIdx === current ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}>{i + 1}</span>
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
        {step === "auth" && (
          <AuthStep
            isRegister={isRegister}
            email={email}
            password={password}
            firstName={firstName}
            lastName={lastName}
            phone={phone}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
            onPhoneChange={setPhone}
            onToggleRegister={() => setIsRegister(!isRegister)}
            onSubmit={handleAuth}
            onBack={() => setStep("service")}
          />
        )}

        {step === "service" && (
          <ServiceStep
            services={services}
            selectedService={selectedService}
            authed={authed}
            userEmail={userEmail}
            onSelectService={(svc) => { setSelectedService(svc); setSelectedSlot(""); setStep("datetime"); }}
            onSwitchAccount={handleSwitchAccount}
          />
        )}

        {step === "datetime" && selectedService && (
          <DateTimeStep
            selectedService={selectedService}
            dates={dates}
            selectedDate={selectedDate}
            slots={slots}
            selectedSlot={selectedSlot}
            loadingSlots={loadingSlots}
            findingFirstAvailable={findingFirstAvailable}
            noAvailability={noAvailability}
            dogCount={dogCount}
            authed={authed}
            isDayDisabled={isDayDisabled}
            onSelectDate={setSelectedDate}
            onSelectSlot={setSelectedSlot}
            onDogCountChange={(count) => { setDogCount(count); setSelectedSlot(""); setNoAvailability(false); }}
            onFindFirstAvailable={findFirstAvailableSlot}
            onContinue={() => setStep(authed ? "pet" : "auth")}
            onBack={() => setStep("service")}
          />
        )}

        {step === "pet" && (
          <PetStep
            dogCount={dogCount}
            petName={petName}
            breed={breed}
            petNotes={petNotes}
            onPetNameChange={setPetName}
            onBreedChange={setBreed}
            onPetNotesChange={setPetNotes}
            onContinue={() => setStep("confirm")}
            onBack={() => setStep("datetime")}
          />
        )}

        {step === "confirm" && selectedService && selectedSlot && (
          <ConfirmStep
            selectedService={selectedService}
            selectedSlot={selectedSlot}
            petName={petName}
            breed={breed}
            petNotes={petNotes}
            dogCount={dogCount}
            isBooking={isBooking}
            onConfirm={handleBook}
            onBack={() => setStep("pet")}
          />
        )}

        {step === "done" && bookingResult && (
          <DoneStep
            bookingResult={bookingResult}
            onBookAnother={() => { resetBookingDraft(); setStep("service"); }}
          />
        )}
      </main>
    </div>
  );
}
