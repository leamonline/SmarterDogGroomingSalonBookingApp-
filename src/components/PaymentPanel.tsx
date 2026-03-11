import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { CreditCard, Banknote, Building2, Plus, Receipt, Printer } from "lucide-react";
import type { Payment } from "@/src/types";
import { formatCurrency } from "@/src/lib/utils";

interface PaymentPanelProps {
  appointmentId: string;
  totalDue: number;
  depositRequired?: number;
  onPaymentRecorded?: () => void;
}

const METHOD_ICONS: Record<string, any> = {
  card: CreditCard,
  cash: Banknote,
  "bank-transfer": Building2,
};

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  "bank-transfer": "Bank Transfer",
};

const TYPE_COLOURS: Record<string, string> = {
  deposit: "bg-brand-50 text-brand-800",
  full: "bg-sage-light text-brand-700",
  partial: "bg-sky-light text-brand-700",
  refund: "bg-coral-light text-coral",
  "partial-refund": "bg-orange-100 text-orange-800",
};

const formatMoney = (amount: number) => formatCurrency(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PaymentPanel({ appointmentId, totalDue, depositRequired, onPaymentRecorded }: PaymentPanelProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("card");
  const [type, setType] = useState<string>("full");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [appointmentId]);

  const loadPayments = async () => {
    try {
      const data = await api.getPayments(appointmentId);
      setPayments(Array.isArray(data) ? data : data.data || []);
    } catch {
      // Payments might not exist yet
      setPayments([]);
    }
  };

  const totalPaid = payments
    .filter((p) => p.type !== "refund" && p.type !== "partial-refund")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunded = payments
    .filter((p) => p.type === "refund" || p.type === "partial-refund")
    .reduce((sum, p) => sum + p.amount, 0);

  const balance = totalDue - totalPaid + totalRefunded;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      await api.createPayment({
        appointmentId,
        amount: Number(amount),
        method,
        type,
        notes: notes || null,
      });
      toast.success(`${formatMoney(Number(amount))} ${type} payment recorded`);
      setAmount("");
      setNotes("");
      setShowForm(false);
      loadPayments();
      onPaymentRecorded?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    const receiptWindow = window.open("", "_blank", "width=400,height=600");
    if (!receiptWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; max-width: 350px; margin: 20px auto; padding: 20px; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
          .header h1 { font-size: 18px; margin: 0 0 4px; }
          .header p { margin: 2px 0; color: #666; font-size: 11px; }
          .line-item { display: flex; justify-content: space-between; padding: 4px 0; }
          .divider { border-top: 1px dashed #999; margin: 8px 0; }
          .total { font-weight: bold; font-size: 15px; }
          .payments { margin-top: 12px; }
          .payment-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; border-top: 2px dashed #333; padding-top: 12px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Smarter Dog Grooming Salon</h1>
          <p>Receipt</p>
          <p>${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div class="line-item"><span>Service Total</span><span>${formatMoney(totalDue)}</span></div>
        <div class="divider"></div>
        <div class="payments">
          <strong>Payments:</strong>
          ${payments
            .map(
              (p) => `
            <div class="payment-item">
              <span>${p.type} (${METHOD_LABELS[p.method] || p.method})</span>
              <span>${p.type === "refund" || p.type === "partial-refund" ? "-" : ""}${formatMoney(p.amount)}</span>
            </div>
          `,
            )
            .join("")}
        </div>
        <div class="divider"></div>
        <div class="line-item total"><span>Total Paid</span><span>${formatMoney(totalPaid)}</span></div>
        ${totalRefunded > 0 ? `<div class="line-item"><span>Refunded</span><span>-${formatMoney(totalRefunded)}</span></div>` : ""}
        ${balance > 0 ? `<div class="line-item" style="color:red"><span>Balance Due</span><span>${formatMoney(balance)}</span></div>` : ""}
        ${balance <= 0 ? `<div class="line-item" style="color:green"><span>✓ PAID IN FULL</span><span></span></div>` : ""}
        <div class="footer">
          <p>Thank you for choosing Smarter Dog Grooming Salon</p>
          <p>We hope to see you again soon!</p>
        </div>
        <button onclick="window.print()" style="display:block; width:100%; margin-top:16px; padding:8px; background:#333; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:14px;">Print Receipt</button>
      </body>
      </html>
    `;
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Balance Summary */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Total Due</span>
          <span className="font-semibold text-slate-900">{formatMoney(totalDue)}</span>
        </div>
        {depositRequired && depositRequired > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Deposit Required</span>
            <span className="font-medium text-orange-600">{formatMoney(depositRequired)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Paid</span>
          <span className="font-medium text-accent">{formatMoney(totalPaid)}</span>
        </div>
        {totalRefunded > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Refunded</span>
            <span className="font-medium text-coral">-{formatMoney(totalRefunded)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
          <span>{balance > 0 ? "Balance Due" : "Status"}</span>
          {balance > 0 ? (
            <span className="text-coral">{formatMoney(balance)}</span>
          ) : (
            <span className="text-accent">✓ Paid in full</span>
          )}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment History</h4>
          <div className="space-y-1.5">
            {payments.map((p) => {
              const Icon = METHOD_ICONS[p.method] || CreditCard;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded border border-slate-100 bg-white text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLOURS[p.type] || "bg-slate-100 text-slate-700"}`}
                    >
                      {p.type}
                    </span>
                    {p.notes && <span className="text-slate-400 text-xs truncate max-w-[120px]">{p.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {p.type === "refund" || p.type === "partial-refund" ? "-" : ""}
                      {formatMoney(p.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(p.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!showForm && (
          <>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Record Payment
            </Button>
            {payments.length > 0 && (
              <Button size="sm" variant="outline" onClick={handlePrintReceipt}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Receipt
              </Button>
            )}
          </>
        )}
      </div>

      {/* Payment Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-400" /> Record Payment
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Amount (GBP)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={balance > 0 ? balance.toFixed(2) : "0.00"}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Method</label>
              <select
                title="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="card">💳 Card</option>
                <option value="cash">💵 Cash</option>
                <option value="bank-transfer">🏦 Bank Transfer</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Type</label>
            <div className="flex gap-2">
              {(["deposit", "full", "partial", "refund"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    type === t
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment reference, etc." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Recording..." : `Record ${formatMoney(Number(amount || 0))} ${type}`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
