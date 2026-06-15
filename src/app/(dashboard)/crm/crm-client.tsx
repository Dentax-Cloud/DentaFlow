"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Lead, Campaign, Recall, Patient } from "@prisma/client";
import { Megaphone, Users, Bell } from "lucide-react";

type RecallWithPatient = Recall & { patient: Patient };

export function CrmClient({
  leads,
  campaigns,
  recalls,
}: {
  leads: Lead[];
  campaigns: Campaign[];
  recalls: RecallWithPatient[];
}) {
  const [intent, setIntent] = useState("");
  const [template, setTemplate] = useState<{ sms: string; emailSubject: string; emailBody: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateTemplate() {
    if (!intent.trim()) return;
    setLoading(true);
    const res = await fetch("/api/ai/campaign-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setTemplate(data);
      toast.success("Template generated");
    } else {
      toast.error("Failed to generate template");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">CRM & Marketing</h1>
        <p className="text-muted-foreground">Leads, campaigns & recalls</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads ({leads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {leads.map((lead) => (
              <div key={lead.id} className="flex justify-between border-b pb-2 text-sm">
                <span>{lead.firstName} {lead.lastName}</span>
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
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {recalls.map((r) => (
              <div key={r.id} className="flex justify-between border-b pb-2 text-sm">
                <span>
                  {r.patient.firstName} {r.patient.lastName} — {r.type}
                </span>
                {r.churnRisk && <Badge variant="destructive">{r.churnRisk}</Badge>}
              </div>
            ))}
            {recalls.length === 0 && <p className="text-sm text-muted-foreground">No pending recalls</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            AI Campaign Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Summer teeth whitening promotion"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
            <Button onClick={generateTemplate} disabled={loading}>
              {loading ? "..." : "Generate"}
            </Button>
          </div>
          {template && (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div>
                <p className="font-semibold">SMS</p>
                <p>{template.sms}</p>
              </div>
              <div>
                <p className="font-semibold">Email subject</p>
                <p>{template.emailSubject}</p>
              </div>
              <div>
                <p className="font-semibold">Email body</p>
                <p className="whitespace-pre-wrap">{template.emailBody}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex justify-between border-b pb-2 text-sm">
              <span>{c.name}</span>
              <Badge>{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
