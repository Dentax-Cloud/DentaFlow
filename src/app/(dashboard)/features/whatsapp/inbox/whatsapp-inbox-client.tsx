"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, MessageSquare, Search, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { getPatientWhatsAppMessages, replyToPatientWhatsApp } from "../actions";

type Message = {
  id: string;
  direction: "IN" | "OUT";
  content: string;
  status: string;
  createdAt: Date;
  templateName?: string;
};

export function WhatsAppInbox() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Mock patient list - in production, this would come from the database
  const [patients] = useState([
    { id: "1", name: "Ahmed Al-Farsi", phone: "+971501234567" },
    { id: "2", name: "Priya Sharma", phone: "+919876543210" },
    { id: "3", name: "John Smith", phone: "+971559876543" },
  ]);

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
        // Refresh messages
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

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      {/* Patient List */}
      <Card className="w-80 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                className="pl-8"
              />
            </div>
            <div className="h-[calc(100vh-12rem)] overflow-y-auto">
              <div className="space-y-1">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPatientId === patient.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {patient.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{patient.phone}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Thread */}
      <Card className="flex-1 flex flex-col">
        {selectedPatient ? (
          <>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {selectedPatient.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p>{selectedPatient.name}</p>
                  <p className="text-sm font-normal text-muted-foreground">{selectedPatient.phone}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-4 py-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.direction === "OUT" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.direction === "OUT"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
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
              <div className="border-t pt-4 mt-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    className="flex-1 min-h-[60px] resize-none"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={isSending || !replyText.trim()}
                    size="icon"
                    className="h-[60px] w-[60px]"
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
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a patient to view messages</p>
              <p className="text-sm">Choose from the patient list on the left</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
