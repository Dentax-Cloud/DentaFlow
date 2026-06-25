"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/lib/ids/use-barcode-scanner";
import { scanSupplierBarcode, posItemSale } from "@/app/(dashboard)/features/inventory/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Minus, Plus, ShoppingCart } from "lucide-react";

type CartItem = {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  stock: number;
};

export function PosTerminal() {
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const addToCart = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const result = await scanSupplierBarcode(code);
      if (!result.found || !result.item) {
        toast.error("Barcode not recognized");
        return;
      }
      const item = result.item as {
        id: string;
        name: string;
        quantity: number;
        retailPrice?: number | null;
        taxRate?: number | null;
        isSellable?: boolean;
      };
      if (!item.isSellable) {
        toast.error("Item is not sellable");
        return;
      }
      const unitPrice = Number(item.retailPrice ?? 0);
      setCart((prev) => {
        const existing = prev.find((c) => c.inventoryItemId === item.id);
        if (existing) {
          return prev.map((c) =>
            c.inventoryItemId === item.id ? { ...c, quantity: c.quantity + (result.packSize ?? 1) } : c,
          );
        }
        return [
          ...prev,
          {
            inventoryItemId: item.id,
            name: item.name,
            quantity: result.packSize ?? 1,
            unitPrice,
            taxRate: Number(item.taxRate ?? 5),
            stock: item.quantity,
          },
        ];
      });
      toast.success(`Added: ${item.name}`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useBarcodeScanner((code) => void addToCart(code));

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax = cart.reduce((s, i) => s + (i.unitPrice * i.quantity * i.taxRate) / 100, 0);
  const total = subtotal + tax;

  async function completeSale(method: "CASH" | "CARD") {
    setBusy(true);
    try {
      for (const line of cart) {
        await posItemSale({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
        });
      }
      toast.success(`${method} sale complete: ${formatCurrency(total)}`);
      setCart([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            POS Terminal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addToCart(barcode);
              setBarcode("");
            }}
          >
            <Input
              className="font-mono text-lg"
              placeholder="Scan barcode..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={busy}>
              Add
            </Button>
          </form>

          <div className="space-y-2">
            {cart.map((line) => (
              <div
                key={line.inventoryItemId}
                className="flex items-center justify-between rounded border p-3"
              >
                <div>
                  <div className="font-medium">{line.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(line.unitPrice)} · Stock: {line.stock}
                    {line.stock < 3 && (
                      <span className="ml-2 text-orange-600">Low stock</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((c) =>
                          c.inventoryItemId === line.inventoryItemId && c.quantity > 1
                            ? { ...c, quantity: c.quantity - 1 }
                            : c,
                        ),
                      )
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{line.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((c) =>
                          c.inventoryItemId === line.inventoryItemId
                            ? { ...c, quantity: c.quantity + 1 }
                            : c,
                        ),
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="w-20 text-right font-medium">
                    {formatCurrency(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">Scan items to add to cart</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>VAT</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <Button className="w-full" disabled={cart.length === 0 || busy} onClick={() => void completeSale("CASH")}>
            Cash
          </Button>
          <Button className="w-full" variant="secondary" disabled={cart.length === 0 || busy} onClick={() => void completeSale("CARD")}>
            Card
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
