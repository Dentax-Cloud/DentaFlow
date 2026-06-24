"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "./rich-text-editor";
import { Loader2, Mic, MicOff, Printer, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  renderTemplate,
  createNoteFromTemplate,
} from "@/app/(dashboard)/features/clinical/template-actions";
import {
  saveClinicalNote,
  enhanceNoteText,
  getNoteAutoFillContext,
} from "@/app/(dashboard)/features/clinical/actions";
import { plainTextToHtml } from "@/lib/clinical/render-template";

export type ClinicalTemplateOption = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
};

type Soap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type Props = {
  patientId: string;
  appointmentId?: string;
  providerName?: string;
  templates: ClinicalTemplateOption[];
  chartSummary: string;
  toothNumbers: string[];
  rawNotes: string;
  onRawNotesChange: (value: string) => void;
  soap: Soap | null;
  onSoapChange: (soap: Soap | null) => void;
  onGenerate: (opts: { rawNotes?: string; chartSummary?: string }) => Promise<void>;
  generating: boolean;
  disabled?: boolean;
  autoFromChart: boolean;
  onAutoFromChartChange: (enabled: boolean) => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function ClinicalNoteEditor({
  patientId,
  appointmentId,
  providerName,
  templates,
  chartSummary,
  toothNumbers,
  rawNotes,
  onRawNotesChange,
  soap,
  onSoapChange,
  onGenerate,
  generating,
  disabled,
  autoFromChart,
  onAutoFromChartChange,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [listening, setListening] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const dictationBaseRef = useRef("");
  const autoGenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChartSummaryRef = useRef(chartSummary);
  const printRef = useRef<HTMLDivElement>(null);

  const speechSupported = typeof window !== "undefined" && !!getSpeechRecognition();

  const defaultTemplate =
    templates.find((t) => t.isDefault && t.type === "SOAP") ?? templates[0];

  useEffect(() => {
    if (!selectedTemplateId && defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Voice dictation is not supported in this browser");
      return;
    }
    dictationBaseRef.current = rawNotes.trim();
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText.trim()) {
        const next = dictationBaseRef.current
          ? `${dictationBaseRef.current} ${finalText.trim()}`
          : finalText.trim();
        dictationBaseRef.current = next;
        onRawNotesChange(next);
      }
    };
    recognition.onerror = () => {
      toast.error("Voice recognition error");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onRawNotesChange, rawNotes]);

  useEffect(() => {
    return () => {
      stopListening();
      if (autoGenTimeoutRef.current) clearTimeout(autoGenTimeoutRef.current);
    };
  }, [stopListening]);

  useEffect(() => {
    if (!autoFromChart || disabled || generating) return;
    if (chartSummary === lastChartSummaryRef.current) return;
    lastChartSummaryRef.current = chartSummary;
    if (!chartSummary.trim() || chartSummary === "No charted findings.") return;
    if (autoGenTimeoutRef.current) clearTimeout(autoGenTimeoutRef.current);
    autoGenTimeoutRef.current = setTimeout(() => {
      void onGenerate({ rawNotes, chartSummary });
    }, 2000);
    return () => {
      if (autoGenTimeoutRef.current) clearTimeout(autoGenTimeoutRef.current);
    };
  }, [autoFromChart, chartSummary, disabled, generating, onGenerate, rawNotes]);

  async function applyTemplate(templateId: string) {
    if (!patientId || !templateId) return;
    setTemplateLoading(true);
    const ctxResult = await getNoteAutoFillContext({ patientId, appointmentId });
    if (!ctxResult.success) {
      setTemplateLoading(false);
      toast.error(ctxResult.error);
      return;
    }

    const renderResult = await renderTemplate({
      templateId,
      variables: ctxResult.data.variables as Record<string, string | number>,
    });
    setTemplateLoading(false);

    if (!renderResult.success) {
      toast.error(renderResult.error);
      return;
    }

    const { soap: parsed, html, rendered } = renderResult.data;
    onSoapChange(parsed);
    setBodyHtml(html);
    onRawNotesChange(rendered);
    toast.success("Template applied with chart & appointment data");
  }

  async function handleEnhance() {
    const text = [soap?.subjective, soap?.objective, soap?.assessment, soap?.plan, rawNotes]
      .filter(Boolean)
      .join("\n\n");
    if (text.length < 10) {
      toast.error("Add note content before enhancing");
      return;
    }
    setEnhancing(true);
    const result = await enhanceNoteText({ text });
    setEnhancing(false);
    if (result.success) {
      setBodyHtml(plainTextToHtml(result.data));
      onRawNotesChange(result.data);
      toast.success("Note enhanced with AI");
    } else {
      toast.error(result.error);
    }
  }

  async function handleSave() {
    if (!patientId || !soap) return;
    setSaving(true);
    const result = await saveClinicalNote({
      patientId,
      appointmentId,
      templateId: selectedTemplateId || undefined,
      noteType: "SOAP",
      rawNotes,
      subjective: soap.subjective,
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
      bodyHtml: bodyHtml || plainTextToHtml(
        `S: ${soap.subjective}\n\nO: ${soap.objective}\n\nA: ${soap.assessment}\n\nP: ${soap.plan}`,
      ),
      toothNumbers,
      aiGenerated: true,
      aiEnhanced: enhancing,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Clinical note saved & signed");
      onRawNotesChange("");
      onSoapChange(null);
      setBodyHtml("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleSaveFromTemplateOnly() {
    if (!patientId || !selectedTemplateId) return;
    setSaving(true);
    const ctxResult = await getNoteAutoFillContext({ patientId, appointmentId });
    if (!ctxResult.success) {
      setSaving(false);
      toast.error(ctxResult.error);
      return;
    }
    const result = await createNoteFromTemplate({
      templateId: selectedTemplateId,
      patientId,
      appointmentId,
      variables: ctxResult.data.variables as Record<string, string | number>,
      toothNumbers,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Note created from template");
      onSoapChange(null);
      onRawNotesChange("");
      setBodyHtml("");
    } else {
      toast.error(result.error);
    }
  }

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Clinical Note</title>
      <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}.sig{margin-top:32px;border-top:1px solid #ccc;padding-top:12px;font-size:12px;color:#555}</style>
      </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  }

  const composedText = soap
    ? `S: ${soap.subjective}\n\nO: ${soap.objective}\n\nA: ${soap.assessment}\n\nP: ${soap.plan}`
    : rawNotes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-dental" />
          Clinical notes
          {appointmentId && (
            <Badge variant="outline" className="text-[10px] font-normal">
              Linked to appointment
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={(id) => {
                setSelectedTemplateId(id);
                void applyTemplate(id);
              }}
              disabled={disabled || templateLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.type.replace(/_/g, " ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {toothNumbers.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Linked teeth</Label>
              <p className="text-sm text-muted-foreground">{toothNumbers.join(", ")}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-chart-notes"
            checked={autoFromChart}
            onChange={(e) => onAutoFromChartChange(e.target.checked)}
            disabled={disabled}
            className="rounded border"
          />
          <Label htmlFor="auto-chart-notes" className="text-sm font-normal cursor-pointer">
            Auto-generate SOAP when chart findings change
          </Label>
        </div>

        <textarea
          className="w-full min-h-[80px] rounded-md border p-3 text-sm"
          placeholder="Rough notes or dictation…"
          value={rawNotes}
          onChange={(e) => onRawNotesChange(e.target.value)}
          disabled={disabled}
        />

        <div className="flex flex-wrap gap-2">
          {speechSupported && (
            <Button
              type="button"
              variant={listening ? "destructive" : "outline"}
              size="sm"
              disabled={disabled}
              onClick={listening ? stopListening : startListening}
            >
              {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
              {listening ? "Stop" : "Dictate"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={generating || disabled}
            onClick={() => void onGenerate({ rawNotes: rawNotes.trim() || undefined, chartSummary })}
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate SOAP
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={enhancing || disabled}
            onClick={() => void handleEnhance()}
          >
            {enhancing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            AI enhance
          </Button>
        </div>

        {chartSummary && chartSummary !== "No charted findings." && (
          <details className="rounded-md border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Auto-fill context (odontogram)</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]">{chartSummary}</pre>
          </details>
        )}

        {(soap || bodyHtml) && (
          <div className="space-y-3">
            {soap ? (
              <div className="space-y-3 rounded-lg border p-4 text-sm">
                {(["subjective", "objective", "assessment", "plan"] as const).map((key) => (
                  <div key={key}>
                    <p className="font-semibold uppercase text-xs text-muted-foreground">{key}</p>
                    <textarea
                      className="mt-1 w-full rounded border p-2"
                      value={soap[key]}
                      onChange={(e) => onSoapChange({ ...soap, [key]: e.target.value })}
                      rows={3}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs">Formatted note</Label>
              <RichTextEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                disabled={disabled}
                placeholder="Rich text clinical note…"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleSave()} disabled={saving || !soap}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & sign note
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !selectedTemplateId}
                onClick={() => void handleSaveFromTemplateOnly()}
              >
                Save from template
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>

            {providerName && (
              <p className="text-xs text-muted-foreground">
                Provider signature: <span className="font-medium">{providerName}</span> ·{" "}
                {new Date().toLocaleString()}
              </p>
            )}
          </div>
        )}

        <div ref={printRef} className="hidden">
          <h1>Clinical Note</h1>
          <p style={{ color: "#666", fontSize: "12px" }}>
            Patient ID: {patientId}
            {appointmentId ? ` · Appointment: ${appointmentId}` : ""}
          </p>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{composedText}</pre>
          {bodyHtml && <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />}
          <div className="sig">
            Signed: {providerName ?? "Provider"} · {new Date().toLocaleString()}
            {toothNumbers.length > 0 && <div>Teeth: {toothNumbers.join(", ")}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
