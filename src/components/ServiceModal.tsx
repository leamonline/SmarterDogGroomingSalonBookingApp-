import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

export interface Service {
    id: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    category: string;
}

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service | null;
    onSave: (service: Service) => void;
}

export function ServiceModal({ isOpen, onClose, service, onSave }: ServiceModalProps) {
    const [formData, setFormData] = useState<Partial<Service>>({});

    useEffect(() => {
        if (isOpen) {
            if (service) {
                setFormData(service);
            } else {
                setFormData({
                    id: Math.random().toString(36).substring(2, 9),
                    name: "",
                    description: "",
                    duration: 30,
                    price: 0,
                    category: "",
                });
            }
        }
    }, [isOpen, service]);

    const handleChange = (field: keyof Service, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.category) {
            alert("Name and Category are required.");
            return;
        }
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
                        <Input
                            id="name"
                            value={formData.name || ""}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Category *
                        </Label>
                        <Input
                            id="category"
                            value={formData.category || ""}
                            onChange={(e) => handleChange("category", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Grooming, Spa, Add-ons"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">
                            Price ($)
                        </Label>
                        <Input
                            id="price"
                            type="number"
                            value={formData.price || 0}
                            onChange={(e) => handleChange("price", Number(e.target.value))}
                            className="col-span-3"
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
