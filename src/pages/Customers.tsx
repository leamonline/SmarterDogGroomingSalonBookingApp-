import React, { useState } from "react";
import { Plus, Search, MoreHorizontal, Calendar, DollarSign, Phone, Mail, Edit, Trash, CalendarPlus, MapPin, AlertTriangle, ShieldAlert, FileText } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Badge } from "@/src/components/ui/badge";
import { mockCustomers, mockAppointments } from "@/src/data/mockData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { format } from "date-fns";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { CustomerModal } from "@/src/components/CustomerModal";
import { Customer, Pet } from "@/src/types";

export function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDetailsModalOpen, setIsCustomerDetailsModalOpen] = useState(false);
  
  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [initialAppointmentData, setInitialAppointmentData] = useState<Partial<Appointment>>({});

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.pets.some((pet) => pet.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCustomerDetailsModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setInitialAppointmentData({});
    setIsAppointmentModalOpen(true);
  };

  const handleQuickBook = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedAppointment(null);
    setInitialAppointmentData({
      ownerName: customer.name,
      petName: customer.pets[0]?.name || "",
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

  const handleDeleteCustomer = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    const index = mockCustomers.findIndex(c => c.id === customerId);
    if (index !== -1) {
      mockCustomers.splice(index, 1);
    }
  };

  const handleSaveCustomer = (updatedCustomer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === updatedCustomer.id);
      if (exists) {
        return prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c));
      }
      return [...prev, updatedCustomer];
    });
    
    const index = mockCustomers.findIndex((c) => c.id === updatedCustomer.id);
    if (index !== -1) {
      mockCustomers[index] = updatedCustomer;
    } else {
      mockCustomers.push(updatedCustomer);
    }
    
    if (selectedCustomer?.id === updatedCustomer.id) {
      setSelectedCustomer(updatedCustomer);
    }
  };

  const handleSaveAppointment = (updatedAppointment: Appointment) => {
    setAppointments((prev) => {
      const exists = prev.some((apt) => apt.id === updatedAppointment.id);
      if (exists) {
        return prev.map((apt) => (apt.id === updatedAppointment.id ? updatedAppointment : apt));
      }
      return [...prev, updatedAppointment];
    });
    const index = mockAppointments.findIndex((a) => a.id === updatedAppointment.id);
    if (index !== -1) {
      mockAppointments[index] = updatedAppointment;
    } else {
      mockAppointments.push(updatedAppointment);
    }
  };

  const customerAppointments = selectedCustomer
    ? appointments.filter((apt) => apt.ownerName === selectedCustomer.name)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
        <Button onClick={handleAddCustomer}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search customers, emails, or pets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Filter</Button>
          <Button variant="outline">Export</Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Pets</TableHead>
              <TableHead>Last Visit</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow 
                key={customer.id} 
                className="cursor-pointer"
                onClick={() => handleRowClick(customer)}
              >
                <TableCell>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    {customer.name}
                    {customer.warnings && customer.warnings.length > 0 && (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
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
                  ${customer.totalSpent}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                        <span>Edit Customer</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => handleDeleteCustomer(e, customer.id)}>
                        <Trash className="mr-2 h-4 w-4" />
                        <span>Delete Customer</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCustomerDetailsModalOpen} onOpenChange={setIsCustomerDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                      {selectedCustomer.name}
                    </DialogTitle>
                    <DialogDescription>Customer Details and History</DialogDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    setIsCustomerDetailsModalOpen(false);
                    handleEditCustomer(e, selectedCustomer);
                  }}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                </div>
              </DialogHeader>
              
              {selectedCustomer.warnings && selectedCustomer.warnings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 my-2">
                  <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-red-800">Client Warnings</h4>
                    <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                      {selectedCustomer.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid gap-6 py-4 md:grid-cols-3">
                <div className="space-y-6 col-span-1">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Contact Information</h4>
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
                    </div>
                  </div>

                  {selectedCustomer.emergencyContact?.name && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <h4 className="text-sm font-semibold text-orange-900 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Emergency Contact
                      </h4>
                      <div className="text-sm text-orange-800 font-medium">{selectedCustomer.emergencyContact.name}</div>
                      <div className="text-sm text-orange-700">{selectedCustomer.emergencyContact.phone}</div>
                    </div>
                  )}

                  {selectedCustomer.notes && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> General Notes
                      </h4>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                    </div>
                  )}
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Account Summary</h4>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-700">
                        <Calendar className="mr-3 h-4 w-4 text-slate-400" />
                        Last Visit: {selectedCustomer.lastVisit}
                      </div>
                      <div className="flex items-center text-sm text-slate-700">
                        <DollarSign className="mr-3 h-4 w-4 text-slate-400" />
                        Total Spent: ${selectedCustomer.totalSpent}
                      </div>
                    </div>
                  </div>

                  {selectedCustomer.documents && selectedCustomer.documents.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Documents</h4>
                      <div className="space-y-2">
                        {selectedCustomer.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg">
                            <div className="bg-indigo-50 p-1.5 rounded text-indigo-600">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">{doc.name}</div>
                              <div className="text-xs text-slate-500">{doc.uploadDate}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-3">Pets</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedCustomer.pets.map((pet) => (
                        <div key={pet.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-bold text-lg text-slate-900">{pet.name}</h5>
                            <Badge variant="secondary">{pet.breed}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-4">
                            <div><span className="text-slate-400">Weight:</span> {pet.weight} lbs</div>
                            {pet.dob && <div><span className="text-slate-400">DOB:</span> {pet.dob}</div>}
                            {pet.coatType && <div><span className="text-slate-400">Coat:</span> {pet.coatType}</div>}
                          </div>

                          {pet.behavioralNotes && pet.behavioralNotes.length > 0 && (
                            <div className="mb-4">
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Behavior</div>
                              <div className="flex flex-wrap gap-1">
                                {pet.behavioralNotes.map((note, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    {note}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {pet.vaccinations && pet.vaccinations.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Vaccinations</div>
                              <div className="space-y-1.5">
                                {pet.vaccinations.map((vax, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-700">{vax.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">{vax.expiryDate}</span>
                                      <div className={`h-2 w-2 rounded-full ${vax.status === 'valid' ? 'bg-emerald-500' : 'bg-red-500'}`} title={vax.status} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-slate-900">Appointment History</h4>
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
                            className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center justify-between font-medium text-slate-900">
                              <span className="text-base">{apt.service} <span className="text-slate-500 font-normal text-sm">({apt.petName})</span></span>
                              <span className="font-semibold text-indigo-600">${apt.price}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                {format(apt.date, "MMM d, yyyy 'at' h:mm a")}
                              </span>
                              <Badge variant={apt.status === "completed" ? "default" : "secondary"} className="capitalize">
                                {apt.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">No past appointments found.</div>
                    )}
                  </div>
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
    </div>
  );
}
