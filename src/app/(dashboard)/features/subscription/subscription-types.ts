export type StripeInvoiceItem = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
};
