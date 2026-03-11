import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { handleError } from "@/src/lib/handleError";
import {
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  Edit,
  Trash,
  CalendarPlus,
  MapPin,
  ShieldAlert,
  ChevronDown,
  Users,
  Dog as DogIcon,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Badge } from "@/src/components/ui/badge";
import { api } from "@/src/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { CustomerModal } from "@/src/components/CustomerModal";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { Customer, Pet } from "@/src/types";
import { formatCurrency } from "@/src/lib/utils";
import { CustomersSkeleton } from "@/src/components/ui/skeleton";
import { ClientMessagingPanel } from "@/src/components/ClientMessagingPanel";

function formatDogCountLabel(dogCount?: number) {
  const count = dogCount || 1;
  return `${count} ${count === 1 ? "dog" : "dogs"}`;
}

function formatDogCountReviewNote(reviewedAt?: string, reviewedBy?: string) {
  if (!reviewedAt) return null;
  const parsed = new Date(reviewedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Confirmed by ${reviewedBy || "staff"} on ${format(parsed, "d MMM yyyy 'at' h:mm a")}`;
}

function isDogCountConfirmed(value: unknown) {
  return value === true || value === 1;
}

function normalizeAppointment(item: any): Appointment {
  return {
    ...item,
    date: item.date instanceof Date ? item.date : new Date(item.date),
    dogCount: item.dogCount ?? 1,
    dogCountConfirmed: isDogCountConfirmed(item.dogCountConfirmed),
  };
}

export function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDetailsModalOpen, setIsCustomerDetailsModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [initialAppointmentData, setInitialAppointmentData] = useState<Partial<Appointment>>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  // Debounced search — local filter on loaded pages; fresh fetch on cleared search

  const location = useLocation();
  const navigate = useNavigate();

  const loadCustomers = useCallback(async (targetPage: number, replace: boolean) => {
    const setter = replace ? setLoading : setLoadingMore;
    setter(true);
    try {
      const json = await api.getCustomersPage(targetPage, PAGE_SIZE);
      const items: Customer[] = json.data ?? json;
      const total: number = json.pagination?.total ?? items.length;
      setTotalCustomers(total);
      setHasMore(targetPage * PAGE_SIZE < total);
      setCustomers((prev) => (replace ? items : [...prev, ...items]));
      setPage(targetPage);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients");
    } finally {
      setter(false);
    }
  }, []);

  const loadMore = () => loadCustomers(page + 1, false);

  useEffect(() => {
    async function loadData() {
      try {
        const [, aptData] = await Promise.all([loadCustomers(1, true), api.getAppointments()]);
        setAppointments(aptData.map((a: any) => normalizeAppointment(a)));
      } catch (err) {
        handleError(err, "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [loadCustomers]);

  useEffect(() => {
    const targetCustomerId = location.state?.customerId;
    if (!targetCustomerId) return;

    const targetCustomer = customers.find((customer) => customer.id === targetCustomerId);
    if (targetCustomer) {
      setSelectedCustomer(targetCustomer);
      setIsCustomerDetailsModalOpen(true);
      window.history.replaceState({}, document.title);
      return;
    }

    if (!loading) {
      api
        .getCustomer(targetCustomerId)
        .then((customer) => {
          setCustomers((prev) => (prev.some((existing) => existing.id === customer.id) ? prev : [customer, ...prev]));
          setSelectedCustomer(customer);
          setIsCustomerDetailsModalOpen(true);
        })
        .catch((err) => handleError(err, "Failed to load client"))
        .finally(() => {
          window.history.replaceState({}, document.title);
        });
    }
  }, [customers, loading, location.state]);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.pets && customer.pets.some((pet) => pet.name.toLowerCase().includes(searchTerm.toLowerCase()))),
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCustomerDetailsModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setInitialAppointmentData({});
    setIsAppointmentModalOpen(true);
  };

  const handleOpenDogProfile = (petId: string) => {
    navigate("/dogs", { state: { dogId: petId } });
  };

  const handleOpenMessaging = (customer: Customer) => {
    navigate("/messaging", { state: { customerId: customer.id } });
  };

  const handleQuickBook = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedAppointment(null);
    setInitialAppointmentData({
      ownerName: customer.name,
      petName: customer.pets[0]?.name || "",
      breed: customer.pets[0]?.breed || "",
      phone: customer.phone || "",
      customerId: customer.id,
      dogId: customer.pets[0]?.id || undefined,
    });
    setIsAppointmentModalOpen(true);
  };

  const handleEditCustomer = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setCustomerToEdit(customer);
    setIsCustomerEditModalOpen(true);
  };

  const handleAddCustomer = () => {
    setCustomerToEdit(null);
    setIsCustomerEditModalOpen(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await api.deleteCustomer(customerToDelete);
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete));
      if (selectedCustomer?.id === customerToDelete) {
        setSelectedCustomer(null);
        setIsCustomerDetailsModalOpen(false);
      }
      toast.success("Client deleted.");
    } catch (err: any) {
      handleError(err, "Failed to delete customer");
    } finally {
      setCustomerToDelete(null);
    }
  };

  const handleDeleteCustomer = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    setCustomerToDelete(customerId);
  };

  const handleSaveCustomer = async (updatedCustomer: Customer) => {
    try {
      const exists = customers.some((c) => c.id === updatedCustomer.id);
      if (exists) {
        await api.updateCustomer(updatedCustomer.id, updatedCustomer);
        setCustomers((prev) => prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)));
        if (selectedCustomer?.id === updatedCustomer.id) {
          setSelectedCustomer(updatedCustomer);
        }
      } else {
        const savedCustomer = await api.createCustomer(updatedCustomer);
        setCustomers((prev) => [...prev, savedCustomer]);
      }
      return true;
    } catch (err) {
      handleError(err, "Failed to save client");
      return false;
    }
  };

  const handleSaveAppointment = async (updatedAppointment: Appointment) => {
    try {
      const exists = appointments.some((apt) => apt.id === updatedAppointment.id);
      const savedAppointment = normalizeAppointment(
        exists
          ? await api.updateAppointment(updatedAppointment.id, updatedAppointment)
          : await api.createAppointment(updatedAppointment),
      );
      if (exists) {
        setAppointments((prev) => prev.map((apt) => (apt.id === updatedAppointment.id ? savedAppointment : apt)));
      } else {
        setAppointments((prev) => [...prev, savedAppointment]);
      }
      return true;
    } catch (err: any) {
      const suggestions: string[] = err?.details?.suggestions || [];
      if (suggestions.length > 0) {
        toast.error(
          `${err.message} Next openings: ${suggestions.map((s) => format(new Date(s), "EEE h:mm a")).join(", ")}`,
        );
      } else {
        handleError(err, "Failed to save appointment");
      }
      return false;
    }
  };

  const customerAppointments = selectedCustomer
    ? appointments.filter(
        (apt) => apt.customerId === selectedCustomer.id || (!apt.customerId && apt.ownerName === selectedCustomer.name),
      )
    : [];

  if (loading) return <CustomersSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple">Clients</h1>
          <p className="text-sm text-slate-500">Owner records with linked dogs, bookings, and recent messages.</p>
        </div>
        <Button onClick={handleAddCustomer}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search clients, emails, or dogs..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Dogs</TableHead>
              <TableHead>Last Visit</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <div className="rounded-full bg-slate-100 p-3">
                      <Users className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">No clients found</p>
                    <p className="text-sm text-slate-500">Try a different search term or add a new client.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="cursor-pointer" onClick={() => handleRowClick(customer)}>
                  <TableCell>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {customer.name}
                      {customer.warnings && customer.warnings.length > 0 && (
                        <ShieldAlert className="h-4 w-4 text-coral" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-500">{customer.email}</div>
                    <div className="text-xs text-slate-400">{customer.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {customer.pets.map((pet) => (
                        <Badge key={pet.id} variant="secondary">
                          {pet.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{customer.lastVisit}</TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatCurrency(customer.totalSpent)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => handleQuickBook(e, customer)}>
                          <CalendarPlus className="mr-2 h-4 w-4" />
                          <span>Quick Book</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleEditCustomer(e, customer)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Client</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-coral focus:text-coral"
                          onClick={(e) => handleDeleteCustomer(e, customer.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          <span>Delete Client</span>
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

      {/* Load More */}
      {hasMore && !searchTerm && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="gap-2">
            {loadingMore ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Load more ({totalCustomers - customers.length} remaining)
              </>
            )}
          </Button>
        </div>
      )}

      <Dialog open={isCustomerDetailsModalOpen} onOpenChange={setIsCustomerDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="text-2xl flex items-center gap-2">{selectedCustomer.name}</DialogTitle>
                    <DialogDescription>Client profile, dogs, booking history, and conversation</DialogDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      setIsCustomerDetailsModalOpen(false);
                      handleEditCustomer(e, selectedCustomer);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                </div>
              </DialogHeader>

              {selectedCustomer.warnings && selectedCustomer.warnings.length > 0 && (
                <div className="bg-coral-light border border-coral/30 rounded-lg p-3 flex items-start gap-3 my-2">
                  <ShieldAlert className="h-5 w-5 text-coral mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-coral">Client Warnings</h4>
                    <ul className="list-disc list-inside text-sm text-coral/80 mt-1">
                      {selectedCustomer.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid gap-6 py-4 md:grid-cols-3">
                <div className="space-y-6 col-span-1">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-700">
                        <Mail className="mr-3 h-4 w-4 text-slate-400" />
                        {selectedCustomer.email}
                      </div>
                      <div className="flex items-center text-sm text-slate-700">
                        <Phone className="mr-3 h-4 w-4 text-slate-400" />
                        {selectedCustomer.phone}
                      </div>
                      {selectedCustomer.address && (
                        <div className="flex items-start text-sm text-slate-700">
                          <MapPin className="mr-3 h-4 w-4 text-slate-400 mt-0.5" />
                          <span className="leading-tight">{selectedCustomer.address}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-slate-700">
                        <Calendar className="mr-3 h-4 w-4 text-slate-400" />
                        Last: {selectedCustomer.lastVisit}
                      </div>
                      <div className="flex items-center text-sm text-slate-700">
                        <DollarSign className="mr-3 h-4 w-4 text-slate-400" />
                        {formatCurrency(selectedCustomer.totalSpent)} total
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.notes && (
                    <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
                      <p className="text-sm text-brand-700 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-6">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-slate-900">Dogs</h4>
                      <Button variant="outline" size="sm" onClick={() => handleOpenMessaging(selectedCustomer)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Messaging
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedCustomer.pets.map((pet) => (
                        <div key={pet.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-bold text-lg text-slate-900">{pet.name}</h5>
                            <Badge variant="secondary">{pet.breed}</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-4">
                            <div>
                              <span className="text-slate-400">Weight:</span> {pet.weight} lbs
                            </div>
                            {pet.dob && (
                              <div>
                                <span className="text-slate-400">DOB:</span> {pet.dob}
                              </div>
                            )}
                            {pet.coatType && (
                              <div>
                                <span className="text-slate-400">Coat:</span> {pet.coatType}
                              </div>
                            )}
                          </div>

                          {pet.behavioralNotes && pet.behavioralNotes.length > 0 && (
                            <div className="mb-4">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Behavior
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {pet.behavioralNotes.map((note, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                                  >
                                    {note}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {pet.vaccinations && pet.vaccinations.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Vaccinations
                              </div>
                              <div className="space-y-1.5">
                                {pet.vaccinations.map((vax, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-700">{vax.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">{vax.expiryDate}</span>
                                      <div
                                        className={`h-2 w-2 rounded-full ${vax.status === "valid" ? "bg-accent" : "bg-coral"}`}
                                        title={vax.status}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenDogProfile(pet.id)}>
                              <DogIcon className="mr-1.5 h-3.5 w-3.5" />
                              Dog Profile
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleQuickBook(e, { ...selectedCustomer, pets: [pet] })}
                            >
                              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                              Book {pet.name}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-slate-900">Booking History</h4>
                      <Button variant="outline" size="sm" onClick={(e) => handleQuickBook(e, selectedCustomer)}>
                        <CalendarPlus className="mr-2 h-4 w-4" /> Book
                      </Button>
                    </div>
                    {customerAppointments.length > 0 ? (
                      <div className="space-y-3">
                        {customerAppointments.map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => handleAppointmentClick(apt)}
                            className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center justify-between font-medium text-slate-900">
                              <span className="text-base">
                                {apt.service}{" "}
                                <span className="text-slate-500 font-normal text-sm">({apt.petName})</span>
                              </span>
                              <span className="font-semibold text-brand-600">{formatCurrency(apt.price)}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                {format(apt.date, "MMM d, yyyy 'at' h:mm a")}
                              </span>
                              <Badge
                                variant={apt.status === "completed" ? "default" : "secondary"}
                                className="capitalize"
                              >
                                {apt.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{formatDogCountLabel(apt.dogCount)}</Badge>
                              {apt.dogCountConfirmed === false ? (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                  Dog count review needed
                                </Badge>
                              ) : null}
                            </div>
                            {apt.dogCountConfirmed !== false &&
                              (() => {
                                const reviewNote = formatDogCountReviewNote(
                                  apt.dogCountReviewedAt,
                                  apt.dogCountReviewedBy,
                                );
                                return reviewNote ? (
                                  <p className="text-xs font-medium text-brand-700">{reviewNote}</p>
                                ) : null;
                              })()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        No past appointments found.
                      </div>
                    )}
                  </div>

                  <ClientMessagingPanel
                    customer={selectedCustomer}
                    title="Client conversation"
                    description="Recent messages and quick updates for this client."
                  />
                </div>
              </div>
            </>
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
        isOpen={isCustomerEditModalOpen}
        onClose={() => setIsCustomerEditModalOpen(false)}
        customer={customerToEdit}
        onSave={handleSaveCustomer}
      />

      <ConfirmDialog
        isOpen={!!customerToDelete}
        title="Delete Client"
        description="Are you sure you want to delete this client? All their dogs, appointments, and data will be permanently removed. This action cannot be undone."
        confirmText="Delete Client"
        onConfirm={confirmDeleteCustomer}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
