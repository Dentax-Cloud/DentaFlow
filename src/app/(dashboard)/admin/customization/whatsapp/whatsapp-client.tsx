"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getTenantWhatsAppConfig,
  saveTenantWhatsAppConfig,
  testWhatsAppConfig,
} from "@/app/(dashboard)/features/whatsapp/actions";

export function WhatsAppConfig() {
  const [config, setConfig] = useState({
    phoneNumberId: "",
    accessToken: "",
    businessName: "",
    isEnabled: false,
  });
  const [testPhone, setTestPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await getTenantWhatsAppConfig();
      if (result.success && result.config) {
        setConfig({
          phoneNumberId: result.config.phoneNumberId ?? "",
          accessToken: "",
          businessName: result.config.businessName ?? "",
          isEnabled: result.config.isEnabled ?? false,
        });
      }
    });
  }, []);

  useEffect(() => {
    setHasChanges(
      config.phoneNumberId !== "" ||
      config.accessToken !== "" ||
      config.businessName !== ""
    );
  }, [config]);

  async function handleSave() {
    if (!config.phoneNumberId || !config.accessToken) {
      toast.error("Phone Number ID and Access Token are required");
      return;
    }

    setIsSaving(true);
    startTransition(async () => {
      const result = await saveTenantWhatsAppConfig({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        businessName: config.businessName || undefined,
        isEnabled: config.isEnabled,
      });

      if (result.success) {
        toast.success("WhatsApp configuration saved successfully");
        setConfig(prev => ({ ...prev, accessToken: "" }));
        setHasChanges(false);
      } else {
        toast.error(result.error || "Failed to save configuration");
      }
      setIsSaving(false);
    });
  }

  async function handleTest() {
    if (!config.phoneNumberId || !config.accessToken || !testPhone) {
      toast.error("Please fill in all fields and test phone number");
      return;
    }

    setIsTesting(true);
    startTransition(async () => {
      const result = await testWhatsAppConfig({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        testPhone,
      });

      if (result.success) {
        toast.success("Test message sent successfully!");
      } else {
        toast.error(result.error || "Failed to send test message");
      }
      setIsTesting(false);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">WhatsApp Business Setup</h2>
        <p className="text-muted-foreground">
          Configure WhatsApp Business API to send appointment confirmations and reminders to patients.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Configuration</CardTitle>
          <CardDescription>
            Enter your Meta Business API credentials to enable WhatsApp messaging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-id">Phone Number ID</Label>
            <Input
              id="phone-id"
              placeholder="Enter Phone Number ID from Meta Business Suite"
              value={config.phoneNumberId}
              onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Found in Meta Business Suite → WhatsApp → Phone numbers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="Enter permanent access token"
              value={config.accessToken}
              onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Generate in Meta Developers → WhatsApp → Configuration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name (Optional)</Label>
            <Input
              id="business-name"
              placeholder="Your clinic or business name"
              value={config.businessName}
              onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="enable-whatsapp"
              checked={config.isEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, isEnabled: checked })}
            />
            <Label htmlFor="enable-whatsapp">Enable WhatsApp messaging</Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Send a test message to verify your WhatsApp setup is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Test Phone Number</Label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="+971501234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your phone number to receive a test message
            </p>
          </div>

          <Button onClick={handleTest} disabled={isTesting || !config.phoneNumberId || !config.accessToken}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Test Message
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Create a Meta Business account at <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">business.facebook.com</a></li>
            <li>Go to Meta for Developers and create a WhatsApp Business App</li>
            <li>Add your phone number in WhatsApp Manager</li>
            <li>Generate a permanent access token with required permissions</li>
            <li>Copy the Phone Number ID and Access Token to the fields above</li>
            <li>Click "Send Test Message" to verify the configuration</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
