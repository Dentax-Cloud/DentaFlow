"use client";

import { useState, useTransition, useEffect } from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES } from "@/lib/settings/platform-settings";
import { PricingPanel } from "./pricing-panel";
import type { SettingDisplay } from "@/lib/settings/platform-settings";
import {
  getSettingsByCategory,
  getSettingsOverview,
  saveSetting,
  removeSetting,
  testOpenAI,
  testEmailSMTP,
  sendTestEmail,
  testStripe,
  testUploadThing,
} from "./actions";

type OverviewItem = Awaited<ReturnType<typeof getSettingsOverview>>[number];

function SourceBadge({ source, hasValue }: { source: SettingDisplay["source"]; hasValue: boolean }) {
  if (!hasValue && source === "none") {
    return (
      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
        Not set ⚠
      </span>
    );
  }

  const config = {
    db: { label: "Saved in DB ✓", className: "bg-green-100 text-green-800 border-green-200" },
    env: { label: "From .env", className: "bg-blue-100 text-blue-800 border-blue-200" },
    default: { label: "Default", className: "bg-gray-100 text-gray-600 border-gray-200" },
    none: { label: "Not set ⚠", className: "bg-orange-100 text-orange-700 border-orange-200" },
  }[source];

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function StatusChip({ label, icon, isConfigured }: Omit<OverviewItem, "key">) {
  return (
    <div
      className={`rounded-lg border p-2 text-center text-xs ${
        isConfigured
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      <p className="text-base">{icon}</p>
      <p className="font-medium">{label}</p>
      <p>{isConfigured ? "✓" : "—"}</p>
    </div>
  );
}

function SettingField({
  setting,
  onSave,
  onClear,
}: {
  setting: SettingDisplay;
  onSave: (key: string, value: string) => Promise<void>;
  onClear: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState(setting.displayValue ?? "");
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setValue(setting.displayValue ?? "");
    setNewValue("");
    setIsUpdating(false);
    setShowValue(false);
  }, [setting.key, setting.displayValue, setting.hasValue, setting.source]);

  const label = setting.key.replace(/_/g, " ");
  const maskedText =
    setting.maskedValue ??
    (setting.source === "env" ? "••••••••••••••••" : "••••••••••••••••");

  async function handleSave(inputValue: string) {
    if (!inputValue.trim()) return;

    startTransition(async () => {
      try {
        await onSave(setting.key, inputValue.trim());
        setStatus({ type: "success", message: isUpdating ? "Updated successfully" : "Saved successfully" });
        setNewValue("");
        setValue("");
        setIsUpdating(false);
        setTimeout(() => setStatus(null), 3000);
      } catch (err: unknown) {
        setStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Save failed",
        });
      }
    });
  }

  async function handleClear() {
    const fallback =
      setting.source === "env"
        ? "The system will fall back to the .env value if set."
        : "The feature may be disabled until a new value is saved.";
    if (!confirm(`Remove ${setting.key}? ${fallback}`)) return;

    startTransition(async () => {
      await onClear(setting.key);
      setValue("");
      setNewValue("");
      setIsUpdating(false);
      setStatus({ type: "success", message: "Removed" });
      setTimeout(() => setStatus(null), 2000);
    });
  }

  function cancelUpdate() {
    setIsUpdating(false);
    setNewValue("");
    setShowValue(false);
  }

  if (setting.inputType === "toggle") {
    const isOn = (setting.displayValue ?? "false") === "true";

    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
          {setting.warning && (
            <p className="mt-1 text-xs text-red-600">⚠ {setting.warning}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={setting.source} hasValue={setting.hasValue} />
          <span className={`text-xs font-semibold ${isOn ? "text-green-600" : "text-gray-500"}`}>
            {isOn ? "ON" : "OFF"}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const newVal = isOn ? "false" : "true";
              startTransition(async () => {
                await onSave(setting.key, newVal);
              });
            }}
            className={`relative h-6 w-12 rounded-full transition-colors ${
              isOn ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isOn ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  if (setting.inputType === "select") {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          </div>
          <SourceBadge source={setting.source} hasValue={setting.hasValue} />
        </div>
        <div className="flex gap-2">
          <select
            value={value || setting.displayValue || ""}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 rounded-md border bg-white px-3 py-2 text-sm"
          >
            {setting.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => handleSave(value)} disabled={isPending || !value}>
            Save
          </Button>
        </div>
        {status && (
          <p className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {status.message}
          </p>
        )}
      </div>
    );
  }

  if (setting.encrypted && setting.hasValue && !isUpdating) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          </div>
          <SourceBadge source={setting.source} hasValue={setting.hasValue} />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Lock className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="flex-1 font-mono text-sm text-gray-600">{maskedText}</span>
          <span className="text-xs font-medium text-green-600">✓ Configured</span>
        </div>

        {setting.keyVersion && setting.source === "db" && (
          <p className="text-xs text-muted-foreground">Encryption version: {setting.keyVersion}</p>
        )}

        {setting.source === "env" && (
          <p className="rounded bg-blue-50 p-2 text-xs text-blue-600">
            Using environment variable. Save here to override — database values take precedence over
            .env.
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsUpdating(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Update key
          </Button>
          {setting.source === "db" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              disabled={isPending}
              className="text-red-400 hover:text-red-600"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>

        {status && (
          <p className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {status.message}
          </p>
        )}
      </div>
    );
  }

  if (setting.encrypted) {
    return (
      <div
        className={`space-y-2 rounded-lg border p-4 ${
          isUpdating ? "border-2 border-blue-400 bg-blue-50" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {isUpdating ? `Update ${label}` : label}
          </p>
          <div className="flex items-center gap-2">
            <SourceBadge source={setting.source} hasValue={setting.hasValue} />
            {isUpdating && (
              <button
                type="button"
                onClick={cancelUpdate}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{setting.description}</p>

        {isUpdating && (
          <p className="rounded bg-orange-50 p-2 text-xs text-orange-600">
            ⚠ You are replacing the existing key. The old key will be overwritten immediately on
            save.
          </p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showValue ? "text" : "password"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={setting.placeholder ?? "Enter value..."}
              autoFocus={isUpdating}
              className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${
                isUpdating ? "border-blue-400 focus:ring-2 focus:ring-blue-500" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showValue ? "Hide" : "Show"}
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => handleSave(newValue)}
            disabled={isPending || !newValue.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? "Updating..." : isUpdating ? "Update" : "Save"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          💡 Paste your key and click {isUpdating ? "Update" : "Save"}. It will be encrypted before
          storage.
        </p>

        {status && (
          <p className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {status.message}
          </p>
        )}
      </div>
    );
  }

  const isDirty = value !== (setting.displayValue ?? "");

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge source={setting.source} hasValue={setting.hasValue} />
          {setting.hasValue && setting.source === "db" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isPending}
              className="h-7 text-xs text-red-400 hover:text-red-600"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={setting.placeholder}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            isDirty ? "border-blue-400 bg-blue-50" : ""
          }`}
        />
        <Button size="sm" onClick={() => handleSave(value)} disabled={isPending || !isDirty}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      {setting.source === "env" && (
        <p className="text-xs text-blue-600">
          Using environment variable. Save here to override with a database value.
        </p>
      )}

      {isDirty && <p className="text-xs text-blue-600">● Unsaved change</p>}
      {status && (
        <p className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}

function TestButton({
  label,
  onTest,
  extraInput,
  externalResult,
}: {
  label: string;
  onTest: (extra?: string) => Promise<{ success: boolean; message: string }>;
  extraInput?: { placeholder: string; label: string };
  externalResult?: { success: boolean; message: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [inputVal, setInputVal] = useState("");

  const displayResult = externalResult ?? result;

  useEffect(() => {
    if (externalResult) {
      const timer = setTimeout(() => setResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [externalResult]);

  function handleTest() {
    startTransition(async () => {
      const res = await onTest(extraInput ? inputVal : undefined);
      setResult(res);
      setTimeout(() => setResult(null), 5000);
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {extraInput && (
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={extraInput.placeholder}
          className="w-52 rounded-md border px-3 py-1.5 text-sm"
        />
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={isPending || (!!extraInput && !inputVal)}
      >
        {isPending ? "Testing..." : label}
      </Button>
      {displayResult && (
        <span
          className={`text-xs font-medium ${displayResult.success ? "text-green-600" : "text-red-600"}`}
        >
          {displayResult.success ? "✓" : "✗"} {displayResult.message}
        </span>
      )}
    </div>
  );
}

function CategoryPanel({
  category,
  onSettingsChange,
}: {
  category: string;
  onSettingsChange?: () => void;
}) {
  const [settings, setSettings] = useState<SettingDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoTestResult, setAutoTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    getSettingsByCategory(category).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [category]);

  async function refreshSettings() {
    setSettings(await getSettingsByCategory(category));
    onSettingsChange?.();
  }

  async function handleSave(key: string, value: string) {
    await saveSetting(key, value);
    await refreshSettings();

    if (category === "AI" && key === "OPENAI_API_KEY") {
      const res = await testOpenAI();
      setAutoTestResult({
        success: res.success,
        message: res.success ? "Connected to OpenAI" : res.message,
      });
      setTimeout(() => setAutoTestResult(null), 5000);
    }

    if (category === "STORAGE" && key === "UPLOADTHING_TOKEN") {
      const res = await testUploadThing();
      setAutoTestResult({
        success: res.success,
        message: res.success ? "Connected to UploadThing" : res.message,
      });
      setTimeout(() => setAutoTestResult(null), 5000);
    }
  }

  async function handleClear(key: string) {
    await removeSetting(key);
    await refreshSettings();
    if (key === "OPENAI_API_KEY" || key === "UPLOADTHING_TOKEN") {
      setAutoTestResult(null);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settings.map((setting) => (
        <SettingField
          key={setting.key}
          setting={setting}
          onSave={handleSave}
          onClear={handleClear}
        />
      ))}

      {category === "AI" && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Test connection</CardTitle>
          </CardHeader>
          <CardContent>
            <TestButton
              label="🤖 Test OpenAI"
              onTest={testOpenAI}
              externalResult={autoTestResult}
            />
          </CardContent>
        </Card>
      )}

      {category === "EMAIL" && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Test connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TestButton label="📡 Verify SMTP" onTest={testEmailSMTP} />
            <TestButton
              label="📧 Send test email"
              onTest={(email) => sendTestEmail(email ?? "")}
              extraInput={{ label: "To email", placeholder: "your@email.com" }}
            />
          </CardContent>
        </Card>
      )}

      {category === "STRIPE" && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Test connection</CardTitle>
          </CardHeader>
          <CardContent>
            <TestButton label="💳 Test Stripe" onTest={testStripe} />
          </CardContent>
        </Card>
      )}

      {category === "STORAGE" && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Test connection</CardTitle>
          </CardHeader>
          <CardContent>
            <TestButton
              label="📁 Test UploadThing"
              onTest={testUploadThing}
              externalResult={autoTestResult}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PlatformSettingsClient() {
  const [overview, setOverview] = useState<OverviewItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  function loadOverview() {
    getSettingsOverview()
      .then(setOverview)
      .finally(() => setOverviewLoading(false));
  }

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Integration status</h2>
        {overviewLoading ? (
          <div className="grid animate-pulse grid-cols-3 gap-2 md:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {overview.map(({ key, ...item }) => (
              <StatusChip key={key} {...item} />
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="AI">
        <TabsList className="grid w-full grid-cols-7">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
              {cat.icon} {cat.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="PRICING" className="text-xs">
            💰 Pricing
          </TabsTrigger>
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4">
            <CategoryPanel category={cat.key} onSettingsChange={loadOverview} />
          </TabsContent>
        ))}
        <TabsContent value="PRICING" className="mt-4">
          <PricingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
