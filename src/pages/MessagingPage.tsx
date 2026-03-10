import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { Mail, MessageSquare, Send, Clock, Pencil, RefreshCw, Loader2 } from "lucide-react";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
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
    templateName?: string;
    createdAt: string;
}

// ────────────────────────────────────────────
// Default Templates
// ────────────────────────────────────────────
const DEFAULT_TEMPLATES: MessageTemplate[] = [
    {
        id: "booking-confirmed",
        name: "Booking Confirmed",
        trigger: "booking_confirmed",
        subject: "Your appointment at Savvy Pet Spa is confirmed!",
        body: "Hi {{customerName}},\n\nYour appointment for {{petName}} ({{service}}) has been confirmed.\n\n📅 {{date}}\n⏰ {{time}}\n💰 £{{price}}\n\nPlease arrive 5 minutes early. If you need to cancel, please do so at least 24 hours in advance.\n\nSee you soon!\nSavvy Pet Spa",
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

// ────────────────────────────────────────────
// Template Editor
// ────────────────────────────────────────────
function TemplateEditor({ template, onSave, onClose }: {
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
                            {(['email', 'sms'] as const).map(ch => (
                                <button key={ch} type="button" onClick={() => setChannel(ch)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${channel === ch ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>
                                    {ch === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                                    {ch.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Active</label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-brand-300 text-brand-600" />
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
                    <textarea value={body} onChange={e => setBody(e.target.value)}
                        className="w-full min-h-[120px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2" />
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
// Manual Send Form
// ────────────────────────────────────────────
function ManualSendForm({ onSent }: { onSent: () => void }) {
    const [channel, setChannel] = useState<'email' | 'sms'>('email');
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim() || !recipient.trim()) { toast.error('Recipient and body are required'); return; }
        setSending(true);
        try {
            await api.sendMessage({
                channel,
                recipientEmail: channel === 'email' ? recipient : undefined,
                recipientPhone: channel === 'sms' ? recipient : undefined,
                subject: channel === 'email' ? subject : undefined,
                body,
            });
            toast.success('Message dispatched');
            setRecipient(''); setSubject(''); setBody('');
            onSent();
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <form onSubmit={handleSend} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Send className="h-4 w-4 text-slate-400" /> Manual Send
            </h3>
            <div className="flex gap-2">
                {(['email', 'sms'] as const).map(ch => (
                    <button key={ch} type="button" onClick={() => setChannel(ch)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${channel === ch ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {ch === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                        {ch.toUpperCase()}
                    </button>
                ))}
            </div>
            <Input
                placeholder={channel === 'email' ? 'customer@email.com' : '+44 7700 900000'}
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                required
            />
            {channel === 'email' && (
                <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
            )}
            <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                required
                placeholder="Message body..."
                className="w-full min-h-[80px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            />
            <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={sending}>
                    {sending
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
                        : <><Send className="h-3.5 w-3.5 mr-1.5" />Send Message</>
                    }
                </Button>
            </div>
        </form>
    );
}

// ────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────
export function MessagingPage() {
    const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
        const saved = localStorage.getItem("petspa_message_templates");
        return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
    });
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
    const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
    const [loadingSent, setLoadingSent] = useState(false);
    const [showSent, setShowSent] = useState(false);
    const [showManualSend, setShowManualSend] = useState(false);

    const loadSentMessages = async () => {
        setLoadingSent(true);
        try {
            const data = await api.getMessages(100);
            setSentMessages(Array.isArray(data) ? data : []);
        } catch {
            setSentMessages([]);
        } finally {
            setLoadingSent(false);
        }
    };

    useEffect(() => {
        if (showSent) loadSentMessages();
    }, [showSent]);

    const saveTemplates = (updated: MessageTemplate[]) => {
        setTemplates(updated);
        localStorage.setItem("petspa_message_templates", JSON.stringify(updated));
    };

    const handleSaveTemplate = (t: MessageTemplate) => {
        const existing = templates.find(x => x.id === t.id);
        const updated = existing ? templates.map(x => x.id === t.id ? t : x) : [...templates, t];
        saveTemplates(updated);
        setEditingTemplate(null);
        toast.success("Template saved");
    };

    const handleToggleActive = (id: string) => {
        saveTemplates(templates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
    };

    const TRIGGER_LABELS: Record<string, string> = {
        booking_confirmed: "On booking confirmed",
        reminder_24h: "24h before appointment",
        ready_for_collection: "When marked ready for collection",
        booking_cancelled: "On cancellation",
        booking_pending: "On booking request",
    };

    const CHANNEL_STYLES: Record<string, { bg: string; icon: any }> = {
        email: { bg: "bg-sky-light text-brand-700", icon: Mail },
        sms: { bg: "bg-sage-light text-brand-700", icon: MessageSquare },
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-purple">Messaging</h1>
                    <p className="text-slate-500">Manage notification templates and view sent messages.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowManualSend(v => !v)}>
                        <Send className="h-4 w-4 mr-2" />
                        {showManualSend ? 'Hide Send Form' : 'Manual Send'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSent(v => !v)}>
                        {showSent ? "Templates" : "Sent Messages"}
                    </Button>
                </div>
            </div>

            {showManualSend && (
                <ManualSendForm onSent={() => { if (showSent) loadSentMessages(); }} />
            )}

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
                                                        <Badge variant="outline" className={t.isActive ? "text-accent border-accent/30 text-[10px]" : "text-slate-400 border-slate-200 text-[10px]"}>
                                                            {t.isActive ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        <Clock className="h-3 w-3 inline mr-1" />
                                                        {TRIGGER_LABELS[t.trigger] || t.trigger}
                                                    </p>
                                                    {t.subject && (
                                                        <p className="text-sm text-slate-600 mt-1">Subject: <span className="font-medium">{t.subject}</span></p>
                                                    )}
                                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body.slice(0, 120)}…</p>
                                                </div>
                                                <div className="flex gap-1 ml-3">
                                                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleToggleActive(t.id)}>
                                                        {t.isActive ? "Disable" : "Enable"}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingTemplate(t)}>
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
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Sent Messages</CardTitle>
                                <CardDescription>Recent notifications sent to customers.</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" onClick={loadSentMessages} disabled={loadingSent}>
                                {loadingSent ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingSent ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                        ) : sentMessages.length === 0 ? (
                            <div className="text-center py-8">
                                <Send className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">No messages sent yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Messages appear here when booking events trigger notifications.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sentMessages.map(msg => (
                                    <div key={msg.id} className="rounded border border-slate-100 p-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="font-medium">{msg.subject || (msg.channel === 'sms' ? 'SMS' : 'Email')}</span>
                                            <span className="text-xs text-slate-400">{new Date(msg.createdAt).toLocaleString("en-GB")}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{msg.recipientEmail || msg.recipientPhone || 'Unknown recipient'}</p>
                                        <p className="text-slate-500 text-xs mt-1 truncate">{msg.body.slice(0, 100)}{msg.body.length > 100 ? '…' : ''}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.status === "sent" ? "bg-sage-light text-brand-700" :
                                                    msg.status === "simulated" ? "bg-sky-light text-brand-700" :
                                                        msg.status === "failed" ? "bg-coral-light text-coral" :
                                                            "bg-slate-100 text-slate-600"
                                                }`}>{msg.status}</span>
                                            <span className="text-[10px] text-slate-400">{msg.channel}</span>
                                            {msg.templateName && msg.templateName !== 'manual' && (
                                                <span className="text-[10px] text-slate-400">• {msg.templateName.replace(/_/g, ' ')}</span>
                                            )}
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
