import React from "react";
import { ArrowLeft, ArrowRight, Dog } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";

interface PetStepProps {
  dogCount: number;
  petName: string;
  breed: string;
  petNotes: string;
  onPetNameChange: (val: string) => void;
  onBreedChange: (val: string) => void;
  onPetNotesChange: (val: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function PetStep({
  dogCount, petName, breed, petNotes,
  onPetNameChange, onBreedChange, onPetNotesChange,
  onContinue, onBack,
}: PetStepProps) {
  const handleContinue = () => {
    if (!petName) {
      toast.error("Dog's name is required");
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple">{dogCount > 1 ? "Your Dogs' Details" : "Your Dog's Details"}</h2>
        <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto">
        <div className="flex justify-center">
          <Dog className="h-12 w-12 text-slate-300" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">{dogCount > 1 ? "Dog Name(s) *" : "Dog's Name *"}</label>
          <Input
            value={petName}
            onChange={e => onPetNameChange(e.target.value)}
            placeholder={dogCount > 1 ? "e.g. Buddy, Bella & Milo" : "e.g. Buddy"}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Breed</label>
          <Input value={breed} onChange={e => onBreedChange(e.target.value)} placeholder="e.g. Golden Retriever" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={petNotes}
            onChange={e => onPetNotesChange(e.target.value)}
            placeholder={dogCount > 1
              ? "List each dog plus any allergies, behaviour notes, or special requirements..."
              : "Any allergies, behaviour notes, or special requirements..."}
            className="w-full min-h-[80px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          />
        </div>
        <Button className="w-full" onClick={handleContinue}>
          Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
