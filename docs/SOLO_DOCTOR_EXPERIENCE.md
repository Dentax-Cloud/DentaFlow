# Solo Doctor Experience — Option A

## Vision
First-class Solo Doctor product as Phase 1 of the AI-Native Solo Dental OS.

## Tenant Category
```prisma
clinicType  String  @default("practice") // "solo" | "practice" | "group"
```

## Registration
- Solo Doctor
- Practice / Group

## Dedicated Experience
- Separate layout group for Solo
- Action-oriented Today (Book, Start visit, Invoice)
- Direct booking without redirects
- Streamlined clinical and quick invoice path

## AI Readiness (Phase 1)
- Event hooks on booking, visit complete, invoice
- Feature-flag placeholders for AI Receptionist, Clinical Co-pilot, Revenue insights

## Roadmap
| Capability | Phase |
|------------|-------|
| clinicType + registration + dedicated layout | Phase 1 |
| AI Receptionist, Clinical Assistant | Phase 2 |
| Revenue Intelligence, Inventory AI | Phase 2–3 |
| Teledentistry, Smile Design, Imaging AI | Phase 3 |
| Autonomous Practice Manager, Voice-first, Digital Twin | Phase 4 |
