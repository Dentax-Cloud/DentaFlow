"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, MessageSquare, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  getPatientWhatsAppMessages,
  getWhatsAppInboxPatients,
  replyToPatientWhatsApp,
} from "../actions";

type Message = {
  id: string;
  direction: "IN" | "OUT";
  content: string;
  status: string;
  createdAt: Date;
  templateName?: string;
};

type InboxPatient = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
};

export function WhatsAppInbox() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<InboxPatient[]>([]);
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getWhatsAppInboxPatients();
      if (result.success) {
        setPatients(result.patients);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      startTransition(async () => {
        const result = await getPatientWhatsAppMessages(selectedPatientId);
        if (result.success) {
          setMessages(result.messages);
        }
      });
    }
  }, [selectedPatientId]);

  async function handleSendReply() {
    if (!selectedPatientId || !replyText.trim()) return;

    setIsSending(true);
    startTransition(async () => {
      const result = await replyToPatientWhatsApp({
        patientId: selectedPatientId,
        content: replyText,
      });

      if (result.success) {
        toast.success("Reply sent successfully");
        setReplyText("");
        const updated = await getPatientWhatsAppMessages(selectedPatientId);
        if (updated.success) {
          setMessages(updated.messages);
        }
      } else {
        toast.error(result.error || "Failed to send reply");
      }
      setIsSending(false);
    });
  }

  const filteredPatients = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.phone.includes(q);
  });

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 lg:flex-row">
      <Card className="flex w-full flex-col lg:w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
              <div className="space-y-1">
                {filteredPatients.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No patients with phone numbers found
                  </p>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedPatientId === patient.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {patient.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{patient.name}</p>
                          <p
                            className={`truncate text-xs ${
                              selectedPatientId === patient.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            }`}
                          >
                            {patient.phone}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col">
        {selectedPatient ? (
          <>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {selectedPatient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p>{selectedPatient.name}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    {selectedPatient.phone}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-4 py-4">
                  {messages.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    [...messages].reverse().map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.direction === "OUT" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg p-3 sm:max-w-[70%] ${
                            message.direction === "OUT"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                            <Clock className="h-3 w-3" />
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {message.status && (
                              <span className="capitalize">{message.status.toLowerCase()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 border-t pt-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    placeholder="Type your message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendReply();
                      }
                    }}
                    className="min-h-[60px] flex-1 resize-none"
                  />
                  <Button
                    onClick={() => void handleSendReply()}
                    disabled={isSending || isPending || !replyText.trim()}
                    size="icon"
                    className="h-[60px] w-full sm:w-[60px]"
                  >
                    {isSending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex flex-1 items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-4 h-16 w-16 opacity-50" />
              <p className="text-lg">Select a patient to view messages</p>
              <p className="text-sm">Choose from the patient list on the left</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
