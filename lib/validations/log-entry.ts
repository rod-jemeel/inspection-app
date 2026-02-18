import { z } from "zod"

// ---------------------------------------------------------------------------
// Log entry status
// ---------------------------------------------------------------------------

export const logStatusEnum = z.enum(["draft", "complete"])
export type LogStatus = z.infer<typeof logStatusEnum>

// ---------------------------------------------------------------------------
// Narcotic Log data shape (stored as JSONB in log_entries.data)
// ---------------------------------------------------------------------------

const narcoticRowSchema = z.object({
  patient: z.string().default(""),
  versed: z.number().nullable().default(null),
  versed_waste: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  fentanyl_waste: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
  drug3_waste: z.number().nullable().default(null),
  sig1: z.string().nullable().default(null),
  sig2: z.string().nullable().default(null),
})

export type NarcoticRow = z.infer<typeof narcoticRowSchema>

const narcoticCountSchema = z.object({
  versed: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
})

const narcoticEndCountSchema = z.object({
  versed: z.number().nullable().default(null),
  versed_total_waste: z.number().nullable().default(null),
  fentanyl: z.number().nullable().default(null),
  fentanyl_total_waste: z.number().nullable().default(null),
  drug3: z.number().nullable().default(null),
  drug3_total_waste: z.number().nullable().default(null),
})

export const narcoticLogDataSchema = z.object({
  drug3_name: z.string().default(""),
  header_sig1: z.string().nullable().default(null),
  header_sig2: z.string().nullable().default(null),
  beginning_count: narcoticCountSchema.default({ versed: null, fentanyl: null, drug3: null }),
  rows: z.array(narcoticRowSchema).min(1).max(50).default([{
    patient: "",
    versed: null,
    versed_waste: null,
    fentanyl: null,
    fentanyl_waste: null,
    drug3: null,
    drug3_waste: null,
    sig1: null,
    sig2: null,
  }]),
  end_count: narcoticEndCountSchema.default({ versed: null, versed_total_waste: null, fentanyl: null, fentanyl_total_waste: null, drug3: null, drug3_total_waste: null }),
  end_sig1: z.string().nullable().default(null),
  end_sig2: z.string().nullable().default(null),
})

export type NarcoticLogData = z.infer<typeof narcoticLogDataSchema>

// ---------------------------------------------------------------------------
// Controlled Substance Inventory data shape (perpetual ledger per drug)
// ---------------------------------------------------------------------------

const inventoryRowSchema = z.object({
  date: z.string().default(""),
  patient_name: z.string().default(""),
  transaction: z.string().default(""),
  qty_in_stock: z.number().nullable().default(null),
  amt_ordered: z.number().nullable().default(null),
  amt_used: z.number().nullable().default(null),
  amt_wasted: z.number().nullable().default(null),
  rn_sig: z.string().nullable().default(null),
  rn_name: z.string().default(""),
  witness_sig: z.string().nullable().default(null),
  witness_name: z.string().default(""),
})

export type InventoryRow = z.infer<typeof inventoryRowSchema>

export const inventoryLogDataSchema = z.object({
  drug_name: z.string().default(""),
  strength: z.string().default(""),
  size_qty: z.string().default(""),
  initial_stock: z.number().nullable().default(null),
  rows: z.array(inventoryRowSchema).min(1).max(200).default([{
    date: "",
    patient_name: "",
    transaction: "",
    qty_in_stock: null,
    amt_ordered: null,
    amt_used: null,
    amt_wasted: null,
    rn_sig: null,
    rn_name: "",
    witness_sig: null,
    witness_name: "",
  }]),
})

export type InventoryLogData = z.infer<typeof inventoryLogDataSchema>

// ---------------------------------------------------------------------------
// Upsert input (POST body)
// ---------------------------------------------------------------------------

export const upsertLogEntrySchema = z.object({
  log_type: z.enum(["narcotic_log", "controlled_substance_inventory", "crash_cart_checklist", "narcotic_signout", "daily_narcotic_count", "cardiac_arrest_record", "crash_cart_daily"]),
  log_key: z.string().default(""),
  log_date: z.string().date(),
  data: z.record(z.string(), z.unknown()),
  status: logStatusEnum.default("draft"),
})

export type UpsertLogEntryInput = z.infer<typeof upsertLogEntrySchema>

// ---------------------------------------------------------------------------
// Filter input (GET query params)
// ---------------------------------------------------------------------------

export const filterLogEntriesSchema = z.object({
  log_type: z.string().default("narcotic_log"),
  log_key: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: logStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type FilterLogEntriesInput = z.infer<typeof filterLogEntriesSchema>

// ---------------------------------------------------------------------------
// Per-type data validation
// ---------------------------------------------------------------------------

export function validateLogData(logType: string, data: unknown): unknown {
  switch (logType) {
    case "narcotic_log":
      return narcoticLogDataSchema.parse(data)
    case "controlled_substance_inventory":
      return inventoryLogDataSchema.parse(data)
    case "crash_cart_checklist":
      return crashCartLogDataSchema.parse(data)
    case "narcotic_signout":
      return narcoticSignoutLogDataSchema.parse(data)
    case "daily_narcotic_count":
      return dailyNarcoticCountLogDataSchema.parse(data)
    case "cardiac_arrest_record":
      return cardiacArrestRecordDataSchema.parse(data)
    case "crash_cart_daily":
      return crashCartDailyLogDataSchema.parse(data)
    default:
      throw new Error(`Unknown log type: ${logType}`)
  }
}

// ---------------------------------------------------------------------------
// Default empty narcotic log data
// ---------------------------------------------------------------------------

const BLANK_ROW: NarcoticRow = {
  patient: "",
  versed: null,
  versed_waste: null,
  fentanyl: null,
  fentanyl_waste: null,
  drug3: null,
  drug3_waste: null,
  sig1: null,
  sig2: null,
}

/** Paper form has 12 rows per page */
const DEFAULT_ROW_COUNT = 12

export function emptyNarcoticLogData(): NarcoticLogData {
  return {
    drug3_name: "",
    header_sig1: null,
    header_sig2: null,
    beginning_count: { versed: null, fentanyl: null, drug3: null },
    rows: Array.from({ length: DEFAULT_ROW_COUNT }, () => ({ ...BLANK_ROW })),
    end_count: {
      versed: null,
      versed_total_waste: null,
      fentanyl: null,
      fentanyl_total_waste: null,
      drug3: null,
      drug3_total_waste: null,
    },
    end_sig1: null,
    end_sig2: null,
  }
}

// ---------------------------------------------------------------------------
// Default empty inventory log data
// ---------------------------------------------------------------------------

const BLANK_INVENTORY_ROW: InventoryRow = {
  date: "",
  patient_name: "",
  transaction: "",
  qty_in_stock: null,
  amt_ordered: null,
  amt_used: null,
  amt_wasted: null,
  rn_sig: null,
  rn_name: "",
  witness_sig: null,
  witness_name: "",
}

const DEFAULT_INVENTORY_ROW_COUNT = 20

export function emptyInventoryLogData(): InventoryLogData {
  return {
    drug_name: "",
    strength: "",
    size_qty: "",
    initial_stock: null,
    rows: Array.from({ length: DEFAULT_INVENTORY_ROW_COUNT }, () => ({ ...BLANK_INVENTORY_ROW })),
  }
}

// ---------------------------------------------------------------------------
// Preset drug configurations
// ---------------------------------------------------------------------------

export const PRESET_DRUGS = [
  { slug: "versed", drug_name: "Versed (Midazolam)", strength: "5mg/mL", size_qty: "2mL vials" },
  { slug: "fentanyl", drug_name: "Fentanyl Citrate", strength: "50mcg/mL", size_qty: "2mL ampules" },
  { slug: "ephedrine", drug_name: "Ephedrine Sulfate", strength: "50mg/mL", size_qty: "1mL vials" },
] as const

export type PresetDrug = typeof PRESET_DRUGS[number]

// ---------------------------------------------------------------------------
// Month keys (shared by crash cart and future yearly-grid logs)
// ---------------------------------------------------------------------------

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const
export type MonthKey = typeof MONTH_KEYS[number]

// ---------------------------------------------------------------------------
// Crash Cart Monthly Checklist - preset items
// ---------------------------------------------------------------------------

export interface CrashCartItem {
  key: string
  label: string
  section?: boolean
  indent?: boolean
}

export const CRASH_CART_ITEMS: CrashCartItem[] = [
  // First Drawer
  { key: "section_first_drawer", label: "First Drawer", section: true },
  { key: "adenosine", label: "Adenosine" },
  { key: "propranolol", label: "Propranolol" },
  { key: "flumazenil", label: "Flumazenil" },
  { key: "dextrose_50", label: "Dextrose 50%" },
  { key: "glucose_gel", label: "Glucose Gel" },
  { key: "epinephrine_1_1000", label: "Epinephrine 1:1000" },
  { key: "epinephrine_1_10000", label: "Epinephrine 1:10000" },
  { key: "amiodarone", label: "Amiodarone" },
  { key: "verapamil", label: "Verapamil" },
  { key: "esmolol", label: "Esmolol" },
  { key: "ammonia_inhalant", label: "Ammonia inhalant" },
  { key: "hydralazine", label: "Hydralazine" },
  { key: "naloxone", label: "Naloxone" },
  { key: "nitrostat", label: "Nitrostat" },
  { key: "solu_medrol", label: "Solu-MEDROL" },
  { key: "diphenhydramine", label: "Diphenhydramine" },
  { key: "atropine_sulfate_1mg", label: "Atropine Sulfate Inj 1mg" },
  { key: "midazolam", label: "Midazolam" },
  // Second Drawer
  { key: "section_second_drawer", label: "Second Drawer", section: true },
  { key: "lidocaine_2_syr", label: "Lidocaine 2% SYR" },
  { key: "ventolin", label: "Ventolin" },
  { key: "labetolol", label: "Labetolol" },
  { key: "ephedrine_sulfate", label: "Ephedrine Sulfate" },
  { key: "syringes_3ml", label: "Syringes 3mL" },
  { key: "syringes_5ml", label: "Syringes 5mL" },
  { key: "syringes_10ml", label: "Syringes 10mL" },
  { key: "saline_flush", label: "Saline flush" },
  { key: "tourniquet", label: "Tourniquet" },
  { key: "dexamethasone", label: "Dexamethasone" },
  { key: "tape_micropore_transpore", label: "Tape (Micropore & Transpore)" },
  { key: "needles_18g", label: "Needles (18G hypodermic)" },
  { key: "filter_needles", label: "Filter Needles" },
  { key: "iv_admin_extension_set", label: "IV administration extension set" },
  { key: "alcohol_pads", label: "Alcohol Pads" },
  { key: "iv_catheters_22g", label: "IV Catheters 22g" },
  { key: "iv_catheters_20g", label: "IV Catheters 20g" },
  // Third Drawer
  { key: "section_third_drawer", label: "Third Drawer", section: true },
  { key: "iv_tubing", label: "IV Tubing" },
  { key: "nacl_500ml", label: "0.9% NaCl 500mL" },
  { key: "electrodes", label: "Electrodes" },
  { key: "nasal_cannula", label: "Nasal Cannula" },
  // Fifth Drawer (no Fourth Drawer on the paper form)
  { key: "section_fifth_drawer", label: "Fifth Drawer", section: true },
  { key: "lube", label: "Lube" },
  { key: "nasal_airways", label: "Nasal Airways" },
  { key: "nasal_airways_20fr", label: "20 FR", indent: true },
  { key: "nasal_airways_22fr", label: "22 FR", indent: true },
  { key: "nasal_airways_24fr", label: "24 FR", indent: true },
  { key: "nasal_airways_26fr", label: "26 FR", indent: true },
  { key: "nasal_airways_28fr", label: "28 FR", indent: true },
  { key: "nasal_airways_30fr", label: "30 FR", indent: true },
  { key: "nasal_airways_32fr", label: "32 FR", indent: true },
  { key: "nasal_airways_34fr", label: "34 FR", indent: true },
  { key: "nasal_airways_36fr", label: "36 FR", indent: true },
  { key: "oral_airway", label: "Oral Airway" },
  { key: "laryngoscope_curved_blade", label: "Laryngoscope & Curved Blade" },
  { key: "single_use_curved_blade", label: "Single-Use Curved Blade" },
  { key: "curved_blade_mac_2", label: "MAC 2", indent: true },
  { key: "curved_blade_mac_4", label: "MAC 4", indent: true },
  { key: "single_use_straight_blade", label: "Single-Use Straight Blade" },
  { key: "straight_blade_mill_2", label: "MILL 2", indent: true },
  { key: "straight_blade_mill_3", label: "MILL 3", indent: true },
  // Sixth Drawer
  { key: "section_sixth_drawer", label: "Sixth Drawer", section: true },
  { key: "ambu_bag", label: "Ambu Bag" },
  { key: "et_tube", label: "Endotracheal (ET) Tube" },
  { key: "et_tube_6_5", label: "6.5", indent: true },
  { key: "et_tube_7_5", label: "7.5", indent: true },
  { key: "lma", label: "Laryngeal Mask (LMA)" },
  { key: "lma_3", label: "#3", indent: true },
  { key: "lma_4", label: "#4", indent: true },
  { key: "lma_5", label: "#5", indent: true },
  { key: "suction_tubing", label: "Suction Tubing" },
  { key: "suction_yankauer", label: "Suction Yankauer" },
]

// ---------------------------------------------------------------------------
// Top of Cart items
// ---------------------------------------------------------------------------

export const TOP_OF_CART_ITEMS = [
  { key: "portable_suction_machine", label: "Portable suction machine" },
  { key: "ambu_bag_mask", label: "Ambu Bag and Mask" },
  { key: "acls_algorithms", label: "ACLS Algorithms (current version)" },
  { key: "defibrillator_aed", label: "Defibrillator or AED" },
  { key: "code_tracking_forms", label: "Code Tracking Forms/Logs" },
  { key: "hospital_transfer_forms", label: "Hospital Transfer Forms" },
  { key: "defibrillator_suction_manual", label: "Defibrillator/Suction Manual" },
  { key: "breakable_locks", label: "Breakable Locks in Narcotic Cabinet" },
] as const

// ---------------------------------------------------------------------------
// Crash Cart Log data shape (stored as JSONB in log_entries.data)
// ---------------------------------------------------------------------------

const monthValuesSchema = z.record(z.string(), z.string().default(""))

const crashCartSignatureSchema = z.object({
  name: z.string().default(""),
  signature: z.string().nullable().default(null),
  initials: z.string().default(""),
})

export const crashCartLogDataSchema = z.object({
  year: z.number(),
  par: z.record(z.string(), z.string().default("")).default({}),
  exp: z.record(z.string(), z.string().default("")).default({}),
  months: z.object({
    jan: monthValuesSchema.default({}),
    feb: monthValuesSchema.default({}),
    mar: monthValuesSchema.default({}),
    apr: monthValuesSchema.default({}),
    may: monthValuesSchema.default({}),
    jun: monthValuesSchema.default({}),
    jul: monthValuesSchema.default({}),
    aug: monthValuesSchema.default({}),
    sep: monthValuesSchema.default({}),
    oct: monthValuesSchema.default({}),
    nov: monthValuesSchema.default({}),
    dec: monthValuesSchema.default({}),
  }).default({
    jan: {}, feb: {}, mar: {}, apr: {}, may: {}, jun: {},
    jul: {}, aug: {}, sep: {}, oct: {}, nov: {}, dec: {},
  }),
  completed_by: z.record(z.string(), z.string().default("")).default({}),
  top_of_cart: z.record(z.string(), z.boolean().default(false)).default({}),
  signatures: z.array(crashCartSignatureSchema).default(
    Array.from({ length: 6 }, () => ({ name: "", signature: null, initials: "" }))
  ),
})

export type CrashCartLogData = z.infer<typeof crashCartLogDataSchema>

// ---------------------------------------------------------------------------
// Default empty crash cart log data
// ---------------------------------------------------------------------------

export function emptyCrashCartLogData(year?: number): CrashCartLogData {
  return {
    year: year ?? new Date().getFullYear(),
    par: {},
    exp: {},
    months: {
      jan: {}, feb: {}, mar: {}, apr: {}, may: {}, jun: {},
      jul: {}, aug: {}, sep: {}, oct: {}, nov: {}, dec: {},
    },
    completed_by: {},
    top_of_cart: {},
    signatures: Array.from({ length: 6 }, () => ({ name: "", signature: null, initials: "" })),
  }
}

// ---------------------------------------------------------------------------
// Narcotic Sign-out Form
// ---------------------------------------------------------------------------

export const SIGNOUT_DRUGS = [
  { key: "fentanyl_250", label: "Fentanyl 250mcg (5ml)" },
  { key: "fentanyl_100", label: "Fentanyl 100mcg (2ml)" },
  { key: "midazolam_5", label: "Midazolam 5mg (5ml)" },
  { key: "midazolam_2", label: "Midazolam 2mg (2ml)" },
  { key: "custom", label: "" },
] as const

export type SignoutDrugKey = typeof SIGNOUT_DRUGS[number]["key"]

const signoutDrugHeaderSchema = z.object({
  anesthesiologist_sig: z.string().nullable().default(null),
  nurse_sig: z.string().nullable().default(null),
  qty_dispensed: z.string().default(""),
})

const signoutCaseSchema = z.object({
  patient_name: z.string().default(""),
  amounts: z.record(z.string(), z.object({
    administered: z.string().default(""),
    wasted: z.string().default(""),
  })).default({}),
  co_signature: z.string().nullable().default(null),
})

export const narcoticSignoutLogDataSchema = z.object({
  anesthesia_md: z.string().default(""),
  print_name: z.string().default(""),
  custom_drug_name: z.string().default(""),
  drug_headers: z.record(z.string(), signoutDrugHeaderSchema).default({}),
  cases: z.array(signoutCaseSchema).min(1).max(10).default(
    Array.from({ length: 5 }, () => ({
      patient_name: "",
      amounts: {},
      co_signature: null,
    }))
  ),
  total_qty_used: z.record(z.string(), z.string().default("")).default({}),
  end_balance: z.record(z.string(), z.string().default("")).default({}),
  rn_signature: z.string().nullable().default(null),
})

export type NarcoticSignoutLogData = z.infer<typeof narcoticSignoutLogDataSchema>

// ---------------------------------------------------------------------------
// Default empty narcotic sign-out data
// ---------------------------------------------------------------------------

function emptyDrugHeaders(): NarcoticSignoutLogData["drug_headers"] {
  const h: NarcoticSignoutLogData["drug_headers"] = {}
  for (const d of SIGNOUT_DRUGS) {
    h[d.key] = { anesthesiologist_sig: null, nurse_sig: null, qty_dispensed: "" }
  }
  return h
}

function emptyAmounts(): NarcoticSignoutLogData["cases"][number]["amounts"] {
  const a: NarcoticSignoutLogData["cases"][number]["amounts"] = {}
  for (const d of SIGNOUT_DRUGS) {
    a[d.key] = { administered: "", wasted: "" }
  }
  return a
}

export function emptyNarcoticSignoutLogData(): NarcoticSignoutLogData {
  return {
    anesthesia_md: "",
    print_name: "",
    custom_drug_name: "",
    drug_headers: emptyDrugHeaders(),
    cases: Array.from({ length: 5 }, () => ({
      patient_name: "",
      amounts: emptyAmounts(),
      co_signature: null,
    })),
    total_qty_used: Object.fromEntries(SIGNOUT_DRUGS.map((d) => [d.key, ""])),
    end_balance: Object.fromEntries(SIGNOUT_DRUGS.map((d) => [d.key, ""])),
    rn_signature: null,
  }
}

// ---------------------------------------------------------------------------
// Daily Narcotic Count (monthly overview)
// ---------------------------------------------------------------------------

export const NARCOTIC_COUNT_DRUGS = [
  { key: "fentanyl", label: "Fentanyl 100 mcg/2ml,", detail: "ampoules or vials" },
  { key: "midazolam", label: "Midazolam 2mg/2ml, vials" },
  { key: "ephedrine", label: "Ephedrine 50mg/ml,", detail: "1 ml ampoules" },
] as const

const narcoticCountEntrySchema = z.object({
  date: z.string().default(""),
  fentanyl: z.object({ am: z.string().default(""), rcvd: z.string().default(""), used: z.string().default(""), pm: z.string().default("") }).default({ am: "", rcvd: "", used: "", pm: "" }),
  midazolam: z.object({ am: z.string().default(""), rcvd: z.string().default(""), used: z.string().default(""), pm: z.string().default("") }).default({ am: "", rcvd: "", used: "", pm: "" }),
  ephedrine: z.object({ am: z.string().default(""), rcvd: z.string().default(""), used: z.string().default(""), pm: z.string().default("") }).default({ am: "", rcvd: "", used: "", pm: "" }),
  initials: z.string().default(""), // kept for backward compat
  initials_am: z.string().default(""),
  initials_am_2: z.string().default(""),
  initials_pm: z.string().default(""),
  initials_pm_2: z.string().default(""),
})

export type NarcoticCountEntry = z.infer<typeof narcoticCountEntrySchema>

const narcoticCountSigSchema = z.object({
  name: z.string().default(""),
  signature: z.string().nullable().default(null),
  initials: z.string().default(""),
})

export const dailyNarcoticCountLogDataSchema = z.object({
  month_label: z.string().default(""),
  year: z.number().default(2026),
  from_date: z.string().default(""),
  to_date: z.string().default(""),
  entries: z.array(narcoticCountEntrySchema).default(
    Array.from({ length: 10 }, () => ({
      date: "",
      fentanyl: { am: "", rcvd: "", used: "", pm: "" },
      midazolam: { am: "", rcvd: "", used: "", pm: "" },
      ephedrine: { am: "", rcvd: "", used: "", pm: "" },
      initials: "",
      initials_am: "",
      initials_am_2: "",
      initials_pm: "",
      initials_pm_2: "",
    }))
  ),
  signatures: z.array(narcoticCountSigSchema).default(
    Array.from({ length: 8 }, () => ({ name: "", signature: null, initials: "" }))
  ),
})

export type DailyNarcoticCountLogData = z.infer<typeof dailyNarcoticCountLogDataSchema>

export function emptyDailyNarcoticCountLogData(): DailyNarcoticCountLogData {
  return {
    month_label: "",
    year: new Date().getFullYear(),
    from_date: "",
    to_date: "",
    entries: Array.from({ length: 10 }, () => ({
      date: "",
      fentanyl: { am: "", rcvd: "", used: "", pm: "" },
      midazolam: { am: "", rcvd: "", used: "", pm: "" },
      ephedrine: { am: "", rcvd: "", used: "", pm: "" },
      initials: "",
      initials_am: "",
      initials_am_2: "",
      initials_pm: "",
      initials_pm_2: "",
    })),
    signatures: Array.from({ length: 8 }, () => ({ name: "", signature: null, initials: "" })),
  }
}

// ---------------------------------------------------------------------------
// Cardiac Arrest Record
// ---------------------------------------------------------------------------

const cardiacArrestRowSchema = z.object({
  time: z.string().default(""),
  cardiac_rhythm: z.string().default(""),
  pulse: z.string().default(""),
  respirations: z.string().default(""),
  blood_pressure: z.string().default(""),
  epinephrine: z.string().default(""),
  atropine: z.string().default(""),
  lidocaine_drug: z.string().default(""),
  other_drug: z.string().default(""),
  joules: z.string().default(""),
  rhythm_pre: z.string().default(""),
  rhythm_post: z.string().default(""),
  lidocaine_iv: z.string().default(""),
  dopamine: z.string().default(""),
  dobutamine: z.string().default(""),
  other_iv: z.string().default(""),
  comments: z.string().default(""),
})

export type CardiacArrestRow = z.infer<typeof cardiacArrestRowSchema>

export const cardiacArrestRecordDataSchema = z.object({
  admission_diagnosis: z.string().default(""),
  history_prior: z.string().default(""),
  last_observation_time: z.string().default(""),
  initial_signs: z.object({
    cyanosis: z.boolean().default(false),
    apnea: z.boolean().default(false),
    absence_of_pulse: z.boolean().default(false),
    other: z.string().default(""),
  }).default({ cyanosis: false, apnea: false, absence_of_pulse: false, other: "" }),
  initial_heart_rhythm: z.string().default(""),
  site_of_arrest: z.string().default(""),
  arrest_date: z.string().default(""),
  arrest_time: z.string().default(""),
  page_number: z.string().default(""),
  page_total: z.string().default(""),
  time_cpr_begun: z.string().default(""),
  ventilation: z.object({
    mouth_mask: z.boolean().default(false),
    bag_mask: z.boolean().default(false),
    bag_tube: z.boolean().default(false),
  }).default({ mouth_mask: false, bag_mask: false, bag_tube: false }),
  intubated_by: z.string().default(""),
  ett_size: z.string().default(""),
  intubation_time: z.string().default(""),
  rows: z.array(cardiacArrestRowSchema).default(
    Array.from({ length: 12 }, () => ({
      time: "", cardiac_rhythm: "", pulse: "", respirations: "",
      blood_pressure: "", epinephrine: "", atropine: "", lidocaine_drug: "",
      other_drug: "", joules: "", rhythm_pre: "", rhythm_post: "",
      lidocaine_iv: "", dopamine: "", dobutamine: "", other_iv: "", comments: "",
    }))
  ),
  code_terminated_by: z.string().default(""),
  termination_date: z.string().default(""),
  patient_outcome: z.string().default(""),
  termination_time: z.string().default(""),
  transferred_to: z.string().default(""),
  neuro_status: z.string().default(""),
  time_family_notified: z.string().default(""),
  time_md_notified: z.string().default(""),
  team_leader: z.string().default(""),
  recording_rn: z.string().default(""),
  respiratory_care: z.string().default(""),
  medication_rn: z.string().default(""),
  other_sig_1: z.string().default(""),
  other_sig_2: z.string().default(""),
})

export type CardiacArrestRecordData = z.infer<typeof cardiacArrestRecordDataSchema>

export function emptyCardiacArrestRecordData(): CardiacArrestRecordData {
  return cardiacArrestRecordDataSchema.parse({})
}

// ---------------------------------------------------------------------------
// Crash Cart Daily Checklist
// ---------------------------------------------------------------------------

export const CRASH_CART_DAILY_ITEMS = [
  { key: "aed_unit_operational", label: "Check AED Unit for intactness & is operational" },
  { key: "aed_pads_cables", label: "Check AED Pads/Cables" },
  { key: "suction_operational", label: "Suction Operational" },
  { key: "o2_tank_full", label: "O2 Tank (E) Full" },
  { key: "cpr_board", label: "CPR Board" },
  { key: "supplies_with_aed", label: "Supplies with AED" },
  { key: "lock_intact", label: "Lock Intact" },
] as const

const lockChangeSchema = z.object({
  date_reason: z.string().default(""),
  new_lock: z.string().default(""),
})

const crashCartDailySigSchema = z.object({
  name: z.string().default(""),
  signature: z.string().nullable().default(null),
  initials: z.string().default(""),
})

export const crashCartDailyLogDataSchema = z.object({
  year: z.number(),
  month: z.string().default(""),
  checks: z.record(z.string(), z.record(z.string(), z.string().default(""))).default({}),
  lock_digits: z.tuple([
    z.record(z.string(), z.string().default("")).default({}),
    z.record(z.string(), z.string().default("")).default({}),
    z.record(z.string(), z.string().default("")).default({}),
  ]).default([{}, {}, {}]),
  initials: z.record(z.string(), z.string().default("")).default({}),
  notes: z.record(z.string(), z.string().default("")).default({}),
  lock_changes: z.array(lockChangeSchema).default(
    Array.from({ length: 4 }, () => ({ date_reason: "", new_lock: "" }))
  ),
  signatures: z.array(crashCartDailySigSchema).default(
    Array.from({ length: 4 }, () => ({ name: "", signature: null, initials: "" }))
  ),
  bottom_notes: z.string().default(""),
})

export type CrashCartDailyLogData = z.infer<typeof crashCartDailyLogDataSchema>

export function emptyCrashCartDailyLogData(year?: number, month?: string): CrashCartDailyLogData {
  return {
    year: year ?? new Date().getFullYear(),
    month: month ?? "",
    checks: {},
    lock_digits: [{}, {}, {}],
    initials: {},
    notes: {},
    lock_changes: Array.from({ length: 4 }, () => ({ date_reason: "", new_lock: "" })),
    signatures: Array.from({ length: 4 }, () => ({ name: "", signature: null, initials: "" })),
    bottom_notes: "",
  }
}
