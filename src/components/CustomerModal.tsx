import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Plus, X, Trash2, ShieldAlert, FileIcon, Upload } from "lucide-react";
import { Customer, Pet, Vaccination, Document } from "@/src/types";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (updatedCustomer: Customer) => void;
}

export function CustomerModal({ isOpen, onClose, customer, onSave }: CustomerModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'pets' | 'notes'>('info');
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [pets, setPets] = useState<Pet[]>([]);

  // State for a new pet being added
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [newPet, setNewPet] = useState<Partial<Pet>>({
    name: "", breed: "", weight: 0, dob: "", coatType: "", behavioralNotes: [], vaccinations: []
  });
  const [newBehavior, setNewBehavior] = useState("");
  const [newVaxName, setNewVaxName] = useState("");
  const [newVaxDate, setNewVaxDate] = useState("");
  const [newWarning, setNewWarning] = useState("");

  useEffect(() => {
    if (customer) {
      setFormData(customer);
      setPets(customer.pets || []);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        name: "",
        email: "",
        phone: "",
        address: "",
        emergencyContact: { name: "", phone: "" },
        notes: "",
        warnings: [],
        lastVisit: "Never",
        totalSpent: 0,
        documents: [],
      });
      setPets([]);
    }
    setActiveTab('info');
    setIsAddingPet(false);
  }, [customer, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("emergency_")) {
      const field = name.replace("emergency_", "");
      setFormData((prev) => ({
        ...prev,
        emergencyContact: {
          ...(prev.emergencyContact || { name: "", phone: "" }),
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAddPet = () => {
    if (newPet.name) {
      const petToAdd: Pet = {
        id: crypto.randomUUID(),
        name: newPet.name || "",
        breed: newPet.breed || "",
        weight: Number(newPet.weight) || 0,
        dob: newPet.dob || "",
        coatType: newPet.coatType || "",
        behavioralNotes: newPet.behavioralNotes || [],
        vaccinations: newPet.vaccinations || [],
      };
      setPets([...pets, petToAdd]);
      setNewPet({ name: "", breed: "", weight: 0, dob: "", coatType: "", behavioralNotes: [], vaccinations: [] });
      setIsAddingPet(false);
    }
  };

  const handleRemovePet = (petId: string) => {
    setPets(pets.filter((pet) => pet.id !== petId));
  };

  const handleAddBehavior = () => {
    if (newBehavior.trim()) {
      setNewPet(prev => ({
        ...prev,
        behavioralNotes: [...(prev.behavioralNotes || []), newBehavior.trim()]
      }));
      setNewBehavior("");
    }
  };

  const handleRemoveBehavior = (behaviorToRemove: string) => {
    setNewPet(prev => ({
      ...prev,
      behavioralNotes: (prev.behavioralNotes || []).filter(b => b !== behaviorToRemove)
    }));
  };

  const handleAddVax = () => {
    if (newVaxName.trim() && newVaxDate) {
      const isExpired = new Date(newVaxDate) < new Date();
      const newVax: Vaccination = {
        name: newVaxName.trim(),
        expiryDate: newVaxDate,
        status: isExpired ? 'expired' : 'valid'
      };
      setNewPet(prev => ({
        ...prev,
        vaccinations: [...(prev.vaccinations || []), newVax]
      }));
      setNewVaxName("");
      setNewVaxDate("");
    }
  };

  const handleRemoveVax = (vaxName: string) => {
    setNewPet(prev => ({
      ...prev,
      vaccinations: (prev.vaccinations || []).filter(v => v.name !== vaxName)
    }));
  };

  const handleAddWarning = () => {
    if (newWarning.trim()) {
      setFormData(prev => ({
        ...prev,
        warnings: [...(prev.warnings || []), newWarning.trim()]
      }));
      setNewWarning("");
    }
  };

  const handleRemoveWarning = (warningToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      warnings: (prev.warnings || []).filter(w => w !== warningToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, pets } as Customer);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('info')}
          >
            Client Info
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'pets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('pets')}
          >
            Pets ({pets.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'notes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes & Warnings
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right text-sm font-medium">Name *</label>
                <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right text-sm font-medium">Email *</label>
                <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right text-sm font-medium">Phone *</label>
                <Input id="phone" name="phone" type="tel" value={formData.phone || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="address" className="text-right text-sm font-medium">Address</label>
                <Input id="address" name="address" value={formData.address || ""} onChange={handleChange} className="col-span-3" />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-900 mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-4 items-center gap-4 mb-3">
                  <label htmlFor="emergency_name" className="text-right text-sm font-medium text-slate-500">Name</label>
                  <Input id="emergency_name" name="emergency_name" value={formData.emergencyContact?.name || ""} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="emergency_phone" className="text-right text-sm font-medium text-slate-500">Phone</label>
                  <Input id="emergency_phone" name="emergency_phone" value={formData.emergencyContact?.phone || ""} onChange={handleChange} className="col-span-3" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pets' && (
            <div className="space-y-4">
              {pets.length > 0 && !isAddingPet && (
                <div className="space-y-3">
                  {pets.map((pet) => (
                    <div key={pet.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-900">{pet.name}</div>
                        <div className="text-xs text-slate-500">{pet.breed} • {pet.weight} lbs</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemovePet(pet.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!isAddingPet ? (
                <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setIsAddingPet(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Pet
                </Button>
              ) : (
                <div className="p-4 border border-slate-200 rounded-lg space-y-4 bg-slate-50">
                  <h4 className="font-medium text-sm">New Pet Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Name *</label>
                      <Input value={newPet.name || ""} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Breed</label>
                      <Input value={newPet.breed || ""} onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Weight (lbs)</label>
                      <Input type="number" value={newPet.weight || ""} onChange={(e) => setNewPet({ ...newPet, weight: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">DOB</label>
                      <Input type="date" value={newPet.dob || ""} onChange={(e) => setNewPet({ ...newPet, dob: e.target.value })} />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-medium">Coat Type</label>
                      <Input value={newPet.coatType || ""} onChange={(e) => setNewPet({ ...newPet, coatType: e.target.value })} placeholder="e.g., Double Coat, Curly, Short" />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="text-xs font-medium text-slate-700">Behavioral Notes</label>
                    <div className="flex gap-2">
                      <Input
                        size={1}
                        className="h-8 text-sm"
                        value={newBehavior}
                        onChange={(e) => setNewBehavior(e.target.value)}
                        placeholder="e.g., Anxious, Biter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddBehavior();
                          }
                        }}
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={handleAddBehavior}>Add</Button>
                    </div>
                    {(newPet.behavioralNotes || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(newPet.behavioralNotes || []).map((note, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">
                            <span>{note}</span>
                            <button type="button" onClick={() => handleRemoveBehavior(note)} className="hover:text-amber-950" title="Remove behavior">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="text-xs font-medium text-slate-700">Vaccinations</label>
                    <div className="flex gap-2">
                      <Input
                        size={1}
                        className="h-8 text-sm flex-1"
                        value={newVaxName}
                        onChange={(e) => setNewVaxName(e.target.value)}
                        placeholder="Name (e.g., Rabies)"
                      />
                      <Input
                        type="date"
                        className="h-8 text-sm w-32"
                        value={newVaxDate}
                        onChange={(e) => setNewVaxDate(e.target.value)}
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={handleAddVax}>Add</Button>
                    </div>
                    {(newPet.vaccinations || []).length > 0 && (
                      <div className="space-y-1 pt-1">
                        {(newPet.vaccinations || []).map((vax, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 px-2 py-1 rounded text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{vax.name}</span>
                              <span className="text-slate-500">Exp: {vax.expiryDate}</span>
                              <div className={`h-1.5 w-1.5 rounded-full ${vax.status === 'valid' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </div>
                            <button type="button" onClick={() => handleRemoveVax(vax.name)} className="text-slate-400 hover:text-red-500" title="Remove vaccination">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingPet(false)}>Cancel</Button>
                    <Button type="button" size="sm" onClick={handleAddPet} disabled={!newPet.name}>Save Pet</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">General Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  placeholder="General preferences, favorite groomer, etc."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" /> Client Warnings
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newWarning}
                    onChange={(e) => setNewWarning(e.target.value)}
                    placeholder="e.g., Late cancellation risk"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddWarning();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddWarning}>Add</Button>
                </div>

                {(formData.warnings || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(formData.warnings || []).map((warning, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md text-sm">
                        <span>{warning}</span>
                        <button type="button" onClick={() => handleRemoveWarning(warning)} className="text-red-400 hover:text-red-600" title="Remove warning">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-6 border-t border-slate-100 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{customer ? "Save changes" : "Create Customer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
