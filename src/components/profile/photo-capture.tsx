"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCamera } from "@/lib/clinical/use-camera";
import { cropImageToSquare } from "@/lib/clinical/crop-image";
import { getUploadDisabledMessage } from "@/lib/uploadthing-env";
import { useUploadThing } from "@/lib/uploadthing-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonAvatar } from "@/components/profile/person-avatar";

type ProfileEntityType = "patient" | "staff";

type ProfilePhotoCaptureProps = {
  mode?: "profile";
  entityType: ProfileEntityType;
  entityId: string;
  currentPhotoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  uploadsEnabled?: boolean;
  showAdminConfigHint?: boolean;
  onPhotoUpdated?: (url: string) => void;
};

type InsuranceCardPhotoCaptureProps = {
  mode: "insuranceCard";
  policyId: string;
  side: "front" | "back";
  currentPhotoUrl?: string | null;
  label?: string;
  uploadsEnabled?: boolean;
  showAdminConfigHint?: boolean;
  onPhotoUpdated?: (url: string) => void;
};

type Props = ProfilePhotoCaptureProps | InsuranceCardPhotoCaptureProps;

type PreviewState = {
  blob: Blob;
  previewUrl: string;
};

export function PhotoCapture(props: Props) {
  const isInsuranceCard = props.mode === "insuranceCard";
  const uploadsEnabled = props.uploadsEnabled ?? true;
  const showAdminConfigHint = props.showAdminConfigHint ?? false;
  const onPhotoUpdated = props.onPhotoUpdated;

  const entityType = !isInsuranceCard ? props.entityType : undefined;
  const entityId = !isInsuranceCard ? props.entityId : props.policyId;
  const currentPhotoUrl = props.currentPhotoUrl;
  const firstName = !isInsuranceCard ? props.firstName : undefined;
  const lastName = !isInsuranceCard ? props.lastName : undefined;
  const email = !isInsuranceCard ? props.email : undefined;
  const insuranceSide = isInsuranceCard ? props.side : undefined;
  const insuranceLabel = isInsuranceCard ? (props.label ?? "Insurance card") : "Profile photo";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [displayUrl, setDisplayUrl] = useState(currentPhotoUrl ?? null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisplayUrl(currentPhotoUrl ?? null);
  }, [currentPhotoUrl]);

  const {
    videoRef,
    isActive,
    isSupported,
    error: cameraError,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
  } = useCamera();

  const onUploadComplete = useCallback(
    (url: string) => {
      setDisplayUrl(url);
      onPhotoUpdated?.(url);
      toast.success("Photo saved");
    },
    [onPhotoUpdated],
  );

  const profileUpload = useUploadThing("profilePhoto", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url;
      if (url) onUploadComplete(url);
    },
    onUploadError: (err) => {
      toast.error(err.message);
    },
  });

  const insuranceUpload = useUploadThing("insuranceCardPhoto", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url;
      if (url) onUploadComplete(url);
    },
    onUploadError: (err) => {
      toast.error(err.message);
    },
  });

  const isUploading = isInsuranceCard ? insuranceUpload.isUploading : profileUpload.isUploading;

  const notifyUploadDisabled = useCallback(() => {
    const message = getUploadDisabledMessage(showAdminConfigHint);
    setConfigMessage(message);
    toast.error(message);
  }, [showAdminConfigHint]);

  const clearPreview = useCallback(() => {
    if (preview?.previewUrl) URL.revokeObjectURL(preview.previewUrl);
    setPreview(null);
  }, [preview]);

  const preparePreview = useCallback(async (blob: Blob) => {
    try {
      const cropped = await cropImageToSquare(blob);
      clearPreview();
      setPreview({ blob: cropped, previewUrl: URL.createObjectURL(cropped) });
    } catch {
      toast.error("Could not process image");
    }
  }, [clearPreview]);

  const handleFileSelect = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setConfigMessage(null);
      await preparePreview(file);
    },
    [preparePreview],
  );

  const handleCapture = useCallback(async () => {
    const blob = await capturePhoto();
    if (!blob) return;
    stopCamera();
    setConfigMessage(null);
    await preparePreview(blob);
  }, [capturePhoto, preparePreview, stopCamera]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    if (!uploadsEnabled) {
      notifyUploadDisabled();
      return;
    }
    const file = new File(
      [preview.blob],
      isInsuranceCard ? `insurance-${entityId}-${insuranceSide}.jpg` : `profile-${entityId}.jpg`,
      { type: "image/jpeg" },
    );
    if (isInsuranceCard) {
      await insuranceUpload.startUpload([file], {
        policyId: entityId,
        side: insuranceSide!,
      });
    } else {
      await profileUpload.startUpload([file], {
        entityType: entityType!,
        entityId,
      });
    }
    clearPreview();
  }, [
    preview,
    uploadsEnabled,
    notifyUploadDisabled,
    profileUpload,
    insuranceUpload,
    entityType,
    entityId,
    clearPreview,
    isInsuranceCard,
    insuranceSide,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {isInsuranceCard ? (
          <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {displayUrl ? (
              <img src={displayUrl} alt={insuranceLabel} className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">No image</span>
            )}
          </div>
        ) : (
          <PersonAvatar
            photoUrl={displayUrl}
            firstName={firstName}
            lastName={lastName}
            email={email}
            size="lg"
          />
        )}
        <div>
          <p className="text-sm font-medium">{insuranceLabel}</p>
          <p className="text-xs text-muted-foreground">
            Square crop applied automatically. Upload or use your camera.
          </p>
        </div>
      </div>

      {configMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{configMessage}</span>
        </div>
      )}

      {preview ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Preview</p>
          <div className="mx-auto aspect-square w-48 overflow-hidden rounded-lg border">
            <img src={preview.previewUrl} alt="Preview" className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void handleConfirm()} disabled={isUploading}>
              {isUploading ? "Saving..." : "Confirm & save"}
            </Button>
            <Button type="button" variant="outline" onClick={clearPreview} disabled={isUploading}>
              Retake
            </Button>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-2" disabled={!isSupported}>
              <Camera className="h-4 w-4" />
              Camera
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose image
            </Button>
          </TabsContent>

          <TabsContent value="camera" className="mt-4 space-y-3">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                Camera not supported in this browser. Use upload instead.
              </p>
            ) : (
              <>
                <div className="relative aspect-square max-w-sm overflow-hidden rounded-lg bg-black">
                  {isActive ? (
                    <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center p-4 text-center text-sm text-white">
                      {cameraError ?? "Open the camera to capture a photo"}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isActive ? (
                    <Button type="button" onClick={() => void startCamera("user")}>
                      Open camera
                    </Button>
                  ) : (
                    <>
                      <Button type="button" onClick={() => void handleCapture()}>
                        Capture
                      </Button>
                      <Button type="button" variant="outline" onClick={flipCamera}>
                        Flip
                      </Button>
                      <Button type="button" variant="outline" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
