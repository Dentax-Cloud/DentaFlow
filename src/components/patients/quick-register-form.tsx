"use client";

export type QuickRegisterValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
};

export const EMPTY_QUICK_REGISTER: QuickRegisterValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
};

type Props = {
  values: QuickRegisterValues;
  onChange: (values: QuickRegisterValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  submitLabel?: string;
  title?: string;
};

export function QuickRegisterForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  isPending = false,
  submitLabel = "Register & continue →",
  title = "Quick registration",
}: Props) {
  function setField<K extends keyof QuickRegisterValues>(
    key: K,
    value: QuickRegisterValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">First name *</label>
          <input
            value={values.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Last name *</label>
          <input
            value={values.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Phone</label>
          <input
            value={values.phone}
            onChange={(e) => setField("phone", e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Email</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Date of birth</label>
        <input
          type="date"
          value={values.dateOfBirth}
          onChange={(e) => setField("dateOfBirth", e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700"
      >
        {isPending ? "Registering…" : submitLabel}
      </button>
    </div>
  );
}
