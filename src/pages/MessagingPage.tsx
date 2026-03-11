import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2, Mail, MessageSquare, Pencil, RefreshCw, Users } from "lucide-react";
import { useLocation } from "react-router-dom";
import { api } from "@/src/lib/api";
import { ClientMessagingPanel } from "@/src/components/ClientMessagingPanel";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import type { Customer, Message } from "@/src/types";

interface MessageTemplate {
  id: string;
  name: string;
  trigger: string;
  subject: string;
  body: string;
  channel: "email" | "sms";
  isActive: boolean;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "booking-confirmed",
    name: "Booking Confirmed",
    trigger: "booking_confirmed",
    subject: "Your appointment at Smarter Dog Grooming Salon is confirmed!",
    body: "Hi {{customerName}},\n\nYour appointment for {{petName}} ({{service}}) has been confirmed.\n\n📅 {{date}}\n⏰ {{time}}\n💰 £{{price}}\n\nPlease arrive 5 minutes early.\n\nSee you soon!\nSmarter Dog Grooming Salon",
    channel: "email",
    isActive: true,
  },
  {
    id: "booking-reminder",
    name: "Appointment Reminder",
    trigger: "reminder_24h",
    subject: "Reminder: {{petName}}'s appointment tomorrow",
    body: "Hi {{customerName}},\n\nJust a reminder that {{petName}} has a {{service}} appointment tomorrow at {{time}}.\n\nSee you soon!\nSmarter Dog Grooming Salon",
    channel: "email",
    isActive: true,
  },
  {
    id: "ready-for-collection",
    name: "Ready for Collection",
    trigger: "ready_for_collection",
    subject: "{{petName}} is ready for collection",
    body: "Hi {{customerName}},\n\n{{petName}} is all done and ready for collection.\n\nSmarter Dog Grooming Salon",
    channel: "sms",
    isActive: true,
  },
];

function TemplateEditor({
  template,
  onSave,
  onClose,
}: {
  template: MessageTemplate;
  onSave: (template: MessageTemplate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [channel, setChannel] = useState(template.channel);
  const [isActive, setIsActive] = useState(template.isActive);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{template.id ? "Edit template" : "New template"}</CardTitle>
          <CardDescription>Keep templates available without making them the main workflow.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Template name</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["email", "sms"] as const).map((nextChannel) => (
            <button
              key={nextChannel}
              type="button"
              onClick={() => setChannel(nextChannel)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                channel === nextChannel
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {nextChannel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
              {nextChannel.toUpperCase()}
            </button>
          ))}
        </div>

        {channel === "email" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">Subject</label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Body</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Use this template as part of staff messaging
        </label>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => onSave({ ...template, name, subject, body, channel, isActive })}>
            Save template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MessagingPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const saved = localStorage.getItem("petspa_message_templates");
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
  });
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const location = useLocation();
  const requestedCustomerId = location.state?.customerId as string | undefined;
  const requestedDogId = location.state?.dogId as string | undefined;
  const requestedAppointmentId = location.state?.appointmentId as string | undefined;

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await api.getCustomersPage(1, 200);
      const items: Customer[] = data.data ?? data;
      setCustomers(items);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients");
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadRecentMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await api.getMessages({ limit: 100 });
      setRecentMessages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load messages");
      setRecentMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadRecentMessages();
  }, []);

  useEffect(() => {
    if (!requestedCustomerId) return;

    const existingCustomer = customers.find((customer) => customer.id === requestedCustomerId);
    if (existingCustomer) {
      setSelectedCustomerId(existingCustomer.id);
      return;
    }

    if (!loadingCustomers) {
      api
        .getCustomer(requestedCustomerId)
        .then((customer) => {
          setCustomers((prev) => (prev.some((existing) => existing.id === customer.id) ? prev : [customer, ...prev]));
          setSelectedCustomerId(customer.id);
        })
        .catch((err) => toast.error(err.message || "Failed to load client"));
    }
  }, [customers, loadingCustomers, requestedCustomerId]);

  const conversationByCustomer = useMemo(() => {
    const grouped = new Map<string, Message>();
    recentMessages.forEach((message) => {
      if (message.customerId && !grouped.has(message.customerId)) {
        grouped.set(message.customerId, message);
      }
    });
    return grouped;
  }, [recentMessages]);

  useEffect(() => {
    if (selectedCustomerId) return;

    const firstConversationId = Array.from(conversationByCustomer.keys())[0];
    if (firstConversationId) {
      setSelectedCustomerId(firstConversationId);
      return;
    }

    if (customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [conversationByCustomer, customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const normalized = searchTerm.toLowerCase();
    return customers.filter((customer) => {
      if (!normalized) return true;
      return (
        customer.name.toLowerCase().includes(normalized) ||
        customer.email.toLowerCase().includes(normalized) ||
        customer.phone.toLowerCase().includes(normalized) ||
        customer.pets.some((pet) => pet.name.toLowerCase().includes(normalized))
      );
    });
  }, [customers, searchTerm]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const selectedPetName = useMemo(() => {
    if (!selectedCustomer) return undefined;
    if (!requestedDogId) return selectedCustomer.pets[0]?.name;
    return selectedCustomer.pets.find((pet) => pet.id === requestedDogId)?.name || selectedCustomer.pets[0]?.name;
  }, [requestedDogId, selectedCustomer]);

  const saveTemplates = (updatedTemplates: MessageTemplate[]) => {
    setTemplates(updatedTemplates);
    localStorage.setItem("petspa_message_templates", JSON.stringify(updatedTemplates));
  };

  const handleSaveTemplate = (template: MessageTemplate) => {
    const updated = templates.some((existing) => existing.id === template.id)
      ? templates.map((existing) => (existing.id === template.id ? template : existing))
      : [...templates, template];
    saveTemplates(updated);
    setEditingTemplate(null);
    toast.success("Template saved");
  };

  const handleToggleTemplate = (templateId: string) => {
    saveTemplates(
      templates.map((template) =>
        template.id === templateId ? { ...template, isActive: !template.isActive } : template,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple">Messaging</h1>
        <p className="text-sm text-slate-500">
          Client-linked inbox first, with templates and the global message feed kept as supporting tools.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-lg">Client inbox</CardTitle>
              <CardDescription>Pick a client to see their message history and send the next update.</CardDescription>
            </div>
            <Input
              placeholder="Search clients or dogs..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingCustomers ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading clients...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No clients match this search.
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const preview = conversationByCustomer.get(customer.id);
                const isSelected = customer.id === selectedCustomerId;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isSelected ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{customer.name}</p>
                        <p className="text-xs text-slate-500">
                          {customer.pets.map((pet) => pet.name).join(", ") || "No dogs saved"}
                        </p>
                      </div>
                      {preview ? <Badge variant="secondary">Active</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {preview ? preview.body.slice(0, 72) : "No messages yet"}
                      {preview && preview.body.length > 72 ? "..." : ""}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedCustomer ? (
            <ClientMessagingPanel
              customer={selectedCustomer}
              appointmentId={requestedAppointmentId}
              highlightedPetName={selectedPetName}
              title={`Conversation with ${selectedCustomer.name}`}
              description="Send updates, ready notices, and follow-ups without leaving the client context."
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                Choose a client to open their message history.
              </CardContent>
            </Card>
          )}

          {editingTemplate ? (
            <TemplateEditor
              template={editingTemplate}
              onSave={handleSaveTemplate}
              onClose={() => setEditingTemplate(null)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>
                  Keep reusable wording close by without making this page a template manager first.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{template.name}</p>
                          <Badge variant="outline" className="capitalize">
                            {template.channel}
                          </Badge>
                          <Badge variant={template.isActive ? "secondary" : "outline"}>
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {template.trigger.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">{template.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleToggleTemplate(template.id)}>
                          {template.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTemplate(template)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">All recent messages</CardTitle>
                  <CardDescription>
                    The team-wide message log stays available here for broader visibility.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={loadRecentMessages} disabled={loadingMessages}>
                  {loadingMessages ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading recent messages...
                </div>
              ) : recentMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No recent messages yet.
                </div>
              ) : (
                recentMessages.slice(0, 12).map((message) => (
                  <div key={message.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {message.channel}
                        </Badge>
                        <span className="text-sm font-medium text-slate-900">
                          {message.customerName ||
                            message.recipientEmail ||
                            message.recipientPhone ||
                            "Unknown recipient"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(message.createdAt).toLocaleString("en-GB")}
                      </span>
                    </div>
                    {message.subject ? (
                      <p className="mt-2 text-sm font-medium text-slate-900">{message.subject}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-600">
                      {message.body.slice(0, 140)}
                      {message.body.length > 140 ? "..." : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
