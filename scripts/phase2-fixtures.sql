-- Reusable Phase 2 verification fixtures (local click-test DB).
-- Safe to re-apply (ON CONFLICT upserts).

INSERT INTO "InventoryItem" (
  id, "tenantId", sku, name, unit, quantity, "reorderLevel", cost, "retailPrice",
  "isSellable", "trackByBatch", "trackByExpiry", "createdAt", "updatedAt"
) VALUES (
  'inv_spine_composite', 'tenant_a', 'MAT-COMP-01', 'Composite resin capsule', 'unit', 50, 5,
  12.50, 25.00, false, false, true, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET cost = EXCLUDED.cost, "deletedAt" = NULL;

INSERT INTO "Appointment" (
  id, "tenantId", "patientId", title, "startTime", "endTime", status, "isBlock",
  priority, "bookedVia", "createdAt", "updatedAt"
)
SELECT
  'seed_appt_spine_phase2', p."tenantId", p.id, 'Phase2 Spine Visit',
  NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 'CONFIRMED', false,
  'ROUTINE', 'RECEPTION', NOW(), NOW()
FROM "Patient" p
WHERE p."firstName" = 'Emma' AND p."lastName" = 'Williams' AND p."tenantId" = 'tenant_a'
ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED', "deletedAt" = NULL, "startTime" = EXCLUDED."startTime", "endTime" = EXCLUDED."endTime";

INSERT INTO "Appointment" (
  id, "tenantId", "patientId", title, "startTime", "endTime", status, "isBlock",
  priority, "bookedVia", "createdAt", "updatedAt"
)
SELECT
  'seed_appt_flagoff_phase2', p."tenantId", p.id, 'Phase2 Flag-Off Chairside',
  NOW() + INTERVAL '3 hour', NOW() + INTERVAL '4 hours', 'CONFIRMED', false,
  'ROUTINE', 'RECEPTION', NOW(), NOW()
FROM "Patient" p
WHERE p."firstName" = 'Emma' AND p."lastName" = 'Williams' AND p."tenantId" = 'tenant_a'
ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED', "deletedAt" = NULL, "startTime" = EXCLUDED."startTime", "endTime" = EXCLUDED."endTime";

INSERT INTO "ProcedureCatalog" (
  id, "tenantId", code, name, category, price, "isActive", "createdAt", "updatedAt"
) VALUES
  ('proc_spine_prophy', 'tenant_a', 'D1110', 'Prophylaxis - adult', 'Preventive', 85.00, true, NOW(), NOW()),
  ('proc_flagoff_resin', 'tenant_a', 'D2391', 'Resin composite - one surface', 'Restorative', 120.00, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
