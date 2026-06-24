"use client";

import { useState } from "react";

export type ProcedureOption = {
  id: string;
  code: string;
  name: string;
  category: string;
  durationMins: number;
  sellingPrice: number;
};

export function useProcedureSearch(procedures: ProcedureOption[]) {
  const [query, setQuery] = useState("");

  const filtered =
    query.length < 1
      ? procedures.slice(0, 10)
      : procedures
          .filter(
            (p) =>
              p.code.toLowerCase().includes(query.toLowerCase()) ||
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.category.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 15);

  return { query, setQuery, filtered };
}
