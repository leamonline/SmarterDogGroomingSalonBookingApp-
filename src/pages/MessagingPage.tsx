import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { Mail, MessageSquare, Send, Clock, CheckCircle, XCircle, Plus, Pencil } from "lucide-react";

// ────────────────────────────────────────────
// Message Templates
// ────────────────────────────────────────────
const DEFAULT_TEMPLATES: MessageTemplate[] = [
    {
        id: "booking-confirmed",
        name: "Booking Confirmed",
        trigger: "booking_confirmed",
        subject: "Your appointment at Savvy Pet Spa is confirmed!",
        body: "Hi {{customerName}},\n\nYour appointment for {{petName}} ({{service}}) has been confirmed.\n\n📅 {{date}}\n⏰ {{time}}\n💰 {{price}}\n\nPlease arrive 5 minutes early. If you need to cancel, please do so at least 24 hours in advance.\n\nSee you soon!\nSavvy Pet Spa",
        channel: "email",
        isActive: true,
    },
    {
        id: "booking-reminder",
        name: "Appointment Reminder",
        trigger: "reminder_24h",
        subject: "Reminder: {{petName}}'s appointment tomorrow",
        body: "Hi {{customerName}},\n\nJust a reminder that {{petName}} has a {{service}} appointment tomorrow at {{time}}.\n\nPlease remember:\n• Arrive 5 minutes early\n• Bring any vaccination records if this is your first visit\n• Let us know about any health changes\n\nSee you soon!\nSavvy Pet Spa",
        channel: "email",
        isActive: true,
    },
    {
        id: "ready-for-collection",
        name: "Ready for Collection",
        trigger: "ready_for_collection",
        subject: "{{petName}} is ready for collection! 🐾",
        body: "Hi {{customerName}},\n\n{{petName}} is all done and looking fabulous! 🐾\n\nYou can come and collect them at your convenience.\n\nSavvy Pet Spa",
        channel: "sms",
        isActive: true,
    },
    {
        id: "booking-cancelled",
        name: "Cancellation Confirmation",
        trigger: "booking_cancelled",
        subject: "Appointment cancelled",
        body: "Hi {{customerName}},\n\nYour appointment for {{petName}} on {{date}} has been cancelled.\n\nIf you'd like to rebook, visit our online booking page or give us a call.\n\nSavvy Pet Spa",
        channel: "email",
        isActive: true,
    },
    {
        id: "booking-pending",
        name: "Booking Pending Approval",
        trigger: "booking_pending",
        subject: "We've received your booking request",
        body: "Hi {{customerName}},\n\nThank you for your booking request for {{petName}} ({{service}}) on {{date}} at {{time}}.\n\nWe're reviewing it and will confirm shortly.\n\nSavvy Pet Spa",
        channel: "email",
        isActive: true,
    },
];

interface MessageTemplate {
    id: string;
    name: string;
    trigger: string;
    subject: string;
    body: string;
    channel: "email" | "sms";
    isActive: boolean;
}

interface SentMessage {
    id: string;
    recipientEmail?: string;
    recipientPhone?: string;
    subject?: string;
    body: string;
    channel: string;
    status: string;
    createdAt: string;
}

// ────────────────────────────────────────────
// Template Editor
// ────────────────────────────────────────────
function TemplateEditor({
    template,
    onSave,
    onClose,
}: {
    template: MessageTemplate;
    onSave: (t: MessageTemplate) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(template.name);
    const [subject, setSubject] = useState(template.subject);
    const [body, setBody] = useState(template.body);
    const [channel, setChannel] = useState(template.channel);
    const [isActive, setIsActive] = useState(template.isActive);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{template.id ? "Edit Template" : "New Template"}</h3>
                <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
            <div className="grid gap-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Template Name</label>
                    <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Channel</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setChannel("email")}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${channel === "email" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                                    }`}
                            >
                                <Mail className="h-3 w-3" /> Email
                            </button>
                            <button
                                type="button"
                                onClick={() => setChannel("sms")}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${channel === "sms" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                                    }`}
                            >
                                <MessageSquare className="h-3 w-3" /> SMS
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Active</label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                            Send automatically
                        </label>
                    </div>
                </div>
                {channel === "email" && (
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Subject</label>
                        <Input value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Body</label>
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="w-full min-h-[120px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                    />
                    <p className="text-[10px] text-slate-400">
                        Variables: {"{{customerName}}"}, {"{{petName}}"}, {"{{service}}"}, {"{{date}}"}, {"{{time}}"}, {"{{price}}"}
                    </p>
                </div>
            </div>
            <div className="flex justify-end">
                <Button size="sm" onClick={() => onSave({ ...template, name, subject, body, channel, isActive })}>Save Template</Button>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────
// Messaging Page
// ────────────────────────────────────────────
export function MessagingPage() {
    const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
        const saved = localStorage.getItem("petspa_message_templates");
        return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
    });
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
    const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
    const [showSent, setShowSent] = useState(false);

    // Save templates to localStorage
    const saveTemplates = (updated: MessageTemplate[]) => {
        setTemplates(updated);
        localStorage.setItem("petspa_message_templates", JSON.stringify(updated));
    };

    const handleSaveTemplate = (t: MessageTemplate) => {
        const updated = templates.map(existing => existing.id === t.id ? t : existing);
        if (!templates.find(existing => existing.id === t.id)) {
            updated.push(t);
        }
        saveTemplates(updated);
        setEditingTemplate(null);
        toast.success("Template saved");
    };

    const handleToggleActive = (id: string) => {
        const updated = templates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t);
        saveTemplates(updated);
    };

    const TRIGGER_LABELS: Record<string, string> = {
        booking_confirmed: "On booking confirmed",
        reminder_24h: "24h before appointment",
        ready_for_collection: "When marked ready",
        booking_cancelled: "On cancellation",
        booking_pending: "On booking request",
    };

    const CHANNEL_STYLES: Record<string, { bg: string; icon: any }> = {
        email: { bg: "bg-blue-100 text-blue-800", icon: Mail },
        sms: { bg: "bg-green-100 text-green-800", icon: MessageSquare },
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Messaging</h1>
                    <p className="text-slate-500">Manage notification templates and view sent messages.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSent(!showSent)}>
                        {showSent ? "Templates" : "Sent Messages"}
                    </Button>
                </div>
            </div>

            {!showSent ? (
                <>
                    {editingTemplate ? (
                        <TemplateEditor
                            template={editingTemplate}
                            onSave={handleSaveTemplate}
                            onClose={() => setEditingTemplate(null)}
                        />
                    ) : (
                        <div className="grid gap-4">
                            {templates.map(t => {
                                const ch = CHANNEL_STYLES[t.channel] || CHANNEL_STYLES.email;
                                const ChannelIcon = ch.icon;
                                return (
                                    <Card key={t.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-slate-900">{t.name}</h3>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${ch.bg}`}>
                                                            <ChannelIcon className="h-3 w-3" /> {t.channel}
                                                        </span>
                                                        {t.isActive ? (
                                                            <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">Active</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">Inactive</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        <Clock className="h-3 w-3 inline mr-1" />
                                                        {TRIGGER_LABELS[t.trigger] || t.trigger}
                                                    </p>
                                                    {t.subject && (
                                                        <p className="text-sm text-slate-600 mt-1">Subject: <span className="font-medium">{t.subject}</span></p>
                                                    )}
                                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body.slice(0, 120)}...</p>
                                                </div>
                                                <div className="flex gap-1 ml-3">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs"
                                                        onClick={() => handleToggleActive(t.id)}
                                                    >
                                                        {t.isActive ? "Disable" : "Enable"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs"
                                                        onClick={() => setEditingTemplate(t)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Sent Messages</CardTitle>
                        <CardDescription>Recent notifications sent to customers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {sentMessages.length === 0 ? (
                            <div className="text-center py-8">
                                <Send className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">No messages sent yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Messages will appear here when notifications are triggered by booking events.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sentMessages.map(msg => (
                                    <div key={msg.id} className="rounded border border-slate-100 p-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="font-medium">{msg.subject || "SMS"}</span>
                                            <span className="text-xs text-slate-400">{new Date(msg.createdAt).toLocaleString("en-GB")}</span>
                                        </div>
                                        <p className="text-slate-500 text-xs mt-1 truncate">{msg.body.slice(0, 80)}...</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.status === "sent" ? "bg-green-100 text-green-700" :
                                                    msg.status === "failed" ? "bg-red-100 text-red-700" :
                                                        "bg-slate-100 text-slate-600"
                                                }`}>{msg.status}</span>
                                            <span className="text-[10px] text-slate-400">{msg.channel}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
