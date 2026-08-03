"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing-client";
import { getUploadDisabledMessage } from "@/lib/uploadthing-env";
import { setInventoryItemImageUrl } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { InventoryItemThumb } from "@/components/inventory/inventory-item-thumb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  inventoryItemId: string;
  itemName: string;
  imageUrl: string | null;
  /** When false, show read-only thumbnail only (no upload controls). */
  canWrite: boolean;
  uploadConfigured: boolean;
};

export function InventoryItemPhotoUpload({
  inventoryItemId,
  itemName,
  imageUrl: initialUrl,
  canWrite,
  uploadConfigured,
}: Props) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  const { startUpload, isUploading } = useUploadThing("inventoryItemImage", {
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const okType = file.type === "image/jpeg" || file.type === "image/png";
    if (!okType) {
      toast.error("JPEG or PNG only");
      return;
    }

    setBusy(true);
    try {
      const uploaded = await startUpload([file], { inventoryItemId });
      const first = uploaded?.[0] as
        | { url?: string; ufsUrl?: string; serverData?: { url?: string } }
        | undefined;
      const url = first?.serverData?.url ?? first?.ufsUrl ?? first?.url;
      if (!url) {
        toast.error("Upload failed");
        return;
      }
      await setInventoryItemImageUrl({ inventoryItemId, imageUrl: url });
      setImageUrl(url);
      toast.success("Photo saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearPhoto() {
    setBusy(true);
    try {
      await setInventoryItemImageUrl({ inventoryItemId, imageUrl: null });
      setImageUrl(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || isUploading;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <InventoryItemThumb imageUrl={imageUrl} name={itemName} size="lg" />
      {canWrite ? (
        <div className="space-y-2">
          <Label htmlFor={`inv-photo-${inventoryItemId}`}>Product photo</Label>
          {!uploadConfigured ? (
            <p className="text-sm text-muted-foreground">{getUploadDisabledMessage(false)}</p>
          ) : (
            <>
              <input
                id={`inv-photo-${inventoryItemId}`}
                type="file"
                accept="image/jpeg,image/png"
                disabled={working}
                onChange={onFileChange}
                className="block w-full max-w-xs text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              />
              <p className="text-xs text-muted-foreground">JPEG or PNG, max 4MB.</p>
              {imageUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={working}
                  onClick={clearPhoto}
                >
                  Remove photo
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {imageUrl ? "Product photo" : "No photo uploaded"}
        </p>
      )}
    </div>
  );
}
