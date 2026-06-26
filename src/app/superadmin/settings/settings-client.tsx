"use client";

import { useState, useTransition, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES } from "@/lib/settings/platform-settings";
import type { SettingDisplay } from "@/lib/settings/platform-settings";
import {
  getSettingsByCategory,
  saveSetting,
  removeSetting,
  testOpenAI,
  testEmailSMTP,
  sendTestEmail,
  testStripe,
} from "./actions";

function SourceBadge({ source }: { source: SettingDisplay["source"] }) {
  const config = {
    db: { label: "Saved in DB", className: "bg-green-100 text-green-800 border-green-200" },
    env: { label: "From .env", className: "bg-blue-100 text-blue-800 border-blue-200" },
    default: { label: "Default value", className: "bg-gray-100 text-gray-600 border-gray-200" },
    none: { label: "Not set", className: "bg-red-100 text-red-700 border-red-200" },
  }[source];

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
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
  const [showValue, setShowValue] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isDirty = setting.encrypted
    ? value !== "" && !value.includes("•")
    : value !== (setting.displayValue ?? "");
  const displayInField = setting.encrypted
    ? setting.hasValue
      ? "••••••••••••••••"
      : ""
    : value;

  async function handleSave() {
    if (!value) return;

    if (value.includes("•") || value === "••••••••••••••••") return;

    if (setting.encrypted && setting.hasValue && !isDirty) return;

    startTransition(async () => {
      try {
        await onSave(setting.key, value);
        setStatus({ type: "success", message: "Saved successfully" });
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
    if (!confirm(`Clear ${setting.key}? This will remove it from the database.`)) return;
    startTransition(async () => {
      await onClear(setting.key);
      setValue("");
      setStatus({ type: "success", message: "Cleared" });
      setTimeout(() => setStatus(null), 2000);
    });
  }

  if (setting.inputType === "toggle") {
    const isOn = (setting.displayValue ?? "false") === "true";
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{setting.key.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
          {setting.warning && (
            <p className="mt-1 text-xs text-red-600">⚠ {setting.warning}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SourceBadge source={setting.source} />
          <button
            type="button"
            onClick={() => {
              const newVal = isOn ? "false" : "true";
              setValue(newVal);
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
            <p className="text-sm font-medium">{setting.key.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          </div>
          <SourceBadge source={setting.source} />
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
          <Button size="sm" onClick={handleSave} disabled={isPending}>
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

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{setting.key.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge source={setting.source} />
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
        <div className="relative flex-1">
          <input
            type={setting.encrypted && !showValue ? "password" : "text"}
            value={setting.encrypted ? (isDirty ? value : displayInField) : value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              setting.hasValue && setting.encrypted
                ? "Enter new value to update (leave blank to keep current)"
                : setting.placeholder
            }
            className={`w-full rounded-md border px-3 py-2 font-mono text-sm ${
              isDirty ? "border-blue-400 bg-blue-50" : ""
            }`}
          />
          {setting.encrypted && (
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showValue ? "Hide" : "Show"}
            </button>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={
            isPending ||
            !value ||
            value.includes("•") ||
            (setting.encrypted && setting.hasValue && !isDirty)
          }
          className={isDirty ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          {isPending ? "..." : "Save"}
        </Button>
      </div>

      {isDirty && <p className="text-xs text-blue-600">● Unsaved change</p>}
      {status && (
        <p className={`text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {status.type === "success" ? "✓" : "✗"} {status.message}
        </p>
      )}
    </div>
  );
}

function TestButton({
  label,
  onTest,
  extraInput,
}: {
  label: string;
  onTest: (extra?: string) => Promise<{ success: boolean; message: string }>;
  extraInput?: { placeholder: string; label: string };
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [inputVal, setInputVal] = useState("");

  function handleTest() {
    startTransition(async () => {
      const res = await onTest(extraInput ? inputVal : undefined);
      setResult(res);
      setTimeout(() => setResult(null), 5000);
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
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
      {result && (
        <span
          className={`text-xs font-medium ${result.success ? "text-green-600" : "text-red-600"}`}
        >
          {result.success ? "✓" : "✗"} {result.message}
        </span>
      )}
    </div>
  );
}

function CategoryPanel({ category }: { category: string }) {
  const [settings, setSettings] = useState<SettingDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettingsByCategory(category).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [category]);

  async function handleSave(key: string, value: string) {
    await saveSetting(key, value);
    setSettings(await getSettingsByCategory(category));
  }

  async function handleClear(key: string) {
    await removeSetting(key);
    setSettings(await getSettingsByCategory(category));
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
            <TestButton label="🤖 Test OpenAI" onTest={testOpenAI} />
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
    </div>
  );
}

export default function PlatformSettingsClient() {
  return (
    <Tabs defaultValue="AI">
      <TabsList className="grid w-full grid-cols-6">
        {CATEGORIES.map((cat) => (
          <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
            {cat.icon} {cat.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {CATEGORIES.map((cat) => (
        <TabsContent key={cat.key} value={cat.key} className="mt-4">
          <CategoryPanel category={cat.key} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
