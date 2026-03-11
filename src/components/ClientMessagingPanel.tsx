import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Mail, MessageSquare, Send } from "lucide-react";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import type { Customer, Message } from "@/src/types";

type MessagingCustomer = Pick<Customer, "id" | "name" | "email" | "phone" | "pets">;

type ClientMessagingPanelProps = {
  customer: MessagingCustomer;
  appointmentId?: string;
  highlightedPetName?: string;
  className?: string;
  title?: string;
  description?: string;
};

export function ClientMessagingPanel({
  customer,
  appointmentId,
  highlightedPetName,
  className,
  title = "Client messaging",
  description = "Keep communication attached to this client record.",
}: ClientMessagingPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">(customer.phone ? "sms" : "email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const primaryPetName = highlightedPetName || customer.pets?.[0]?.name || "your dog";
  const recipient = channel === "email" ? customer.email : customer.phone;
  const canSend = channel === "email" ? Boolean(customer.email) : Boolean(customer.phone);

  const quickDrafts = useMemo(
    () => [
      {
        label: "Booking update",
        subject: `Update for ${primaryPetName}`,
        body: `Hi ${customer.name},\n\nJust a quick update about ${primaryPetName}'s booking.\n\nPlease reply if you need anything from us.\n\nSmarter Dog Grooming Salon`,
      },
      {
        label: "Ready for collection",
        subject: `${primaryPetName} is ready`,
        body: `Hi ${customer.name},\n\n${primaryPetName} is ready for collection.\n\nSee you soon.\n\nSmarter Dog Grooming Salon`,
      },
      {
        label: "Follow-up",
        subject: `Checking in about ${primaryPetName}`,
        body: `Hi ${customer.name},\n\nJust checking in after ${primaryPetName}'s visit.\n\nLet us know how everything is going.\n\nSmarter Dog Grooming Salon`,
      },
    ],
    [customer.name, primaryPetName],
  );

  useEffect(() => {
    setChannel(customer.phone ? "sms" : "email");
    setSubject("");
    setBody("");
  }, [customer.id, customer.phone]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setLoading(true);
      try {
        const data = await api.getMessages({ customerId: customer.id, limit: 25 });
        if (!cancelled) {
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMessages([]);
          toast.error(err.message || "Failed to load messages");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  const handleApplyDraft = (draft: { subject: string; body: string }) => {
    setSubject(draft.subject);
    setBody(draft.body);
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();

    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }

    if (!canSend) {
      toast.error(
        channel === "email" ? "This client does not have an email address" : "This client does not have a phone number",
      );
      return;
    }

    setSending(true);
    try {
      await api.sendMessage({
        channel,
        recipientEmail: channel === "email" ? customer.email : undefined,
        recipientPhone: channel === "sms" ? customer.phone : undefined,
        subject: channel === "email" ? subject || `Update for ${primaryPetName}` : undefined,
        body,
        customerId: customer.id,
        appointmentId,
      });

      const updatedMessages = await api.getMessages({ customerId: customer.id, limit: 25 });
      setMessages(Array.isArray(updatedMessages) ? updatedMessages : []);
      setBody("");
      if (channel === "email") {
        setSubject("");
      }
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{customer.name}</Badge>
            {customer.pets?.length ? (
              <Badge variant="secondary">
                {customer.pets.length} dog{customer.pets.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSend} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["email", "sms"] as const).map((nextChannel) => (
              <button
                key={nextChannel}
                type="button"
                onClick={() => setChannel(nextChannel)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  channel === nextChannel
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {nextChannel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                {nextChannel.toUpperCase()}
              </button>
            ))}
            <span className="text-xs text-slate-500">
              {recipient ? `Sending to ${recipient}` : channel === "email" ? "No email saved" : "No phone saved"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickDrafts.map((draft) => (
              <Button
                key={draft.label}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => handleApplyDraft(draft)}
              >
                {draft.label}
              </Button>
            ))}
          </div>

          {channel === "email" ? (
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
          ) : null}

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`Write a ${channel.toUpperCase()} update for ${customer.name}...`}
            className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Messages are stored on the client record so the team can see the full history.
            </p>
            <Button type="submit" size="sm" disabled={sending || !canSend}>
              {sending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent history</h3>
            <Badge variant="outline">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No messages for this client yet.
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div key={message.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {message.channel}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(message.createdAt).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        message.status === "failed" ? "border-coral/30 text-coral" : "border-slate-200 text-slate-600",
                      )}
                    >
                      {message.status}
                    </Badge>
                  </div>
                  {message.subject ? (
                    <p className="mt-2 text-sm font-medium text-slate-900">{message.subject}</p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{message.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
