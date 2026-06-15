"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Soap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type Props = {
  rawNotes: string;
  onRawNotesChange: (value: string) => void;
  soap: Soap | null;
  onSoapChange: (soap: Soap | null) => void;
  chartSummary: string;
  onGenerate: (opts: { rawNotes?: string; chartSummary?: string }) => Promise<void>;
  onSave: () => Promise<void>;
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

export function ClinicalNotesSection({
  rawNotes,
  onRawNotesChange,
  soap,
  onSoapChange,
  chartSummary,
  onGenerate,
  onSave,
  generating,
  disabled,
  autoFromChart,
  onAutoFromChartChange,
}: Props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoGenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChartSummaryRef = useRef(chartSummary);

  const speechSupported = typeof window !== "undefined" && !!getSpeechRecognition();

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const dictationBaseRef = useRef("");

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
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        }
      }
      if (finalText.trim()) {
        const base = dictationBaseRef.current;
        const next = base ? `${base} ${finalText.trim()}` : finalText.trim();
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
    toast.message("Listening… speak clinical notes");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-dental" />
          AI Clinical Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          className="w-full min-h-[100px] rounded-md border p-3 text-sm"
          placeholder="Enter rough clinical notes or use voice dictation…"
          value={rawNotes}
          onChange={(e) => onRawNotesChange(e.target.value)}
          disabled={disabled}
        />

        <div className="flex flex-wrap gap-2">
          {speechSupported && (
            <Button
              type="button"
              variant={listening ? "destructive" : "outline"}
              disabled={disabled}
              onClick={listening ? stopListening : startListening}
            >
              {listening ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop dictation
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Voice dictation
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            disabled={generating || disabled}
            onClick={() =>
              void onGenerate({
                rawNotes: rawNotes.trim() || undefined,
                chartSummary,
              })
            }
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate SOAP"
            )}
          </Button>
        </div>

        {chartSummary && chartSummary !== "No charted findings." && (
          <details className="rounded-md border bg-muted/30 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Chart context for AI
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]">{chartSummary}</pre>
          </details>
        )}

        {soap && (
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
            <Button type="button" onClick={() => void onSave()} disabled={disabled}>
              Save reviewed note
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
