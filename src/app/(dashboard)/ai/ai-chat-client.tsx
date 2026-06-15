"use client";

import { useChat } from "ai/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { Sparkles, Send } from "lucide-react";

export function AiChatClient({
  tenantName,
  plan,
}: {
  tenantName: string;
  plan: SubscriptionPlan;
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai/chat",
    body: { role: "staff" },
  });

  if (plan === "STARTER") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">AI Assistant</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-dental" />
            <p className="mt-4 text-muted-foreground">
              Upgrade to Professional or Enterprise to use the AI assistant.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div>
        <h1 className="text-3xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">
          Practice Q&A for {tenantName} — not medical advice
        </p>
        <Badge variant="outline" className="mt-2">
          Staff mode · General guidance only
        </Badge>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-dental" />
            Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto pb-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask about scheduling, billing workflows, or practice operations.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-dental/10"
                    : "mr-8 bg-muted"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a question..."
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
