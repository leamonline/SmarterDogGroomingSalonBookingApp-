import React from "react";
import { Scissors, CreditCard, Clock } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { formatCurrency } from "@/src/lib/utils";
import type { BookableService } from "./types";
import { hasDeposit, formatServicePrice } from "./types";

interface ServiceStepProps {
  services: BookableService[];
  selectedService: BookableService | null;
  authed: boolean;
  userEmail: string;
  onSelectService: (service: BookableService) => void;
  onSwitchAccount: () => void;
}

export function ServiceStep({ services, selectedService, authed, userEmail, onSelectService, onSwitchAccount }: ServiceStepProps) {
  return (
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
              <p className="text-sm text-slate-500">Your appointment details will be saved against this customer profile.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={onSwitchAccount}>
              Switch account
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map(svc => (
          <button
            key={svc.id}
            onClick={() => onSelectService(svc)}
            className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
              selectedService?.id === svc.id ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"
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
                  <CreditCard className="h-3.5 w-3.5" /> Price
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
                ? "We'll confirm your slot and collect the deposit after you submit the booking."
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
  );
}
