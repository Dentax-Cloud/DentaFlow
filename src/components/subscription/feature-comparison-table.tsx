import { Check, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FEATURE_COMPARISON } from "@/lib/subscription/plans-display";

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-dental" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  return <span className="text-sm font-medium">{value}</span>;
}

export function FeatureComparisonTable() {
  const categories = [...new Set(FEATURE_COMPARISON.map((r) => r.category))];

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Feature</TableHead>
            <TableHead className="text-center">Starter</TableHead>
            <TableHead className="text-center">Professional</TableHead>
            <TableHead className="text-center">Enterprise</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.flatMap((category) => [
            <TableRow key={`cat-${category}`} className="bg-muted/40 hover:bg-muted/40">
              <TableCell
                colSpan={4}
                className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {category}
              </TableCell>
            </TableRow>,
            ...FEATURE_COMPARISON.filter((r) => r.category === category).map((row) => (
              <TableRow key={row.feature}>
                <TableCell className="font-medium">{row.feature}</TableCell>
                <TableCell className="text-center">
                  <CellValue value={row.starter} />
                </TableCell>
                <TableCell className="text-center">
                  <CellValue value={row.professional} />
                </TableCell>
                <TableCell className="text-center">
                  <CellValue value={row.enterprise} />
                </TableCell>
              </TableRow>
            )),
          ])}
        </TableBody>
      </Table>
    </div>
  );
}
