"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lead, Campaign, Recall, Patient } from "@prisma/client";
import { CampaignChannel } from "@prisma/client";
import { Megaphone, Users, Bell, Sparkles, Send } from "lucide-react";
import {
  countCampaignAudience,
  createCampaign,
  sendCampaign,
} from "@/app/(dashboard)/features/crm/actions";
import type { CampaignAudience } from "@/app/(dashboard)/features/crm/crm-types";

type RecallWithPatient = Recall & { patient: Patient };

const AUDIENCES: { value: CampaignAudience; label: string }[] = [
  { value: "ALL_PATIENTS", label: "All patients" },
  { value: "ACTIVE_PATIENTS", label: "Active patients" },
  { value: "OVERDUE_RECALL", label: "Overdue recall" },
  { value: "INACTIVE", label: "Inactive (6+ months)" },
];

export function CrmClient({
  leads,
  campaigns: initialCampaigns,
  recalls,
  tenantId,
}: {
  leads: Lead[];
  campaigns: Campaign[];
  recalls: RecallWithPatient[];
  tenantId: string;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>(CampaignChannel.EMAIL);
  const [audience, setAudience] = useState<CampaignAudience>("ALL_PATIENTS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    void countCampaignAudience(audience).then(setRecipientCount);
  }, [audience]);

  async function generateWithAi() {
    setAiLoading(true);
    const res = await fetch("/api/ai/campaign-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: name || "Dental practice campaign",
        campaignType: channel,
        targetAudience: audience,
        tone: "friendly professional",
      }),
    });
    setAiLoading(false);
    if (res.ok) {
      const data = await res.json();
      if (channel === CampaignChannel.EMAIL) {
        setSubject(data.emailSubject ?? "");
        setBody(data.emailBody ?? "");
      } else {
        setBody(data.sms ?? data.emailBody ?? "");
      }
      toast.success("Campaign text generated");
    } else {
      toast.error("AI generation failed");
    }
  }

  async function handleCreate() {
    if (!name.trim() || !body.trim()) {
      toast.error("Name and message required");
      return;
    }
    setLoading(true);
    const result = await createCampaign({
      name: name.trim(),
      channel,
      targetAudience: audience,
      subject: channel === CampaignChannel.EMAIL ? subject : undefined,
      body,
      scheduledAt: scheduledAt || undefined,
    });
    setLoading(false);
    if (result.success) {
      setCampaigns((prev) => [result.data, ...prev]);
      toast.success("Campaign created");
      setCampaignOpen(false);
      setName("");
      setBody("");
      setSubject("");
      setScheduledAt("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleSend(campaignId: string) {
    setSendingId(campaignId);
    const result = await sendCampaign({ campaignId });
    setSendingId(null);
    if (result.success) {
      toast.success(`Sent to ${result.data.sent} patients`);
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId ? { ...c, status: "COMPLETED", sentCount: result.data.sent } : c,
        ),
      );
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CRM & Marketing</h1>
          <p className="text-muted-foreground">Leads, campaigns & recalls</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/crm/recalls">
              <Bell className="mr-2 h-4 w-4" />
              Recalls
            </Link>
          </Button>
          <Button onClick={() => setCampaignOpen(true)}>
            <Megaphone className="mr-2 h-4 w-4" />
            New campaign
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads ({leads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-y-auto">
            {leads.map((lead) => (
              <div key={lead.id} className="flex justify-between border-b pb-2 text-sm">
                <span>
                  {lead.firstName} {lead.lastName}
                </span>
                <Badge variant="outline">{lead.status}</Badge>
              </div>
            ))}
            {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Recall queue
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-y-auto">
            {recalls.map((r) => (
              <div key={r.id} className="flex justify-between border-b pb-2 text-sm">
                <span>
                  <Link
                    href={`/patients/${r.patientId}`}
                    className="font-medium hover:underline"
                  >
                    {r.patient.firstName} {r.patient.lastName}
                  </Link>
                  <span className="text-muted-foreground"> — {r.type}</span>
                </span>
                {r.churnRisk && <Badge variant="destructive">{r.churnRisk}</Badge>}
              </div>
            ))}
            {recalls.length === 0 && (
              <p className="text-sm text-muted-foreground">No overdue or upcoming recalls</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-muted-foreground">{c.channel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{c.status}</Badge>
                {c.status === "DRAFT" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendingId === c.id}
                    onClick={() => handleSend(c.id)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Channel</Label>
              <div className="mt-1 flex gap-4">
                {[CampaignChannel.EMAIL, CampaignChannel.SMS].map((ch) => (
                  <label key={ch} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={channel === ch}
                      onChange={() => setChannel(ch)}
                    />
                    {ch}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Target audience</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as CampaignAudience)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                ~{recipientCount} recipients
              </p>
            </div>
            {channel === CampaignChannel.EMAIL && (
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Message</Label>
              <textarea
                className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={generateWithAi} disabled={aiLoading}>
              <Sparkles className="mr-2 h-4 w-4" />
              {aiLoading ? "Generating…" : "Generate with AI"}
            </Button>
            <div>
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={loading}>
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
