import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { FieldError } from "@/src/components/ui/field-error";
import { useFormValidation, required } from "@/src/lib/useFormValidation";

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  // Sprint 1 enhancements
  priceType?: string;
  depositRequired?: boolean;
  depositAmount?: number;
  preBuffer?: number;
  postBuffer?: number;
  isOnlineBookable?: boolean;
  isApprovalRequired?: boolean;
  consentFormRequired?: boolean;
  isActive?: boolean;
}

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
  onSave: (service: Service) => void;
}

export function ServiceModal({ isOpen, onClose, service, onSave }: ServiceModalProps) {
  const [formData, setFormData] = useState<Partial<Service>>({});
  const { errors, validate, clearError, clearAll } = useFormValidation<Service>({
    name: required("Service name"),
    category: required("Category"),
  });

  useEffect(() => {
    if (isOpen) {
      clearAll();
      if (service) {
        setFormData(service);
      } else {
        setFormData({
          id: crypto.randomUUID(),
          name: "",
          description: "",
          duration: 30,
          price: 0,
          category: "",
          priceType: "fixed",
          depositRequired: false,
          depositAmount: 0,
          preBuffer: 0,
          postBuffer: 0,
          isOnlineBookable: true,
          isApprovalRequired: false,
          consentFormRequired: false,
        });
      }
    }
  }, [isOpen, service]);

  const handleChange = (field: keyof Service, value: string | number) => {
    clearError(field);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!validate(formData)) return;
    onSave(formData as Service);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{service ? "Edit Service" : "New Service"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name *
            </Label>
            <div className="col-span-3">
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                aria-invalid={!!errors.name}
              />
              <FieldError message={errors.name} />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category *
            </Label>
            <div className="col-span-3">
              <Input
                id="category"
                value={formData.category || ""}
                onChange={(e) => handleChange("category", e.target.value)}
                placeholder="e.g. Grooming, Spa, Add-ons"
                aria-invalid={!!errors.category}
              />
              <FieldError message={errors.category} />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price (GBP)
            </Label>
            <Input
              id="price"
              type="number"
              value={formData.price || 0}
              onChange={(e) => handleChange("price", Number(e.target.value))}
              className="col-span-3"
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">
              Duration (m)
            </Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration || 30}
              onChange={(e) => handleChange("duration", Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right mt-2">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              className="col-span-3"
              rows={3}
            />
          </div>

          {/* Pricing & Deposit Section */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-sm font-medium text-purple mb-3">Pricing & Deposits</h4>
            <div className="grid grid-cols-4 items-center gap-4 mb-3">
              <Label className="text-right text-sm">Price Type</Label>
              <div className="col-span-3 flex gap-2">
                {(["fixed", "variable", "from"] as const).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => handleChange("priceType" as any, pt)}
                    className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                      formData.priceType === pt
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {pt === "from" ? "From £" : pt.charAt(0).toUpperCase() + pt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4 mb-3">
              <Label className="text-right text-sm">Deposit</Label>
              <div className="col-span-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.depositRequired}
                    onChange={(e) => handleChange("depositRequired" as any, e.target.checked as any)}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  Required
                </label>
                {formData.depositRequired && (
                  <Input
                    type="number"
                    value={formData.depositAmount || 0}
                    onChange={(e) => handleChange("depositAmount" as any, Number(e.target.value))}
                    className="w-24"
                    placeholder="£"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Scheduling Section */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-sm font-medium text-purple mb-3">Scheduling</h4>
            <div className="grid grid-cols-4 items-center gap-4 mb-3">
              <Label className="text-right text-sm">Pre Buffer</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.preBuffer || 0}
                  onChange={(e) => handleChange("preBuffer" as any, Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-slate-500">min before</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4 mb-3">
              <Label className="text-right text-sm">Post Buffer</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.postBuffer || 0}
                  onChange={(e) => handleChange("postBuffer" as any, Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-slate-500">min after</span>
              </div>
            </div>
          </div>

          {/* Options Section */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-sm font-medium text-purple mb-3">Options</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isOnlineBookable !== false}
                  onChange={(e) => handleChange("isOnlineBookable" as any, e.target.checked as any)}
                  className="rounded border-slate-300 text-brand-600"
                />
                Available for online booking
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.isApprovalRequired}
                  onChange={(e) => handleChange("isApprovalRequired" as any, e.target.checked as any)}
                  className="rounded border-slate-300 text-brand-600"
                />
                Requires approval before confirming
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.consentFormRequired}
                  onChange={(e) => handleChange("consentFormRequired" as any, e.target.checked as any)}
                  className="rounded border-slate-300 text-brand-600"
                />
                Requires consent form
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Service</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
