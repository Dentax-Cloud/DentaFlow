"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Upload } from "lucide-react";
import { UploadButton, UploadDropzone } from "@/lib/uploadthing-client";
import { getUploadDisabledMessage } from "@/lib/uploadthing-env";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  patientId: string;
  uploadsEnabled: boolean;
  showAdminConfigHint?: boolean;
};

export function PatientAttachmentUploader({
  patientId,
  uploadsEnabled,
  showAdminConfigHint = false,
}: Props) {
  const router = useRouter();
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  const input = { patientId };

  function notifyUploadDisabled() {
    const message = getUploadDisabledMessage(showAdminConfigHint).replace(
      "Photo upload",
      "File upload",
    );
    setConfigMessage(message);
    toast.error(message);
  }

  if (!uploadsEnabled) {
    return (
      <div className="space-y-3">
        {configMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{configMessage}</span>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag files here or use the button below to upload documents.
          </p>
          <Button type="button" variant="outline" onClick={notifyUploadDisabled}>
            Upload files
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <UploadDropzone
        endpoint="patientAttachment"
        input={input}
        onClientUploadComplete={() => {
          toast.success("Upload complete");
          router.refresh();
        }}
        onUploadError={(error) => {
          toast.error(error.message);
        }}
      />
      <UploadButton
        endpoint="patientAttachment"
        input={input}
        onClientUploadComplete={() => {
          toast.success("Upload complete");
          router.refresh();
        }}
        onUploadError={(error) => {
          toast.error(error.message);
        }}
      />
    </div>
  );
}
