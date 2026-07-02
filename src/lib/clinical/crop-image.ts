/** Center-crop an image blob to a square JPEG (profile photos). */
export async function cropImageToSquare(blob: Blob, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image");

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.9,
    );
  });
}
