// ============================================================
// Global Procedure Master Registry — Seed Data
// CRITICAL: Zero price fields anywhere in this file
// All prices are set exclusively by tenant admin
// ============================================================

export const GPMR_PROCEDURES = [

  // ── DIAGNOSTIC ──────────────────────────────────────────────

  {
    gpmrCode: "GPMR-D001",
    canonicalName: "Comprehensive Oral Examination",
    names: {
      en: "Comprehensive Oral Examination",
      ar: "الفحص الشفهي الشامل",
      "en-US": "Comprehensive Oral Evaluation",
      "en-GB": "Full Mouth Examination",
      fr: "Examen buccal complet",
      de: "Umfassende Munduntersuchung",
      es: "Examen oral completo",
      hi: "व्यापक मौखिक परीक्षण",
    },
    category: "DIAGNOSTIC",
    subCategory: "EXAMINATION",
    clinicalDescription:
      "Thorough evaluation of the oral cavity including teeth, " +
      "gums, soft tissues, occlusion, and TMJ.",
    defaultDurationMins: 30,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["chief_complaint", "medical_history_reviewed"],
    optionalInputs: ["blood_pressure", "pain_score", "smoking_status"],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",       required: true  },
      { action: "GENERATE_TREATMENT_PLAN", required: false },
      { action: "SCHEDULE_RECALL",         required: false },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO", "RADIOGRAPH"],
    globalCodes: {
      ADA:     "D0150",
      ICD10:   "Z01.20",
      SNODENT: "D0150",
      SNOMED:  "310585003",
    },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "TREATMENT_PLAN"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["new_patient", "annual_recall"],
  },

  {
    gpmrCode: "GPMR-D002",
    canonicalName: "Periodic Oral Examination",
    names: {
      en: "Periodic Oral Examination",
      ar: "الفحص الشفهي الدوري",
      "en-US": "Periodic Oral Evaluation",
      "en-GB": "Routine Dental Examination",
      fr: "Examen périodique",
      de: "Periodische Untersuchung",
    },
    category: "DIAGNOSTIC",
    subCategory: "EXAMINATION",
    clinicalDescription:
      "Routine evaluation of patient under current care.",
    defaultDurationMins: 20,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["medical_history_reviewed"],
    optionalInputs: ["chief_complaint", "blood_pressure"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D001",
        condition: "MUST_HAVE_PRIOR",
        description: "Patient must have had a comprehensive exam",
        enforcement: "INFO",
      },
    ],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM", required: true  },
      { action: "SCHEDULE_RECALL",   required: false },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH"],
    globalCodes: {
      ADA:   "D0120",
      ICD10: "Z01.20",
      SNOMED:"310585003",
    },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["recall_due"],
  },

  {
    gpmrCode: "GPMR-D003",
    canonicalName: "Bitewing Radiographs (2 films)",
    names: {
      en: "Bitewing Radiographs (2 films)",
      ar: "أشعة العضة (فيلمان)",
      "en-US": "Bitewing Radiographic Images",
    },
    category: "DIAGNOSTIC",
    subCategory: "RADIOGRAPH",
    clinicalDescription:
      "Periapical images showing crown and crestal bone " +
      "of posterior teeth for caries detection.",
    defaultDurationMins: 10,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "pregnancy_first_trimester",
        severity: "WARNING",
        message:
          "X-ray in first trimester requires clinical " +
          "justification and lead apron protection.",
      },
    ],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH", required: true  },
      { action: "UPDATE_ODONTOGRAM", required: false },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D0272", ICD10: "Z01.89" },
    modules: ["RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["caries_risk_high", "annual_recall"],
  },

  {
    gpmrCode: "GPMR-D004",
    canonicalName: "Bitewing Radiographs (4 films)",
    names: {
      en: "Bitewing Radiographs (4 films)",
      ar: "أشعة العضة (4 أفلام)",
    },
    category: "DIAGNOSTIC",
    subCategory: "RADIOGRAPH",
    clinicalDescription:
      "Four bitewing images covering all posterior teeth.",
    defaultDurationMins: 15,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "pregnancy_first_trimester",
        severity: "WARNING",
        message: "Requires clinical justification and lead apron.",
      },
    ],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH", required: true },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D0274", ICD10: "Z01.89" },
    modules: ["RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["annual_recall", "new_patient"],
  },

  {
    gpmrCode: "GPMR-D005",
    canonicalName: "Panoramic Radiograph",
    names: {
      en: "Panoramic Radiograph",
      ar: "صورة بانورامية",
      "en-US": "Panoramic Radiographic Image",
    },
    category: "DIAGNOSTIC",
    subCategory: "RADIOGRAPH",
    clinicalDescription:
      "Full arch panoramic image showing all teeth, " +
      "bone, sinuses and TMJ.",
    defaultDurationMins: 15,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "pregnancy_first_trimester",
        severity: "WARNING",
        message: "Avoid unless clinically necessary.",
      },
    ],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH", required: true },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D0330", ICD10: "Z01.89" },
    modules: ["RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["new_patient", "implant_assessment"],
  },

  {
    gpmrCode: "GPMR-D006",
    canonicalName: "Periapical Radiograph",
    names: {
      en: "Periapical Radiograph",
      ar: "صورة طرف الجذر",
    },
    category: "DIAGNOSTIC",
    subCategory: "RADIOGRAPH",
    clinicalDescription:
      "Intraoral radiograph showing full tooth from " +
      "crown to root apex and surrounding bone.",
    defaultDurationMins: 10,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number"],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH", required: true },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D0220", ICD10: "Z01.89" },
    modules: ["RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["pain_posterior", "abscess_suspected"],
  },

  // ── PREVENTIVE ───────────────────────────────────────────────

  {
    gpmrCode: "GPMR-P001",
    canonicalName: "Adult Prophylaxis",
    names: {
      en: "Adult Prophylaxis",
      ar: "تنظيف الأسنان للبالغين",
      "en-US": "Prophylaxis — Adult",
      "en-GB": "Scale and Polish",
      fr: "Détartrage adulte",
      de: "Professionelle Zahnreinigung",
      hi: "वयस्क दांत सफाई",
    },
    category: "PREVENTIVE",
    subCategory: "PROPHYLAXIS",
    clinicalDescription:
      "Removal of plaque, calculus and stain from " +
      "supragingival and marginally subgingival tooth surfaces.",
    defaultDurationMins: 45,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: ["perio_chart", "oral_hygiene_instructions"],
    prerequisites: [],
    contraindications: [
      {
        condition: "active_bleeding_disorder",
        severity: "WARNING",
        message: "Consult physician before scaling.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_PERIO_CHART",     required: false },
      { action: "RECORD_OHI",             required: false },
      { action: "SCHEDULE_RECALL",        required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: {
      ADA:   "D1110",
      ICD10: "Z29.8",
      SNOMED:"182813001",
    },
    modules: ["CLINICAL_NOTES", "PERIO_CHARTING"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["recall_6_month", "new_patient"],
  },

  {
    gpmrCode: "GPMR-P002",
    canonicalName: "Child Prophylaxis",
    names: {
      en: "Child Prophylaxis",
      ar: "تنظيف أسنان الأطفال",
      "en-US": "Prophylaxis — Child",
      "en-GB": "Children's Scale and Polish",
    },
    category: "PREVENTIVE",
    subCategory: "PROPHYLAXIS",
    clinicalDescription: "Prophylaxis for patients aged 13 and under.",
    defaultDurationMins: 30,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "SCHEDULE_RECALL",        required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: [],
    globalCodes: { ADA: "D1120", ICD10: "Z29.8" },
    modules: ["CLINICAL_NOTES"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["recall_6_month_child"],
  },

  {
    gpmrCode: "GPMR-P003",
    canonicalName: "Fluoride Varnish Application",
    names: {
      en: "Fluoride Varnish Application",
      ar: "تطبيق ورنيش الفلورايد",
      "en-US": "Fluoride — Topical Application",
    },
    category: "PREVENTIVE",
    subCategory: "FLUORIDE",
    clinicalDescription:
      "Application of 5% sodium fluoride varnish to all tooth surfaces.",
    defaultDurationMins: 10,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "fluoride_allergy",
        severity: "BLOCK",
        message: "Do not apply — patient has fluoride allergy.",
      },
    ],
    postProcedureActions: [
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: [],
    globalCodes: { ADA: "D1206", ICD10: "Z29.3" },
    modules: ["CLINICAL_NOTES"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["caries_risk_high", "child_patient"],
  },

  {
    gpmrCode: "GPMR-P004",
    canonicalName: "Pit and Fissure Sealant",
    names: {
      en: "Pit and Fissure Sealant",
      ar: "تغليف الشقوق والحفر",
    },
    category: "PREVENTIVE",
    subCategory: "SEALANT",
    clinicalDescription:
      "Application of resin sealant to pits and " +
      "fissures of posterior teeth.",
    defaultDurationMins: 20,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number"],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D1351", ICD10: "Z29.8" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["child_patient", "caries_risk_high"],
  },

  // ── RESTORATIVE ──────────────────────────────────────────────

  {
    gpmrCode: "GPMR-R001",
    canonicalName: "Composite Resin Restoration — 1 Surface",
    names: {
      en: "Composite Resin Restoration — 1 Surface",
      ar: "حشو كومبوزيت — سطح واحد",
      "en-US": "Resin-based Composite — One Surface",
    },
    category: "RESTORATIVE",
    subCategory: "COMPOSITE",
    clinicalDescription:
      "Tooth-coloured resin composite restoration for one tooth surface.",
    defaultDurationMins: 30,
    toothRequired: true,
    surfaceRequired: true,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "surface"],
    optionalInputs: ["shade", "notes"],
    prerequisites: [],
    contraindications: [
      {
        condition: "latex_allergy",
        severity: "WARNING",
        message: "Use latex-free gloves and dam.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "SCHEDULE_RECALL",        required: false },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO", "RADIOGRAPH"],
    globalCodes: { ADA: "D2391", ICD10: "K02.9", SNOMED: "699053005" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["caries_detected"],
  },

  {
    gpmrCode: "GPMR-R002",
    canonicalName: "Composite Resin Restoration — 2 Surfaces",
    names: {
      en: "Composite Resin Restoration — 2 Surfaces",
      ar: "حشو كومبوزيت — سطحان",
    },
    category: "RESTORATIVE",
    subCategory: "COMPOSITE",
    clinicalDescription:
      "Tooth-coloured resin composite restoration for two tooth surfaces.",
    defaultDurationMins: 40,
    toothRequired: true,
    surfaceRequired: true,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "surfaces"],
    optionalInputs: ["shade"],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D2392", ICD10: "K02.9" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["caries_detected"],
  },

  {
    gpmrCode: "GPMR-R003",
    canonicalName: "Composite Resin Restoration — 3 or More Surfaces",
    names: {
      en: "Composite Resin Restoration — 3 or More Surfaces",
      ar: "حشو كومبوزيت — ثلاثة أسطح أو أكثر",
    },
    category: "RESTORATIVE",
    subCategory: "COMPOSITE",
    clinicalDescription:
      "Tooth-coloured resin composite restoration for three or more surfaces.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: true,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "surfaces"],
    optionalInputs: ["shade"],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH", "PHOTO"],
    globalCodes: { ADA: "D2393", ICD10: "K02.9" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["large_caries_detected"],
  },

  {
    gpmrCode: "GPMR-R004",
    canonicalName: "Amalgam Restoration — 1 Surface",
    names: {
      en: "Amalgam Restoration — 1 Surface",
      ar: "حشو أملغم — سطح واحد",
    },
    category: "RESTORATIVE",
    subCategory: "AMALGAM",
    clinicalDescription:
      "Amalgam restoration for one tooth surface.",
    defaultDurationMins: 30,
    toothRequired: true,
    surfaceRequired: true,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "surface"],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "mercury_sensitivity",
        severity: "BLOCK",
        message:
          "Patient has documented mercury sensitivity. " +
          "Use alternative restoration.",
      },
      {
        condition: "pregnancy",
        severity: "WARNING",
        message:
          "Avoid amalgam in pregnant patients if possible. " +
          "Consider composite alternative.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH"],
    globalCodes: { ADA: "D2140", ICD10: "K02.9" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["caries_detected"],
  },

  // ── ENDODONTICS ──────────────────────────────────────────────

  {
    gpmrCode: "GPMR-E001",
    canonicalName: "Root Canal Treatment — Anterior Tooth",
    names: {
      en: "Root Canal Treatment — Anterior Tooth",
      ar: "علاج قناة الجذر — السن الأمامي",
      "en-US": "Endodontic Therapy — Anterior Tooth",
      "en-GB": "Root Canal Treatment — Anterior",
    },
    category: "ENDODONTICS",
    subCategory: "ROOT_CANAL",
    clinicalDescription:
      "Complete chemo-mechanical preparation and obturation " +
      "of anterior tooth root canal system.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "tooth_number",
      "anaesthetic_used",
      "working_length",
      "obturation_method",
    ],
    optionalInputs: ["number_of_canals", "irrigation_solution", "sealer_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D006",
        condition: "REQUIRED_BEFORE",
        description: "Periapical X-ray required before RCT",
        enforcement: "WARN",
        timeframeMonths: 3,
      },
    ],
    contraindications: [
      {
        condition: "unrestorable_tooth",
        severity: "WARNING",
        message: "Confirm tooth is restorable before commencing RCT.",
      },
    ],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH",      required: true  },
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "SCHEDULE_CROWN_REVIEW",  required: false },
      { action: "CREATE_LAB_ORDER",       required: false },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D3310", ICD10: "K04.0", SNOMED: "83291003" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["periapical_lesion", "irreversible_pulpitis"],
  },

  {
    gpmrCode: "GPMR-E002",
    canonicalName: "Root Canal Treatment — Premolar",
    names: {
      en: "Root Canal Treatment — Premolar",
      ar: "علاج قناة الجذر — الضرس الصغير",
    },
    category: "ENDODONTICS",
    subCategory: "ROOT_CANAL",
    clinicalDescription:
      "Complete RCT for premolar tooth.",
    defaultDurationMins: 75,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "tooth_number",
      "anaesthetic_used",
      "working_length",
      "number_of_canals",
      "obturation_method",
    ],
    optionalInputs: ["irrigation_solution", "sealer_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D006",
        condition: "REQUIRED_BEFORE",
        description: "Periapical X-ray required",
        enforcement: "WARN",
        timeframeMonths: 3,
      },
    ],
    contraindications: [],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH",      required: true  },
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "CREATE_LAB_ORDER",       required: false },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D3320", ICD10: "K04.0" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["periapical_lesion"],
  },

  {
    gpmrCode: "GPMR-E003",
    canonicalName: "Root Canal Treatment — Molar",
    names: {
      en: "Root Canal Treatment — Molar",
      ar: "علاج قناة الجذر — الضرس الكبير",
    },
    category: "ENDODONTICS",
    subCategory: "ROOT_CANAL",
    clinicalDescription: "Complete RCT for molar tooth.",
    defaultDurationMins: 90,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "tooth_number",
      "anaesthetic_used",
      "working_length",
      "number_of_canals",
      "obturation_method",
    ],
    optionalInputs: ["irrigation_solution", "sealer_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D006",
        condition: "REQUIRED_BEFORE",
        description: "Periapical X-ray required",
        enforcement: "WARN",
        timeframeMonths: 3,
      },
    ],
    contraindications: [],
    postProcedureActions: [
      { action: "ATTACH_RADIOGRAPH",      required: true  },
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "CREATE_LAB_ORDER",       required: false },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D3330", ICD10: "K04.0" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["periapical_lesion_molar"],
  },

  // ── PERIODONTICS ─────────────────────────────────────────────

  {
    gpmrCode: "GPMR-PER001",
    canonicalName: "Scaling and Root Planing — Per Quadrant",
    names: {
      en: "Scaling and Root Planing — Per Quadrant",
      ar: "تقليح الجذور — لكل ربع",
      "en-US": "Periodontal Scaling and Root Planing",
    },
    category: "PERIODONTICS",
    subCategory: "SRP",
    clinicalDescription:
      "Deep scaling and root surface debridement " +
      "for one periodontal quadrant.",
    defaultDurationMins: 45,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: true,
    requiredInputs: ["quadrant", "perio_chart_completed"],
    optionalInputs: ["local_anaesthetic", "irrigant_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D001",
        condition: "PERIO_CHART_REQUIRED",
        description: "Perio charting must be completed before SRP",
        enforcement: "WARN",
      },
    ],
    contraindications: [
      {
        condition: "uncontrolled_diabetes",
        severity: "WARNING",
        message:
          "SRP outcomes compromised in poorly controlled diabetes. " +
          "Consider medical review first.",
      },
      {
        condition: "anticoagulant_therapy",
        severity: "WARNING",
        message: "Check INR before procedure. Consult physician if INR > 3.5.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_PERIO_CHART",     required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "SCHEDULE_PERIO_REVIEW",  required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH"],
    globalCodes: { ADA: "D4341", ICD10: "K05.3", SNOMED: "84195007" },
    modules: ["PERIO_CHARTING", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["perio_disease_detected"],
  },

  {
    gpmrCode: "GPMR-PER002",
    canonicalName: "Periodontal Maintenance",
    names: {
      en: "Periodontal Maintenance",
      ar: "صيانة اللثة",
      "en-US": "Periodontal Maintenance Procedure",
    },
    category: "PERIODONTICS",
    subCategory: "MAINTENANCE",
    clinicalDescription:
      "Ongoing supportive periodontal therapy following " +
      "completion of active treatment.",
    defaultDurationMins: 45,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [],
    optionalInputs: ["pocket_depths", "bleeding_on_probing"],
    prerequisites: [
      {
        gpmrCode: "GPMR-PER001",
        condition: "MUST_HAVE_PRIOR",
        description: "Patient must have completed active perio therapy",
        enforcement: "INFO",
      },
    ],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_PERIO_CHART",     required: true  },
      { action: "SCHEDULE_RECALL",        required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: [],
    globalCodes: { ADA: "D4910", ICD10: "K05.3" },
    modules: ["PERIO_CHARTING", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["perio_maintenance_due"],
  },

  // ── ORAL SURGERY ─────────────────────────────────────────────

  {
    gpmrCode: "GPMR-S001",
    canonicalName: "Simple Extraction — Erupted Tooth",
    names: {
      en: "Simple Extraction — Erupted Tooth",
      ar: "خلع بسيط — سن بازغ",
      "en-US": "Extraction of Erupted Tooth",
      "en-GB": "Simple Extraction",
    },
    category: "ORAL_SURGERY",
    subCategory: "EXTRACTION",
    clinicalDescription:
      "Removal of erupted tooth using forceps and/or elevators " +
      "under local anaesthesia.",
    defaultDurationMins: 20,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "anaesthetic_used", "anaesthetic_amount_ml"],
    optionalInputs: ["socket_treatment", "haemostatic_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D006",
        condition: "RECOMMENDED_BEFORE",
        description: "Periapical X-ray recommended before extraction",
        enforcement: "INFO",
        timeframeMonths: 6,
      },
    ],
    contraindications: [
      {
        condition: "anticoagulant_therapy",
        severity: "WARNING",
        message:
          "Check INR. Do not extract if INR > 3.5 without " +
          "physician clearance.",
      },
      {
        condition: "bisphosphonate_therapy",
        severity: "WARNING",
        message:
          "Risk of BRONJ. Drug holiday may be required. " +
          "Consult prescribing physician.",
      },
      {
        condition: "uncontrolled_diabetes",
        severity: "WARNING",
        message: "Impaired healing. Check HbA1c. Antibiotic cover may be required.",
      },
      {
        condition: "radiotherapy_jaw",
        severity: "BLOCK",
        message:
          "History of jaw radiation — specialist referral required.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",        required: true  },
      { action: "GIVE_POSTOP_INSTRUCTIONS", required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY",   required: true  },
      { action: "SCHEDULE_REVIEW",          required: false },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH", "CONSENT"],
    globalCodes: { ADA: "D7140", ICD10: "K08.1", SNOMED: "57400003" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["unrestorable_tooth", "severe_caries"],
  },

  {
    gpmrCode: "GPMR-S002",
    canonicalName: "Surgical Extraction — Impacted Tooth",
    names: {
      en: "Surgical Extraction — Impacted Tooth",
      ar: "خلع جراحي — سن مطمور",
      "en-US": "Removal of Impacted Tooth",
    },
    category: "ORAL_SURGERY",
    subCategory: "EXTRACTION",
    clinicalDescription:
      "Surgical removal of partially or fully impacted tooth " +
      "requiring bone removal and/or tooth sectioning.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "tooth_number",
      "impaction_type",
      "anaesthetic_used",
      "anaesthetic_amount_ml",
    ],
    optionalInputs: ["bone_removed", "tooth_sectioned", "suture_type", "suture_count"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D005",
        condition: "REQUIRED_BEFORE",
        description: "Panoramic X-ray required before surgical extraction",
        enforcement: "WARN",
        timeframeMonths: 12,
      },
    ],
    contraindications: [
      {
        condition: "anticoagulant_therapy",
        severity: "WARNING",
        message: "INR check required. Physician clearance if INR > 2.5.",
      },
      {
        condition: "bisphosphonate_therapy",
        severity: "WARNING",
        message: "High BRONJ risk. Specialist consultation required.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",        required: true  },
      { action: "GIVE_POSTOP_INSTRUCTIONS", required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY",   required: true  },
      { action: "SCHEDULE_SUTURE_REMOVAL",  required: true  },
    ],
    requiredAttachments: ["RADIOGRAPH", "CONSENT"],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D7210", ICD10: "K01.1", SNOMED: "68526008" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["impacted_wisdom_tooth"],
  },

  // ── PROSTHODONTICS ───────────────────────────────────────────

  {
    gpmrCode: "GPMR-PR001",
    canonicalName: "Porcelain Fused to Metal Crown",
    names: {
      en: "Porcelain Fused to Metal Crown",
      ar: "تاج الخزف على معدن",
      "en-US": "Crown — Porcelain Fused to Base Metal",
    },
    category: "PROSTHODONTICS",
    subCategory: "CROWN",
    clinicalDescription:
      "Porcelain fused to metal full coverage crown restoration.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "shade", "preparation_type"],
    optionalInputs: ["opposing_material", "lab_instructions"],
    prerequisites: [],
    contraindications: [
      {
        condition: "bruxism_severe",
        severity: "WARNING",
        message:
          "Consider night guard and alternative crown material " +
          "for heavy grinders.",
      },
    ],
    postProcedureActions: [
      { action: "CREATE_LAB_ORDER",       required: true  },
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "SCHEDULE_CROWN_FIT",     required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO", "RADIOGRAPH"],
    globalCodes: { ADA: "D2751", ICD10: "K08.8" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "LAB_ORDERS"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["post_rct_crown", "severely_broken_tooth"],
  },

  {
    gpmrCode: "GPMR-PR002",
    canonicalName: "Full Porcelain Crown (E-max / Zirconia)",
    names: {
      en: "Full Porcelain Crown (E-max / Zirconia)",
      ar: "تاج خزف كامل (إي-ماكس / زيركونيا)",
    },
    category: "PROSTHODONTICS",
    subCategory: "CROWN",
    clinicalDescription:
      "All-ceramic full coverage crown restoration.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "shade", "material_type"],
    optionalInputs: ["lab_instructions", "opposing_material"],
    prerequisites: [],
    contraindications: [
      {
        condition: "bruxism_severe",
        severity: "WARNING",
        message: "Zirconia preferred over E-max for heavy grinders.",
      },
    ],
    postProcedureActions: [
      { action: "CREATE_LAB_ORDER",       required: true },
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "SCHEDULE_CROWN_FIT",     required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D2740", ICD10: "K08.8" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "LAB_ORDERS"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["post_rct_crown"],
  },

  // ── IMPLANTOLOGY ─────────────────────────────────────────────

  {
    gpmrCode: "GPMR-I001",
    canonicalName: "Dental Implant Placement",
    names: {
      en: "Dental Implant Placement",
      ar: "زراعة الأسنان",
      "en-US": "Endosteal Implant",
    },
    category: "IMPLANTOLOGY",
    subCategory: "IMPLANT_PLACEMENT",
    clinicalDescription:
      "Surgical placement of endosteal titanium implant " +
      "fixture into alveolar bone.",
    defaultDurationMins: 90,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "implant_site",
      "implant_brand",
      "implant_size",
      "implant_lot_number",
      "torque_achieved",
      "bone_graft_used",
    ],
    optionalInputs: ["membrane_used", "healing_abutment_placed", "ist_value"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D005",
        condition: "REQUIRED_BEFORE",
        description: "Panoramic or CBCT required before implant",
        enforcement: "BLOCK",
        timeframeMonths: 12,
      },
    ],
    contraindications: [
      {
        condition: "uncontrolled_diabetes",
        severity: "WARNING",
        message:
          "HbA1c > 8% significantly reduces implant success. " +
          "Optimize glycaemic control first.",
      },
      {
        condition: "bisphosphonate_iv",
        severity: "BLOCK",
        message:
          "IV bisphosphonate therapy is absolute contraindication. " +
          "Specialist referral required.",
      },
      {
        condition: "active_smoker",
        severity: "WARNING",
        message:
          "Smoking increases failure rate. " +
          "Discuss risks and cessation with patient.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",        required: true  },
      { action: "ATTACH_RADIOGRAPH",        required: true  },
      { action: "GIVE_POSTOP_INSTRUCTIONS", required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY",   required: true  },
      { action: "RECORD_IMPLANT_DETAILS",   required: true  },
      { action: "SCHEDULE_HEALING_REVIEW",  required: true  },
    ],
    requiredAttachments: ["RADIOGRAPH", "CONSENT"],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D6010", ICD10: "Z96.5", SNOMED: "108306002" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["edentulous_space", "implant_candidate"],
  },

  // ── ORTHODONTICS ─────────────────────────────────────────────

  {
    gpmrCode: "GPMR-ORT001",
    canonicalName: "Fixed Orthodontic Appliance — Full Arch",
    names: {
      en: "Fixed Orthodontic Appliance — Full Arch",
      ar: "تقويم الأسنان الثابت — قوس كامل",
      "en-US": "Comprehensive Orthodontic Treatment",
    },
    category: "ORTHODONTICS",
    subCategory: "FIXED_APPLIANCE",
    clinicalDescription:
      "Full arch fixed orthodontic appliance placement.",
    defaultDurationMins: 90,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: true,
    quadrantRequired: false,
    requiredInputs: ["arch", "bracket_type", "wire_size", "bonding_method"],
    optionalInputs: ["molar_band_sizes", "auxiliaries_used"],
    prerequisites: [
      {
        gpmrCode: "GPMR-D005",
        condition: "REQUIRED_BEFORE",
        description: "Panoramic X-ray required for ortho planning",
        enforcement: "WARN",
        timeframeMonths: 6,
      },
    ],
    contraindications: [
      {
        condition: "poor_oral_hygiene",
        severity: "WARNING",
        message:
          "Patient must achieve acceptable oral hygiene " +
          "before fixed appliance placement.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "SCHEDULE_ADJUSTMENT",    required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO", "RADIOGRAPH"],
    globalCodes: { ADA: "D8080", ICD10: "K07.2" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "TREATMENT_PLAN"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["malocclusion_detected"],
  },

  // ── COSMETIC ─────────────────────────────────────────────────

  {
    gpmrCode: "GPMR-C001",
    canonicalName: "In-Office Teeth Whitening",
    names: {
      en: "In-Office Teeth Whitening",
      ar: "تبييض الأسنان في العيادة",
      "en-US": "Bleaching — In-Office",
    },
    category: "COSMETIC",
    subCategory: "WHITENING",
    clinicalDescription:
      "In-office power bleaching for tooth whitening.",
    defaultDurationMins: 90,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["baseline_shade", "whitening_agent"],
    optionalInputs: ["light_activation", "number_of_cycles"],
    prerequisites: [],
    contraindications: [
      {
        condition: "pregnancy",
        severity: "BLOCK",
        message: "Whitening is contraindicated in pregnancy.",
      },
      {
        condition: "active_caries",
        severity: "BLOCK",
        message:
          "Treat all active caries before whitening. " +
          "Whitening agents can cause severe sensitivity.",
      },
      {
        condition: "dentine_hypersensitivity",
        severity: "WARNING",
        message:
          "Pre-treat with desensitising agent. " +
          "Consider lower concentration.",
      },
    ],
    postProcedureActions: [
      { action: "RECORD_FINAL_SHADE",     required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D9975", ICD10: "Z46.4" },
    modules: ["CLINICAL_NOTES", "CLINICAL_PHOTOS"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["patient_requests_whitening"],
  },

  {
    gpmrCode: "GPMR-C002",
    canonicalName: "Porcelain Veneer",
    names: {
      en: "Porcelain Veneer",
      ar: "قشرة الخزف",
      "en-US": "Veneer — Porcelain Laminate",
    },
    category: "COSMETIC",
    subCategory: "VENEER",
    clinicalDescription: "Porcelain laminate veneer restoration.",
    defaultDurationMins: 60,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "shade", "preparation_extent"],
    optionalInputs: ["lab_instructions", "mock_up_done"],
    prerequisites: [],
    contraindications: [
      {
        condition: "bruxism_severe",
        severity: "WARNING",
        message:
          "Veneers have high failure rate in severe bruxism. " +
          "Night guard mandatory.",
      },
    ],
    postProcedureActions: [
      { action: "CREATE_LAB_ORDER",       required: true },
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "SCHEDULE_VENEER_FIT",    required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["PHOTO"],
    globalCodes: { ADA: "D2960", ICD10: "K08.8" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "CLINICAL_PHOTOS"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: ["smile_makeover_requested"],
  },

  // ── PAEDIATRIC ───────────────────────────────────────────────

  {
    gpmrCode: "GPMR-PED001",
    canonicalName: "Stainless Steel Crown — Primary Tooth",
    names: {
      en: "Stainless Steel Crown — Primary Tooth",
      ar: "تاج الفولاذ المقاوم للصدأ — سن لبني",
    },
    category: "PAEDIATRIC",
    subCategory: "SSC",
    clinicalDescription:
      "Stainless steel crown for primary tooth restoration.",
    defaultDurationMins: 30,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "crown_size"],
    optionalInputs: ["pulpotomy_performed"],
    prerequisites: [],
    contraindications: [
      {
        condition: "nickel_allergy",
        severity: "WARNING",
        message:
          "Stainless steel crowns contain nickel. " +
          "Consider alternative if confirmed allergy.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH"],
    globalCodes: { ADA: "D2931", ICD10: "K02.9" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["severely_carious_primary_tooth"],
  },

  {
    gpmrCode: "GPMR-PED002",
    canonicalName: "Pulpotomy — Primary Tooth",
    names: {
      en: "Pulpotomy — Primary Tooth",
      ar: "بتر عصب السن اللبني",
    },
    category: "PAEDIATRIC",
    subCategory: "PULP_THERAPY",
    clinicalDescription:
      "Removal of coronal pulp tissue from primary tooth.",
    defaultDurationMins: 30,
    toothRequired: true,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["tooth_number", "pulp_agent_used", "anaesthetic_used"],
    optionalInputs: [],
    prerequisites: [],
    contraindications: [
      {
        condition: "internal_resorption",
        severity: "WARNING",
        message:
          "Internal root resorption may preclude pulpotomy. " +
          "Consider extraction.",
      },
    ],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",      required: true },
      { action: "ATTACH_RADIOGRAPH",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: ["RADIOGRAPH"],
    optionalAttachments: [],
    globalCodes: { ADA: "D3220", ICD10: "K04.0" },
    modules: ["ODONTOGRAM", "CLINICAL_NOTES", "RADIOGRAPH_VIEWER"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["carious_primary_tooth_with_pulp_involvement"],
  },

  // ── EMERGENCY ────────────────────────────────────────────────

  {
    gpmrCode: "GPMR-EM001",
    canonicalName: "Emergency Dental Examination",
    names: {
      en: "Emergency Dental Examination",
      ar: "فحص أسنان طارئ",
      "en-US": "Limited Oral Evaluation — Problem Focused",
    },
    category: "EMERGENCY",
    subCategory: "EXAMINATION",
    clinicalDescription:
      "Limited examination focusing on specific complaint.",
    defaultDurationMins: 20,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["chief_complaint", "pain_score", "onset", "duration"],
    optionalInputs: ["swelling_present", "trismus", "temperature"],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "UPDATE_ODONTOGRAM",     required: false },
      { action: "PRESCRIBE_MEDICATION",  required: false },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH"],
    globalCodes: { ADA: "D0140", ICD10: "K08.8" },
    modules: ["CLINICAL_NOTES", "EMERGENCY_INTAKE"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: [],
  },

  {
    gpmrCode: "GPMR-EM002",
    canonicalName: "Dental Abscess Drainage",
    names: {
      en: "Dental Abscess Drainage",
      ar: "صرف خراج الأسنان",
    },
    category: "EMERGENCY",
    subCategory: "SURGICAL",
    clinicalDescription:
      "Incision and drainage of dental abscess.",
    defaultDurationMins: 30,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: ["abscess_location", "anaesthetic_used", "drainage_route"],
    optionalInputs: ["drain_placed", "culture_sent"],
    prerequisites: [],
    contraindications: [
      {
        condition: "spreading_cellulitis",
        severity: "BLOCK",
        message:
          "Spreading fascial space infection requires " +
          "urgent hospital referral — do not drain in clinic.",
      },
    ],
    postProcedureActions: [
      { action: "PRESCRIBE_ANTIBIOTIC",   required: true  },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true  },
      { action: "SCHEDULE_REVIEW",        required: true  },
    ],
    requiredAttachments: [],
    optionalAttachments: ["RADIOGRAPH", "PHOTO"],
    globalCodes: { ADA: "D7510", ICD10: "K04.7" },
    modules: ["CLINICAL_NOTES", "EMERGENCY_INTAKE"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: [],
  },

  // ── ANAESTHESIA ──────────────────────────────────────────────

  {
    gpmrCode: "GPMR-AN001",
    canonicalName: "Local Anaesthesia Administration",
    names: {
      en: "Local Anaesthesia Administration",
      ar: "حقن مخدر موضعي",
    },
    category: "ANAESTHESIA",
    subCategory: "LOCAL",
    clinicalDescription:
      "Administration of local anaesthetic agent.",
    defaultDurationMins: 5,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: false,
    quadrantRequired: false,
    requiredInputs: [
      "anaesthetic_type",
      "concentration",
      "volume_ml",
      "injection_site",
    ],
    optionalInputs: ["vasoconstrictor", "technique"],
    prerequisites: [],
    contraindications: [
      {
        condition: "local_anaesthetic_allergy",
        severity: "BLOCK",
        message:
          "Documented LA allergy — check type. " +
          "Amide and ester allergy types differ. " +
          "Consult allergist if uncertain.",
      },
    ],
    postProcedureActions: [
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: [],
    globalCodes: { ADA: "D9930", ICD10: "Z41.8" },
    modules: ["CLINICAL_NOTES"],
    isBillable: true,
    canBundle: true,
    aiSuggestTriggers: [],
  },

  // ── APPLIANCES ───────────────────────────────────────────────

  {
    gpmrCode: "GPMR-APP001",
    canonicalName: "Occlusal Night Guard",
    names: {
      en: "Occlusal Night Guard",
      ar: "واقي الإطباق الليلي",
      "en-US": "Occlusal Guard",
    },
    category: "APPLIANCES",
    subCategory: "OCCLUSAL_GUARD",
    clinicalDescription:
      "Fabrication and delivery of occlusal guard appliance.",
    defaultDurationMins: 30,
    toothRequired: false,
    surfaceRequired: false,
    archRequired: true,
    quadrantRequired: false,
    requiredInputs: ["arch", "guard_type", "impressions_taken"],
    optionalInputs: ["delivery_appointment"],
    prerequisites: [],
    contraindications: [],
    postProcedureActions: [
      { action: "CREATE_LAB_ORDER",       required: true },
      { action: "SCHEDULE_DELIVERY",      required: true },
      { action: "DEDUCT_CHAIR_INVENTORY", required: true },
    ],
    requiredAttachments: [],
    optionalAttachments: [],
    globalCodes: { ADA: "D9940", ICD10: "K07.6" },
    modules: ["CLINICAL_NOTES", "LAB_ORDERS"],
    isBillable: true,
    canBundle: false,
    aiSuggestTriggers: ["bruxism_detected", "tmj_pain"],
  },

] as const

// ============================================================
// Country Pack Overlays
// CRITICAL: NO prices at any level
// Only codes, compliance rules, and tax applicability
// ============================================================

export const COUNTRY_PACKS: Record
  string,
  Array<{
    gpmrCode: string
    localName?: string
    localNameAr?: string
    localCodes: Record<string, string>
    taxRules: Record<string, unknown>
    insuranceCodes: Record<string, unknown>
    complianceRules: Record<string, unknown>
    workflowAdditions?: Record<string, unknown>
  }>
> = {

  AE: [
    {
      gpmrCode: "GPMR-D001",
      localName: "Comprehensive Oral Examination",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { DHA: "D0150", DOH: "01-01-001", MOH: "EX-001", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, vatRate: 5, taxName: "VAT" },
      insuranceCodes: { claimCode: "D0150", requiresPreAuth: false, allowedFrequency: "ONCE_PER_12_MONTHS" },
      complianceRules: { consentRequired: false, xrayRequired: false, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-D002",
      localNameAr: "الفحص الشفهي الدوري",
      localCodes: { DHA: "D0120", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, vatRate: 5, taxName: "VAT" },
      insuranceCodes: { claimCode: "D0120", requiresPreAuth: false },
      complianceRules: { consentRequired: false, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-D003",
      localNameAr: "أشعة العضة (فيلمان)",
      localCodes: { DHA: "D0272", ICD10: "Z01.89" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D0272", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-D004",
      localNameAr: "أشعة العضة (4 أفلام)",
      localCodes: { DHA: "D0274", ICD10: "Z01.89" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D0274", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-D005",
      localNameAr: "صورة بانورامية",
      localCodes: { DHA: "D0330", ICD10: "Z01.89" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D0330", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-D006",
      localNameAr: "صورة طرف الجذر",
      localCodes: { DHA: "D0220", ICD10: "Z01.89" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D0220", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-P001",
      localName: "Adult Prophylaxis",
      localNameAr: "تنظيف الأسنان للبالغين",
      localCodes: { DHA: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D1110", requiresPreAuth: false, allowedFrequency: "TWICE_PER_YEAR" },
      complianceRules: { consentRequired: false, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-P002",
      localNameAr: "تنظيف أسنان الأطفال",
      localCodes: { DHA: "D1120", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D1120", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-P003",
      localNameAr: "تطبيق ورنيش الفلورايد",
      localCodes: { DHA: "D1206", ICD10: "Z29.3" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D1206", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-R001",
      localNameAr: "حشو كومبوزيت — سطح واحد",
      localCodes: { DHA: "D2391", ICD10: "K02.9" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D2391", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-R002",
      localCodes: { DHA: "D2392", ICD10: "K02.9" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D2392", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-R003",
      localCodes: { DHA: "D2393", ICD10: "K02.9" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D2393", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-E001",
      localNameAr: "علاج قناة الجذر — السن الأمامي",
      localCodes: { DHA: "D3310", ICD10: "K04.0" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D3310", requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-E002",
      localCodes: { DHA: "D3320", ICD10: "K04.0" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D3320", requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-E003",
      localCodes: { DHA: "D3330", ICD10: "K04.0" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D3330", requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-PER001",
      localNameAr: "تقليح الجذور",
      localCodes: { DHA: "D4341", ICD10: "K05.3" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D4341", requiresPreAuth: true },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-PER002",
      localCodes: { DHA: "D4910", ICD10: "K05.3" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D4910", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-S001",
      localNameAr: "خلع بسيط",
      localCodes: { DHA: "D7140", ICD10: "K08.1" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D7140", requiresPreAuth: false },
      complianceRules: { consentRequired: true, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-S002",
      localNameAr: "خلع جراحي",
      localCodes: { DHA: "D7210", ICD10: "K01.1" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D7210", requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-PR001",
      localCodes: { DHA: "D2751", ICD10: "K08.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D2751", requiresPreAuth: true },
      complianceRules: { consentRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-PR002",
      localCodes: { DHA: "D2740", ICD10: "K08.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D2740", requiresPreAuth: true },
      complianceRules: { consentRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-I001",
      localNameAr: "زراعة الأسنان",
      localCodes: { DHA: "D6010", ICD10: "Z96.5" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D6010", requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-C001",
      localNameAr: "تبييض الأسنان في العيادة",
      localCodes: { DHA: "D9975", ICD10: "Z46.4" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D9975", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-AN001",
      localNameAr: "حقن مخدر موضعي",
      localCodes: { DHA: "D9930", ICD10: "Z41.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D9930", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-EM001",
      localNameAr: "فحص أسنان طارئ",
      localCodes: { DHA: "D0140", ICD10: "K08.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { claimCode: "D0140", requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
  ],

  SA: [
    {
      gpmrCode: "GPMR-D001",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { CCHI: "D0150", NPHIES: "D0150", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, vatRate: 15, taxName: "VAT", zatcaRequired: true },
      insuranceCodes: { claimCode: "D0150", requiresPreAuth: false, nphiesRequired: true },
      complianceRules: { arabicRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-P001",
      localNameAr: "تنظيف الأسنان للبالغين",
      localCodes: { CCHI: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, vatRate: 15, zatcaRequired: true },
      insuranceCodes: { claimCode: "D1110", requiresPreAuth: false, nphiesRequired: true },
      complianceRules: { arabicRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-E001",
      localNameAr: "علاج قناة الجذر",
      localCodes: { CCHI: "D3310", ICD10: "K04.0" },
      taxRules: { vatApplicable: true, vatRate: 15, zatcaRequired: true },
      insuranceCodes: { claimCode: "D3310", requiresPreAuth: true, nphiesRequired: true },
      complianceRules: { consentRequired: true, arabicRequired: true, xrayRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-S001",
      localNameAr: "خلع بسيط",
      localCodes: { CCHI: "D7140", ICD10: "K08.1" },
      taxRules: { vatApplicable: true, vatRate: 15, zatcaRequired: true },
      insuranceCodes: { claimCode: "D7140", requiresPreAuth: false, nphiesRequired: true },
      complianceRules: { consentRequired: true, arabicRequired: true, retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-I001",
      localNameAr: "زراعة الأسنان",
      localCodes: { CCHI: "D6010", ICD10: "Z96.5" },
      taxRules: { vatApplicable: true, vatRate: 15, zatcaRequired: true },
      insuranceCodes: { claimCode: "D6010", requiresPreAuth: true, nphiesRequired: true },
      complianceRules: { consentRequired: true, arabicRequired: true, xrayRequired: true, retentionYears: 10 },
    },
  ],

  GB: [
    {
      gpmrCode: "GPMR-D001",
      localName: "Full Mouth Examination",
      localCodes: { NHS: "01", SNOMED: "310585003", ICD10: "Z01.20" },
      taxRules: { vatApplicable: false, nhsBand: 1, nhsChargePence: 2680 },
      insuranceCodes: { nhsCoverage: true, requiresPreAuth: false, nhsForm: "FP17" },
      complianceRules: { gdprApplicable: true, retentionYears: 8 },
    },
    {
      gpmrCode: "GPMR-P001",
      localName: "Scale and Polish",
      localCodes: { NHS: "D1110", SNOMED: "182813001" },
      taxRules: { vatApplicable: false, nhsBand: 1, nhsChargePence: 2680 },
      insuranceCodes: { nhsCoverage: true, requiresPreAuth: false },
      complianceRules: { gdprApplicable: true, retentionYears: 8 },
    },
    {
      gpmrCode: "GPMR-E001",
      localName: "Root Canal Treatment — Anterior",
      localCodes: { NHS: "D3310", SNOMED: "83291003" },
      taxRules: { vatApplicable: false, nhsBand: 2, nhsChargePence: 7350 },
      insuranceCodes: { nhsCoverage: true, requiresPreAuth: false },
      complianceRules: { consentRequired: true, xrayRequired: true, gdprApplicable: true, retentionYears: 8 },
    },
    {
      gpmrCode: "GPMR-S001",
      localName: "Simple Extraction",
      localCodes: { NHS: "D7140" },
      taxRules: { vatApplicable: false, nhsBand: 2, nhsChargePence: 7350 },
      insuranceCodes: { nhsCoverage: true, requiresPreAuth: false },
      complianceRules: { consentRequired: true, gdprApplicable: true, retentionYears: 8 },
    },
    {
      gpmrCode: "GPMR-PR001",
      localName: "Crown",
      localCodes: { NHS: "D2751" },
      taxRules: { vatApplicable: false, nhsBand: 3, nhsChargePence: 31910 },
      insuranceCodes: { nhsCoverage: true, requiresPreAuth: false },
      complianceRules: { consentRequired: true, gdprApplicable: true, retentionYears: 8 },
    },
  ],

  US: [
    {
      gpmrCode: "GPMR-D001",
      localCodes: { CDT: "D0150", ICD10: "Z01.20", ADA: "D0150" },
      taxRules: { vatApplicable: false, salesTaxApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D0150", requiresPreAuth: false, ediFormat: "837D", allowedFrequency: "ONCE_PER_36_MONTHS" },
      complianceRules: { hipaaApplicable: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-D003",
      localCodes: { CDT: "D0272", ADA: "D0272" },
      taxRules: { vatApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D0272", requiresPreAuth: false, ediFormat: "837D" },
      complianceRules: { hipaaApplicable: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { CDT: "D1110", ADA: "D1110" },
      taxRules: { vatApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D1110", requiresPreAuth: false, allowedFrequency: "TWICE_PER_YEAR", ediFormat: "837D" },
      complianceRules: { hipaaApplicable: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-E001",
      localCodes: { CDT: "D3310", ADA: "D3310" },
      taxRules: { vatApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D3310", requiresPreAuth: true, ediFormat: "837D" },
      complianceRules: { consentRequired: true, hipaaApplicable: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-S001",
      localCodes: { CDT: "D7140", ADA: "D7140" },
      taxRules: { vatApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D7140", requiresPreAuth: false, ediFormat: "837D" },
      complianceRules: { consentRequired: true, hipaaApplicable: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-I001",
      localCodes: { CDT: "D6010", ADA: "D6010" },
      taxRules: { vatApplicable: false, hipaaApplicable: true },
      insuranceCodes: { claimCode: "D6010", requiresPreAuth: true, ediFormat: "837D" },
      complianceRules: { consentRequired: true, hipaaApplicable: true, retentionYears: 7 },
    },
  ],

  IN: [
    {
      gpmrCode: "GPMR-D001",
      localCodes: { DCI: "E01", ICD10: "Z01.20", HSN: "999312" },
      taxRules: { vatApplicable: true, gstRate: 18, taxName: "GST", gstinRequired: true },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { ICD10: "Z29.8", HSN: "999312" },
      taxRules: { vatApplicable: true, gstRate: 18, taxName: "GST" },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-E001",
      localCodes: { ICD10: "K04.0", HSN: "999312" },
      taxRules: { vatApplicable: true, gstRate: 18, taxName: "GST" },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-S001",
      localCodes: { ICD10: "K08.1", HSN: "999312" },
      taxRules: { vatApplicable: true, gstRate: 18, taxName: "GST" },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { consentRequired: true, retentionYears: 7 },
    },
  ],

  QA: [
    {
      gpmrCode: "GPMR-D001",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { MOPH: "D0150", ICD10: "Z01.20" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-P001",
      localNameAr: "تنظيف الأسنان للبالغين",
      localCodes: { MOPH: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
    {
      gpmrCode: "GPMR-E001",
      localCodes: { MOPH: "D3310", ICD10: "K04.0" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: true },
      complianceRules: { consentRequired: true, xrayRequired: true, retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-S001",
      localCodes: { MOPH: "D7140", ICD10: "K08.1" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { consentRequired: true, retentionYears: 10 },
    },
  ],

  AU: [
    {
      gpmrCode: "GPMR-D001",
      localCodes: { ADA_AU: "011", MBS: "88001", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, gstRate: 10, taxName: "GST", dentalExempt: true },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { ADA_AU: "111", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, gstRate: 10, dentalExempt: true },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 7 },
    },
    {
      gpmrCode: "GPMR-E001",
      localCodes: { ADA_AU: "411", ICD10: "K04.0" },
      taxRules: { vatApplicable: true, gstRate: 10, dentalExempt: true },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { consentRequired: true, retentionYears: 7 },
    },
  ],

  SG: [
    {
      gpmrCode: "GPMR-D001",
      localCodes: { SDC: "E1001", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, gstRate: 9, taxName: "GST" },
      insuranceCodes: { mediSaveApplicable: false, requiresPreAuth: false },
      complianceRules: { retentionYears: 6 },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { SDC: "P1001", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, gstRate: 9 },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 6 },
    },
  ],

  BH: [
    {
      gpmrCode: "GPMR-D001",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { NHRA: "D0150", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, vatRate: 10, taxName: "VAT" },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { NHRA: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, vatRate: 10 },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
  ],

  KW: [
    {
      gpmrCode: "GPMR-D001",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { MOH_KW: "D0150", ICD10: "Z01.20" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { MOH_KW: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: false },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
  ],

  OM: [
    {
      gpmrCode: "GPMR-D001",
      localNameAr: "الفحص الشفهي الشامل",
      localCodes: { MOH_OM: "D0150", ICD10: "Z01.20" },
      taxRules: { vatApplicable: true, vatRate: 5, taxName: "VAT" },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10, bilingual: true },
    },
    {
      gpmrCode: "GPMR-P001",
      localCodes: { MOH_OM: "D1110", ICD10: "Z29.8" },
      taxRules: { vatApplicable: true, vatRate: 5 },
      insuranceCodes: { requiresPreAuth: false },
      complianceRules: { retentionYears: 10 },
    },
  ],
}