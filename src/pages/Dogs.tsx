import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronDown,
  Dog as DogIcon,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/src/lib/api";
import { handleError } from "@/src/lib/handleError";
import { formatCurrency } from "@/src/lib/utils";
import type { AppointmentSummary, Customer, DogProfile, DogSummary } from "@/src/types";
import { AppointmentModal, type Appointment } from "@/src/components/AppointmentModal";
import { ClientMessagingPanel } from "@/src/components/ClientMessagingPanel";
import { CustomerModal } from "@/src/components/CustomerModal";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { CustomersSkeleton } from "@/src/components/ui/skeleton";
import {
  formatDogCountLabel,
  formatDogCountReviewNote,
  isDogCountConfirmed,
  normalizeAppointment,
} from "@/src/lib/appointmentUtils";

const PAGE_SIZE = 50;

function isMatchingDog(dog: DogSummary, searchTerm: string) {
  const normalized = searchTerm.toLowerCase();
  return (
    dog.name.toLowerCase().includes(normalized) ||
    dog.breed.toLowerCase().includes(normalized) ||
    dog.customerName.toLowerCase().includes(normalized) ||
    (dog.customerPhone || "").toLowerCase().includes(normalized)
  );
}

export function Dogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [selectedDog, setSelectedDog] = useState<DogProfile | null>(null);
  const [isDogDialogOpen, setIsDogDialogOpen] = useState(false);
  const [loadingDogDetail, setLoadingDogDetail] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [initialAppointmentData, setInitialAppointmentData] = useState<Partial<Appointment>>({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [totalDogs, setTotalDogs] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const loadDogs = useCallback(async (targetPage: number, replace: boolean) => {
    const setBusy = replace ? setLoading : setLoadingMore;
    setBusy(true);
    try {
      const json = await api.getDogsPage(targetPage, PAGE_SIZE);
      const items: DogSummary[] = json.data ?? json;
      const total: number = json.pagination?.total ?? items.length;
      setDogs((prev) => (replace ? items : [...prev, ...items]));
      setTotalDogs(total);
      setHasMore(targetPage * PAGE_SIZE < total);
      setPage(targetPage);
    } catch (err: any) {
      toast.error(err.message || "Failed to load dogs");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadDogDetail = useCallback(async (dogId: string) => {
    setLoadingDogDetail(true);
    try {
      const dog = await api.getDog(dogId);
      setSelectedDog(dog);
      setIsDogDialogOpen(true);
    } catch (err) {
      handleError(err, "Failed to load dog profile");
    } finally {
      setLoadingDogDetail(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [, appointmentData] = await Promise.all([loadDogs(1, true), api.getAppointments()]);
        setAppointments(appointmentData.map((appointment: any) => normalizeAppointment(appointment)));
      } catch (err) {
        handleError(err, "Failed to load dogs");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [loadDogs]);

  useEffect(() => {
    const dogId = location.state?.dogId as string | undefined;
    if (!dogId) return;

    const existingDog = dogs.find((dog) => dog.id === dogId);
    if (existingDog) {
      loadDogDetail(existingDog.id);
      window.history.replaceState({}, document.title);
      return;
    }

    if (!loading) {
      loadDogDetail(dogId);
      window.history.replaceState({}, document.title);
    }
  }, [dogs, loadDogDetail, loading, location.state]);

  const filteredDogs = useMemo(() => dogs.filter((dog) => isMatchingDog(dog, searchTerm)), [dogs, searchTerm]);

  const handleQuickBook = useCallback((dog: DogSummary | DogProfile) => {
    setSelectedAppointment(null);
    setInitialAppointmentData({
      ownerName: dog.customerName,
      petName: dog.name,
      breed: dog.breed,
      phone: dog.customerPhone || "",
      customerId: dog.customerId,
      dogId: dog.id,
    });
    setIsAppointmentModalOpen(true);
  }, []);

  const handleOpenMessaging = useCallback(
    (dog: DogSummary | DogProfile) => {
      navigate("/messaging", {
        state: {
          customerId: dog.customerId,
          dogId: dog.id,
        },
      });
    },
    [navigate],
  );

  const handleOpenClient = useCallback(
    (customerId: string) => {
      navigate("/clients", { state: { customerId } });
    },
    [navigate],
  );

  const handleOpenCustomerEditor = useCallback(async (customerId?: string) => {
    if (!customerId) {
      setCustomerToEdit(null);
      setIsCustomerModalOpen(true);
      return;
    }

    try {
      const customer = await api.getCustomer(customerId);
      setCustomerToEdit(customer);
      setIsCustomerModalOpen(true);
    } catch (err) {
      handleError(err, "Failed to load client record");
    }
  }, []);

  const handleSaveCustomer = useCallback(
    async (updatedCustomer: Customer) => {
      try {
        const exists = Boolean(updatedCustomer.id && updatedCustomer.id.length > 0 && customerToEdit);
        if (exists) {
          await api.updateCustomer(updatedCustomer.id, updatedCustomer);
        } else {
          await api.createCustomer(updatedCustomer);
        }

        await loadDogs(1, true);
        if (
          selectedDog &&
          (selectedDog.customerId === updatedCustomer.id || selectedDog.customerId === customerToEdit?.id)
        ) {
          await loadDogDetail(selectedDog.id);
        }
        return true;
      } catch (err) {
        handleError(err, "Failed to save client");
        return false;
      }
    },
    [customerToEdit, loadDogDetail, loadDogs, selectedDog],
  );

  const handleSaveAppointment = useCallback(
    async (updatedAppointment: Appointment) => {
      try {
        const exists = appointments.some((appointment) => appointment.id === updatedAppointment.id);
        const savedAppointment = normalizeAppointment(
          exists
            ? await api.updateAppointment(updatedAppointment.id, updatedAppointment)
            : await api.createAppointment(updatedAppointment),
        );
        if (exists) {
          setAppointments((prev) =>
            prev.map((appointment) => (appointment.id === updatedAppointment.id ? savedAppointment : appointment)),
          );
        } else {
          setAppointments((prev) => [...prev, savedAppointment]);
        }
        return true;
      } catch (err) {
        handleError(err, "Failed to save appointment");
        return false;
      }
    },
    [appointments],
  );

  const dogAppointments = useMemo(() => {
    if (!selectedDog) return [];
    const detailAppointments = selectedDog.recentAppointments?.map((appointment: AppointmentSummary) => ({
      ...appointment,
      date: new Date(appointment.date),
      dogCount: appointment.dogCount ?? 1,
      dogCountConfirmed: isDogCountConfirmed(appointment.dogCountConfirmed),
    }));

    if (detailAppointments?.length) {
      return detailAppointments;
    }

    return appointments.filter(
      (appointment) =>
        appointment.dogId === selectedDog.id ||
        (!appointment.dogId &&
          appointment.petName === selectedDog.name &&
          appointment.customerId === selectedDog.customerId),
    );
  }, [appointments, selectedDog]);

  if (loading) {
    return <CustomersSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple">Dogs</h1>
          <p className="text-sm text-slate-500">
            Search dog profiles, jump into bookings, and keep the owner context close.
          </p>
        </div>
        <Button onClick={() => handleOpenCustomerEditor()}>
          <DogIcon className="mr-2 h-4 w-4" />
          Add Client & Dog
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search dogs, breeds, owners, or phone numbers..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filteredDogs.length}</span>
          {searchTerm ? " matches in loaded data" : ` of ${totalDogs} dogs`}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dog</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Breed</TableHead>
              <TableHead>Last Appointment</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <div className="rounded-full bg-slate-100 p-3">
                      <DogIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">No dogs found</p>
                    <p className="text-sm text-slate-500">Try a different search or add a new client and dog.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDogs.map((dog) => (
                <TableRow key={dog.id} className="cursor-pointer" onClick={() => loadDogDetail(dog.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      {dog.name}
                      {dog.approvalRequired ? <ShieldAlert className="h-4 w-4 text-coral" /> : null}
                    </div>
                    {dog.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dog.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-slate-900">{dog.customerName}</div>
                    <div className="text-xs text-slate-400">
                      {dog.customerPhone || dog.customerEmail || "No contact saved"}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{dog.breed}</TableCell>
                  <TableCell className="text-slate-600">
                    {dog.lastAppointmentDate
                      ? format(new Date(dog.lastAppointmentDate), "MMM d, yyyy")
                      : "No history yet"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">{dog.appointmentCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleQuickBook(dog)}>
                          <CalendarPlus className="mr-2 h-4 w-4" />
                          Quick Book
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenClient(dog.customerId)}>
                          <UserRound className="mr-2 h-4 w-4" />
                          Open Client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenMessaging(dog)}>
                          <Mail className="mr-2 h-4 w-4" />
                          Message Owner
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && !searchTerm ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDogs(page + 1, false)}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Load more ({totalDogs - dogs.length} remaining)
              </>
            )}
          </Button>
        </div>
      ) : null}

      <Dialog open={isDogDialogOpen} onOpenChange={setIsDogDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDog?.name || "Dog profile"}</DialogTitle>
            <DialogDescription>
              Dog profile, linked owner details, booking history, and message thread.
            </DialogDescription>
          </DialogHeader>

          {loadingDogDetail ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading dog profile...</div>
          ) : selectedDog ? (
            <div className="grid gap-6 py-2 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedDog.name}</h3>
                      <p className="text-sm text-slate-500">{selectedDog.breed}</p>
                    </div>
                    <Badge variant="secondary">
                      {selectedDog.appointmentCount} booking{selectedDog.appointmentCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    {selectedDog.dob ? (
                      <div>
                        <span className="font-medium text-slate-900">DOB:</span> {selectedDog.dob}
                      </div>
                    ) : null}
                    {selectedDog.weight ? (
                      <div>
                        <span className="font-medium text-slate-900">Weight:</span> {selectedDog.weight} lbs
                      </div>
                    ) : null}
                    {selectedDog.coatType ? (
                      <div>
                        <span className="font-medium text-slate-900">Coat:</span> {selectedDog.coatType}
                      </div>
                    ) : null}
                    {selectedDog.lastAppointmentDate ? (
                      <div>
                        <span className="font-medium text-slate-900">Last visit:</span>{" "}
                        {format(new Date(selectedDog.lastAppointmentDate), "MMM d, yyyy")}
                      </div>
                    ) : null}
                  </div>
                  {selectedDog.tags?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedDog.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Linked owner</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="font-medium text-slate-900">
                      {selectedDog.customer?.name || selectedDog.customerName}
                    </div>
                    {selectedDog.customer?.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {selectedDog.customer.phone}
                      </div>
                    ) : null}
                    {selectedDog.customer?.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {selectedDog.customer.email}
                      </div>
                    ) : null}
                    {selectedDog.customer?.warnings?.length ? (
                      <div className="rounded-lg border border-coral/20 bg-coral-light p-3 text-coral">
                        {selectedDog.customer.warnings.join(" • ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenClient(selectedDog.customerId)}>
                      <UserRound className="mr-1.5 h-3.5 w-3.5" />
                      Open Client
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCustomerEditor(selectedDog.customerId)}
                    >
                      Edit Record
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
                  <div className="mt-3 grid gap-2">
                    <Button onClick={() => handleQuickBook(selectedDog)}>
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Book {selectedDog.name}
                    </Button>
                    <Button variant="outline" onClick={() => handleOpenMessaging(selectedDog)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Open Messaging
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Care notes</h3>
                  {selectedDog.behavioralNotes?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDog.behavioralNotes.map((note) => (
                        <Badge key={note} variant="secondary">
                          {note}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No behavioral notes saved yet.</p>
                  )}

                  <h3 className="mt-5 text-sm font-semibold text-slate-900">Vaccinations</h3>
                  {selectedDog.vaccinations?.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedDog.vaccinations.map((vaccination) => (
                        <div
                          key={`${vaccination.name}-${vaccination.expiryDate}`}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-900">{vaccination.name}</span>
                          <span className="text-slate-500">{vaccination.expiryDate}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No vaccination records saved yet.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Booking history</h3>
                    <Badge variant="outline">{dogAppointments.length} entries</Badge>
                  </div>
                  {dogAppointments.length ? (
                    <div className="mt-3 space-y-2">
                      {dogAppointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{appointment.service}</p>
                              <p className="text-sm text-slate-500">
                                {format(appointment.date, "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {appointment.status}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                            <span>{appointment.duration} mins</span>
                            <span className="font-medium text-slate-900">{formatCurrency(appointment.price || 0)}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{formatDogCountLabel(appointment.dogCount)}</Badge>
                            {appointment.dogCountConfirmed === false ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                Dog count review needed
                              </Badge>
                            ) : null}
                          </div>
                          {appointment.dogCountConfirmed !== false &&
                            (() => {
                              const reviewNote = formatDogCountReviewNote(
                                appointment.dogCountReviewedAt,
                                appointment.dogCountReviewedBy,
                              );
                              return reviewNote ? (
                                <p className="mt-2 text-xs font-medium text-brand-700">{reviewNote}</p>
                              ) : null;
                            })()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No bookings linked to this dog yet.</p>
                  )}
                </div>

                <ClientMessagingPanel
                  customer={{
                    id: selectedDog.customerId,
                    name: selectedDog.customer?.name || selectedDog.customerName,
                    email: selectedDog.customer?.email || selectedDog.customerEmail || "",
                    phone: selectedDog.customer?.phone || selectedDog.customerPhone || "",
                    pets: selectedDog.customer?.pets || [],
                  }}
                  highlightedPetName={selectedDog.name}
                  title="Owner messaging"
                  description="Messages stay linked to the owner while keeping this dog's context visible."
                />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">Select a dog to view their profile.</div>
          )}
        </DialogContent>
      </Dialog>

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        appointment={selectedAppointment}
        initialData={initialAppointmentData}
        onSave={handleSaveAppointment}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={customerToEdit}
        onSave={handleSaveCustomer}
      />
    </div>
  );
}
