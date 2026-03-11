import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { FileText, Plus, Trash2, CheckCircle, Pen } from "lucide-react";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "signature" | "select";
  required: boolean;
  options?: string[]; // for select type
}

interface FormDefinition {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: FormField[];
  isActive: boolean;
}

interface FormSubmission {
  id: string;
  formId: string;
  customerId?: string;
  dogId?: string;
  appointmentId?: string;
  data: Record<string, any>;
  signedAt?: string;
  createdAt: string;
}

// ────────────────────────────────────────────
// Form Builder
// ────────────────────────────────────────────
interface FormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormDefinition | null;
  onSave: () => void;
}

export function FormBuilderModal({ isOpen, onClose, form, onSave }: FormBuilderModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formType, setFormType] = useState("intake");
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (form) {
        setName(form.name);
        setDescription(form.description);
        setFormType(form.type);
        setFields(typeof form.fields === "string" ? JSON.parse(form.fields) : form.fields || []);
      } else {
        setName("");
        setDescription("");
        setFormType("intake");
        setFields([]);
      }
    }
  }, [isOpen, form]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Form name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: form?.id || crypto.randomUUID(),
        name,
        description,
        type: formType,
        fields: JSON.stringify(fields),
        isActive: true,
      };
      if (form) {
        await api.updateForm(form.id, payload);
        toast.success("Form template updated");
      } else {
        await api.createForm(payload);
        toast.success("Form template created");
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-400" />
            {form ? "Edit Form Template" : "New Form Template"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Form Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Client Intake Form" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Form Type</label>
              <select
                title="Form type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="intake">New Client Intake</option>
                <option value="grooming-consent">Grooming Consent</option>
                <option value="matting-consent">Matting Consent</option>
                <option value="vet-consent">Vet Consent</option>
                <option value="health-check">Health Check</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Fields Builder */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-900">Form Fields</h4>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
              </Button>
            </div>
            {fields.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-400">
                No fields yet. Click "Add Field" to start building your form.
              </div>
            )}
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-400 w-5">{idx + 1}</span>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1 h-8 text-sm"
                    />
                    <select
                      title="Field type"
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                      className="h-8 rounded-xl border border-brand-200 bg-white px-2 text-xs"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="signature">Signature</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      Req
                    </label>
                    <button
                      title="Remove field"
                      onClick={() => removeField(field.id)}
                      className="text-slate-400 hover:text-coral"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {field.type === "select" && (
                    <Input
                      value={(field.options || []).join(", ")}
                      onChange={(e) =>
                        updateField(field.id, { options: e.target.value.split(",").map((s) => s.trim()) })
                      }
                      placeholder="Options (comma-separated)"
                      className="h-7 text-xs mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// Form Filler (for filling out a form)
// ────────────────────────────────────────────
interface FormFillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormDefinition;
  context?: { customerId?: string; dogId?: string; appointmentId?: string };
  onSubmitted: () => void;
}

export function FormFillerModal({ isOpen, onClose, form, context, onSubmitted }: FormFillerModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const fields: FormField[] = typeof form?.fields === "string" ? JSON.parse(form.fields) : form?.fields || [];

  useEffect(() => {
    if (isOpen) setValues({});
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const field of fields) {
      if (field.required && !values[field.id]) {
        toast.error(`"${field.label}" is required`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.submitForm({
        formId: form.id,
        customerId: context?.customerId || null,
        dogId: context?.dogId || null,
        appointmentId: context?.appointmentId || null,
        data: JSON.stringify(values),
        signedAt: fields.some((f) => f.type === "signature") ? new Date().toISOString() : null,
      });
      toast.success("Form submitted successfully");
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5 text-slate-400" />
            {form?.name || "Form"}
          </DialogTitle>
          {form?.description && <p className="text-sm text-slate-500 mt-1">{form.description}</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                {field.label}
                {field.required && <span className="text-coral ml-1">*</span>}
              </label>
              {field.type === "text" && (
                <Input
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  className="w-full min-h-[60px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                />
              )}
              {field.type === "checkbox" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    title="I agree"
                    checked={!!values[field.id]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  I agree
                </label>
              )}
              {field.type === "select" && (
                <select
                  title={field.label}
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  className="flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              {field.type === "signature" && (
                <div className="space-y-2">
                  <Input
                    value={values[field.id] || ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder="Type your full name as signature"
                  />
                  {values[field.id] && (
                    <div className="text-center py-3 bg-slate-50 rounded border border-slate-200">
                      <span className="text-lg italic font-serif text-slate-700">{values[field.id]}</span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Signed electronically on {new Date().toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────
// Forms List Page
// ────────────────────────────────────────────
export function FormsManager() {
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormDefinition | null>(null);
  const [fillerOpen, setFillerOpen] = useState(false);
  const [fillerForm, setFillerForm] = useState<FormDefinition | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [viewingSubmissions, setViewingSubmissions] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await api.getForms();
      setForms(Array.isArray(data) ? data : data.data || []);
    } catch {
      setForms([]);
    }
  };

  const loadSubmissions = async (formId: string) => {
    try {
      const data = await api.getFormSubmissions({ formId });
      setSubmissions(Array.isArray(data) ? data : data.data || []);
      setViewingSubmissions(formId);
    } catch {
      setSubmissions([]);
    }
  };

  const handleCreate = () => {
    setEditingForm(null);
    setBuilderOpen(true);
  };

  const handleEdit = (form: FormDefinition) => {
    setEditingForm(form);
    setBuilderOpen(true);
  };

  const handlePreview = (form: FormDefinition) => {
    setFillerForm(form);
    setFillerOpen(true);
  };

  const FORM_TYPE_COLOURS: Record<string, string> = {
    intake: "bg-sky-light text-brand-700",
    "grooming-consent": "bg-sage-light text-brand-700",
    "matting-consent": "bg-orange-100 text-orange-800",
    "vet-consent": "bg-coral-light text-coral",
    "health-check": "bg-purple-light/30 text-purple",
    custom: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple">Forms & Consent</h1>
          <p className="text-slate-500">Manage intake forms, consent forms, and view submissions.</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Form
        </Button>
      </div>

      {/* Forms Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {forms.map((form) => {
          const fieldCount =
            typeof form.fields === "string" ? JSON.parse(form.fields).length : (form.fields || []).length;
          return (
            <div
              key={form.id}
              className="rounded-xl border border-slate-200 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{form.name}</h3>
                    {form.description && <p className="text-sm text-slate-500 mt-0.5">{form.description}</p>}
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${FORM_TYPE_COLOURS[form.type] || FORM_TYPE_COLOURS.custom}`}
                  >
                    {form.type.replace(/-/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                  </span>
                  <span>{form.isActive ? "🟢 Active" : "🔴 Inactive"}</span>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-2 flex gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEdit(form)}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handlePreview(form)}>
                  Preview
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => loadSubmissions(form.id)}>
                  Submissions
                </Button>
              </div>
            </div>
          );
        })}
        {forms.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No forms created yet</p>
            <p className="text-xs mt-1">Create your first form template to start collecting data</p>
          </div>
        )}
      </div>

      {/* Submissions viewer */}
      {viewingSubmissions && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              Submissions for: {forms.find((f) => f.id === viewingSubmissions)?.name}
            </h3>
            <Button size="sm" variant="outline" onClick={() => setViewingSubmissions(null)}>
              Close
            </Button>
          </div>
          {submissions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub) => (
                <div key={sub.id} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">{new Date(sub.createdAt).toLocaleString("en-GB")}</span>
                    {sub.signedAt && (
                      <span className="text-xs text-accent flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Signed
                      </span>
                    )}
                  </div>
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-white p-2 rounded border border-slate-100">
                    {JSON.stringify(typeof sub.data === "string" ? JSON.parse(sub.data) : sub.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <FormBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        form={editingForm}
        onSave={loadForms}
      />
      {fillerForm && (
        <FormFillerModal
          isOpen={fillerOpen}
          onClose={() => setFillerOpen(false)}
          form={fillerForm}
          onSubmitted={loadForms}
        />
      )}
    </div>
  );
}
