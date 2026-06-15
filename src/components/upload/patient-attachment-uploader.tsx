"use client";

import { useRouter } from "next/navigation";
import { UploadButton, UploadDropzone } from "@/lib/uploadthing-client";
import { toast } from "sonner";

type Props = {
  patientId: string;
  uploadsEnabled: boolean;
};

export function PatientAttachmentUploader({ patientId, uploadsEnabled }: Props) {
  const router = useRouter();

  if (!uploadsEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        File uploads are disabled. Set <span className="font-mono">UPLOADTHING_TOKEN</span>{" "}
        in <span className="font-mono">.env</span> (UploadThing dashboard → API Keys → V7).
      </p>
    );
  }

  const input = { patientId };

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
