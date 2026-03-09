/**
 * PostgreSQL Storage Layer for Dental Clinic Management System
 * 
 * This file provides the data access layer with methods for:
 * - CRUD operations for all entities (patients, visits, medicines, etc.)
 * - Server-side pagination with search
 * - Bulk operations for performance (e.g., stock updates)
 * - Database schema migrations and table setup
 * 
 * Architecture:
 * - Uses 'pg' library with connection pooling
 * - In-memory caching with 60-second TTL for frequently accessed data
 * - Parameterized queries to prevent SQL injection
 * - Optimistic locking for concurrent updates
 * 
 * Connection Pool Settings:
 * - min: 2 (warm connections to avoid cold starts)
 * - max: 10 (maximum concurrent connections)
 * - idleTimeoutMillis: 30000 (close idle after 30s)
 * - connectionTimeoutMillis: 10000 (fail fast)
 */

import {
  type Patient,
  type InsertPatient,
  type Referrer,
  type ReferrerStats,
  type InsertReferrer,
  type PatientReferralInfo,
  type Visit,
  type InsertVisit,
  type Medicine,
  type InsertMedicine,
  type Treatment,
  type InsertTreatment,
  type Bill,
  type InsertBill,
  type Expense,
  type InsertExpense,
  type BillTreatmentItem,
  type BillMedicineItem,
  type Appointment,
  type InsertAppointment,
  // Dental-specific types
  type ToothRecord,
  type InsertToothRecord,
  type TreatmentSitting,
  type InsertTreatmentSitting,
  type UpdateTreatmentSitting,
  type SittingDetail,
  type BodyRecord,
  type InsertBodyRecord,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { Pool } from "pg";

// Database connection string from environment variable
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

/**
 * PostgreSQL Connection Pool Configuration
 * 
 * Optimized for a typical clinic workload:
 * - 2 minimum connections kept warm for instant queries
 * - 10 maximum for handling concurrent users during busy hours
 * - Auto-cleanup of idle connections to reduce database load
 */
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  min: 2,                    // Keep 2 connections warm to avoid cold starts
  max: 10,                   // Maximum connections for concurrent requests
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10s
});

export interface IStorage {
  // Pagination result type
  // Patients
  getPatients(): Promise<Patient[]>;
  getPatientsPaginated(page: number, limit: number, search?: string): Promise<{ data: Patient[]; total: number; page: number; limit: number }>;
  getPatientsCount(): Promise<number>;
  getTodaysPatientsCount(): Promise<number>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, patient: InsertPatient): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<boolean>;
  // Referral system methods
  getPatientReferralInfo(patientId: string): Promise<PatientReferralInfo>;
  updatePatientCreditBalance(patientId: string, additionalCredit: number): Promise<Patient | undefined>;

  // Referrers (both patient and non-patient referrers)
  getReferrers(): Promise<Referrer[]>;
  getReferrer(id: string): Promise<Referrer | undefined>;
  getReferrerStats(id: string): Promise<ReferrerStats | undefined>;
  createReferrer(referrer: InsertReferrer): Promise<Referrer>;
  updateReferrerCredit(referrerId: string, additionalCredit: number): Promise<Referrer | undefined>;


  // Visits
  getVisits(): Promise<Visit[]>;
  getVisitsByPatient(patientId: string): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: string, visit: InsertVisit): Promise<Visit | undefined>;

  // Medicines
  getMedicines(): Promise<Medicine[]>;
  getMedicine(id: string): Promise<Medicine | undefined>;
  createMedicine(medicine: InsertMedicine): Promise<Medicine>;
  updateMedicine(id: string, medicine: InsertMedicine): Promise<Medicine | undefined>;
  deleteMedicine(id: string): Promise<boolean>;
  updateMedicineStock(id: string, quantity: number): Promise<Medicine | undefined>;
  updateMedicineStocksBulk(updates: { id: string; quantityChange: number }[]): Promise<void>;
  getMedicinesByIds(ids: string[]): Promise<Medicine[]>;

  // Treatments
  getTreatments(): Promise<Treatment[]>;
  getTreatment(id: string): Promise<Treatment | undefined>;
  createTreatment(treatment: InsertTreatment): Promise<Treatment>;
  updateTreatment(id: string, treatment: InsertTreatment): Promise<Treatment | undefined>;
  deleteTreatment(id: string): Promise<boolean>;
  getTreatmentByName(name: string): Promise<Treatment | undefined>;

  // Bills
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: InsertBill, patientName: string): Promise<Bill>;
  updateBill(id: string, bill: InsertBill, patientName: string): Promise<Bill | undefined>;
  updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined>;
  updatePatientBillsName(patientId: string, patientName: string): Promise<void>;
  deleteBill(id: string): Promise<boolean>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: InsertExpense): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: InsertAppointment): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;

  // Tooth Records (Dental Chart)
  getToothRecords(patientId: string): Promise<ToothRecord[]>;
  getToothRecord(id: string): Promise<ToothRecord | undefined>;
  createToothRecord(record: InsertToothRecord): Promise<ToothRecord>;
  updateToothRecord(id: string, record: InsertToothRecord): Promise<ToothRecord | undefined>;
  deleteToothRecord(id: string): Promise<boolean>;

  // Treatment Sittings (Multi-sitting workflow)
  getTreatmentSittings(patientId: string): Promise<TreatmentSitting[]>;
  getTreatmentSitting(id: string): Promise<TreatmentSitting | undefined>;
  createTreatmentSitting(sitting: InsertTreatmentSitting): Promise<TreatmentSitting>;
  updateTreatmentSitting(id: string, sitting: UpdateTreatmentSitting): Promise<TreatmentSitting | undefined>;
  deleteTreatmentSitting(id: string): Promise<boolean>;
  getPendingSittings(): Promise<TreatmentSitting[]>; // For reports

  // Body Records (Body Chart)
  getBodyRecords(patientId: string): Promise<BodyRecord[]>;
  createBodyRecord(record: InsertBodyRecord): Promise<BodyRecord>;
  deleteBodyRecord(patientId: string, bodyPart: string): Promise<void>;

  // Initialization
  initialize(): Promise<void>;
}

// User table and auth-related types removed

type DbPatientRow = {
  id: string | number;
  name: string;
  phone: string;
  registration_date: string;
  // Referral system fields
  referred_by_patient_id?: string | number;
  referred_by_referrer_id?: string | number;
  referral_credit_balance?: number;
  first_bill_processed?: boolean;
};

type DbVisitRow = {
  id: string | number;
  patient_id: string | number;
  date: string;
  complaints: string;
  diagnosis: string;
  visit_number: number;
};

type DbMedicineRow = {
  id: string | number;
  name: string;
  purchase_cost: number;
  selling_price: number;
  quantity: number;
  // Dental-specific fields
  category?: string;
  expiry_date?: string;
};

type DbTreatmentRow = {
  id: string | number;
  name: string;
  default_price: number;
  // Dental-specific fields
  gst_percentage: number;
  number_of_sittings: number;
  category?: string;
};

type DbBillRow = {
  id: string | number;
  patient_id: string | number;
  patient_name: string;
  date: string;
  treatments: BillTreatmentItem[] | string;
  medicines: BillMedicineItem[] | string;
  treatment_total: number;
  medicine_total: number;
  gst_total: number;
  treatment_discount?: number;
  medicine_discount?: number;
  grand_total: number;
  amount_paid: number;
  pending_amount: number;
};

type DbExpenseRow = {
  id: string | number;
  description: string;
  amount: number;
  date: string;
  category: string;
};

type DbAppointmentRow = {
  id: string | number;
  patient_id: string | number;
  patient_name?: string; // We might join this or fetch it separately
  date: string;
  reason: string;
  status: string;
};

// Dental-specific row types
type DbToothRecordRow = {
  id: string | number;
  patient_id: string | number;
  tooth_number: number;
  quadrant: string;
  condition: string;
  notes?: string;
  treatment_id?: string | number;
  created_at: string;
  updated_at: string;
};

type DbTreatmentSittingRow = {
  id: string | number;
  patient_id: string | number;
  treatment_id: string | number;
  treatment_name: string;
  bill_id?: string | number;
  tooth_numbers: number[] | string;
  total_sittings: number;
  completed_sittings: number;
  status: string;
  sitting_details: SittingDetail[] | string;
  start_date: string;
  last_visit_date?: string;
  notes?: string;
};

type DbBodyRecordRow = {
  id: string | number;
  patient_id: string | number;
  body_part: string;
  pain_level?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
};

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS patients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    registration_date TEXT NOT NULL,
    referred_by_patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    referral_discount_percentage DOUBLE PRECISION DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    complaints TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    visit_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS visits_patient_idx ON visits(patient_id)`,
  `CREATE TABLE IF NOT EXISTS medicines (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    purchase_cost DOUBLE PRECISION NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL,
    quantity INTEGER NOT NULL,
    category TEXT DEFAULT 'Medicine',
    expiry_date TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    default_price DOUBLE PRECISION NOT NULL,
    gst_percentage DOUBLE PRECISION DEFAULT 0,
    number_of_sittings INTEGER DEFAULT 1,
    category TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    date TEXT NOT NULL,
    treatments JSONB NOT NULL,
    medicines JSONB NOT NULL,
    treatment_total DOUBLE PRECISION NOT NULL,
    medicine_total DOUBLE PRECISION NOT NULL,
    gst_total DOUBLE PRECISION DEFAULT 0,
    grand_total DOUBLE PRECISION NOT NULL,
    amount_paid DOUBLE PRECISION NOT NULL,
    pending_amount DOUBLE PRECISION NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS bills_patient_idx ON bills(patient_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id)`,
  // New dental-specific tables
  `CREATE TABLE IF NOT EXISTS tooth_records (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    tooth_number INTEGER NOT NULL,
    quadrant TEXT NOT NULL,
    condition TEXT NOT NULL,
    notes TEXT,
    treatment_id BIGINT REFERENCES treatments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS tooth_records_patient_idx ON tooth_records(patient_id)`,
  `CREATE TABLE IF NOT EXISTS treatment_sittings (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES treatments(id),
    treatment_name TEXT NOT NULL,
    bill_id BIGINT REFERENCES bills(id),
    tooth_numbers JSONB DEFAULT '[]',
    total_sittings INTEGER NOT NULL,
    completed_sittings INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Planned',
    sitting_details JSONB DEFAULT '[]',
    start_date TEXT NOT NULL,
    last_visit_date TEXT,
    notes TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS treatment_sittings_patient_idx ON treatment_sittings(patient_id)`,
  `CREATE TABLE IF NOT EXISTS body_records (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    body_part TEXT NOT NULL,
    pain_level INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, body_part)
  )`,
  `CREATE TABLE IF NOT EXISTS body_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    record_date TEXT NOT NULL,
    teeth_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // Enhanced Referral System
  // NOTE: patient_id is created as TEXT to accommodate both UUIDs and Integers without error.
  // We strictly enforce the FK via ALTER TABLE later if possible, but allow creation first.
  `CREATE TABLE IF NOT EXISTS referrers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    is_patient BOOLEAN DEFAULT FALSE,
    patient_id TEXT, 
    total_credit_earned DOUBLE PRECISION DEFAULT 0,
    available_credit DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

// Dental-specific column additions for existing databases
const alterTableStatements = [
  // Migration for patients table: drop old columns, rename discount to credit, add first_bill_processed
  `DO $$
    WHEN undefined_column THEN NULL; -- Ignore errors if columns don't exist
  END $$;`,
  // Medicines table additions
  `ALTER TABLE medicines ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Medicine'`,
  `ALTER TABLE medicines ADD COLUMN IF NOT EXISTS expiry_date TEXT`,
  // Treatments table additions
  `ALTER TABLE treatments ADD COLUMN IF NOT EXISTS gst_percentage DOUBLE PRECISION DEFAULT 0`,
  `ALTER TABLE treatments ADD COLUMN IF NOT EXISTS number_of_sittings INTEGER DEFAULT 1`,
  `ALTER TABLE treatments ADD COLUMN IF NOT EXISTS category TEXT`,
  // Bills table additions
  `ALTER TABLE bills ADD COLUMN IF NOT EXISTS gst_total DOUBLE PRECISION DEFAULT 0`,
  // Fix for referrers table patient_id type (it was BIGINT but patients might be TEXT/UUID)
  `ALTER TABLE referrers ALTER COLUMN patient_id TYPE TEXT USING patient_id::TEXT`,
  `ALTER TABLE referrers ADD COLUMN IF NOT EXISTS total_credit_earned DOUBLE PRECISION DEFAULT 0`,
  `ALTER TABLE referrers ADD COLUMN IF NOT EXISTS available_credit DOUBLE PRECISION DEFAULT 0`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_credit_balance DOUBLE PRECISION DEFAULT 0`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_bill_processed BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS referred_by_referrer_id BIGINT`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS referred_by_patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL`,
  // Try to add FK constraint if it doesn't exist (this might fail if types mismatch perfectly, but at least table exists)
  // We use a DO block to ignore error if constraint already exists or fails
  `DO $$ 
   BEGIN 
     ALTER TABLE referrers ADD CONSTRAINT referrers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id); 
   EXCEPTION 
     WHEN duplicate_object THEN NULL;
     WHEN undefined_table THEN NULL;
     WHEN OTHERS THEN NULL; -- Ignore type mismatch for now, application logic handles linking
   END $$;`
];

async function ensureTables(): Promise<void> {
  for (const statement of createTableStatements) {
    await pool.query(statement);
  }
  // Run ALTER statements to add columns if they don't exist (for existing databases)
  for (const alterStmt of alterTableStatements) {
    try {
      await pool.query(alterStmt);
    } catch (err) {
      // Ignore errors from columns already existing
      console.log("Column may already exist:", alterStmt);
    }
  }
}


class DataCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  constructor(private ttlMs: number) { }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

type EntityTable = "referrers" | "patients" | "visits" | "medicines" | "treatments" | "bills" | "expenses" | "appointments" | "tooth_records" | "treatment_sittings" | "body_records";
type IdMode = "numeric" | "text";

async function getColumnDataType(table: string, column: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ data_type: string }>(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows[0]?.data_type;
}

async function detectIdModes(): Promise<Record<EntityTable, IdMode>> {
  const tables: EntityTable[] = ["referrers", "patients", "visits", "medicines", "treatments", "bills", "expenses", "appointments", "tooth_records", "treatment_sittings", "body_records"];
  const entries = await Promise.all(
    tables.map(async (table) => {
      const dataType = await getColumnDataType(table, "id");
      const mode: IdMode = dataType === "bigint" || dataType === "integer" ? "numeric" : "text";
      return [table, mode] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<EntityTable, IdMode>;
}

const normalizeId = (value: string | number): string => value.toString();

// mapUser removed

const mapPatient = (row: DbPatientRow): Patient => ({
  id: normalizeId(row.id),
  name: row.name,
  phone: row.phone,
  registrationDate: row.registration_date,
  referredByPatientId: row.referred_by_patient_id ? String(row.referred_by_patient_id) : undefined,
  referredByReferrerId: row.referred_by_referrer_id ? String(row.referred_by_referrer_id) : undefined,
  referralCreditBalance: row.referral_credit_balance || 0,
  firstBillProcessed: row.first_bill_processed || false,
});

type DbReferrerRow = {
  id: string | number;
  name: string;
  phone: string;
  is_patient: boolean;
  patient_id: string | number;
  total_credit_earned: number;
  available_credit: number;
  created_at: string;
};

const mapReferrer = (row: DbReferrerRow): Referrer => ({
  id: normalizeId(row.id),
  name: row.name,
  phone: row.phone,
  isPatient: row.is_patient,
  patientId: row.patient_id ? normalizeId(row.patient_id) : undefined,
  totalCreditEarned: Number(row.total_credit_earned),
  availableCredit: Number(row.available_credit),
  createdAt: row.created_at,
});

const mapVisit = (row: DbVisitRow): Visit => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  date: row.date,
  complaints: row.complaints,
  diagnosis: row.diagnosis,
  visitNumber: row.visit_number,
});

const mapMedicine = (row: DbMedicineRow): Medicine => ({
  id: normalizeId(row.id),
  name: row.name,
  purchaseCost: row.purchase_cost,
  sellingPrice: row.selling_price,
  quantity: row.quantity,
  // Dental-specific fields
  category: row.category,
  expiryDate: row.expiry_date,
});

const mapTreatment = (row: DbTreatmentRow): Treatment => ({
  id: normalizeId(row.id),
  name: row.name,
  defaultPrice: row.default_price,
  // Dental-specific fields
  gstPercentage: row.gst_percentage ?? 0,
  numberOfSittings: row.number_of_sittings ?? 1,
  category: row.category,
});

const mapBill = (row: DbBillRow): Bill => {
  // Parse medicines if it's a string (stored as JSON in DB)
  let medicines = row.medicines ?? [];
  if (typeof medicines === "string") {
    try {
      medicines = JSON.parse(medicines);
    } catch (e) {
      medicines = [];
    }
  }

  // Parse treatments if it's a string (stored as JSON in DB)
  let treatments = row.treatments ?? [];
  if (typeof treatments === "string") {
    try {
      treatments = JSON.parse(treatments);
    } catch (e) {
      treatments = [];
    }
  }

  return {
    id: normalizeId(row.id),
    patientId: normalizeId(row.patient_id),
    patientName: row.patient_name,
    date: row.date,
    treatments: treatments as BillTreatmentItem[],
    medicines: medicines as BillMedicineItem[],
    treatmentTotal: row.treatment_total,
    medicineTotal: row.medicine_total,
    gstTotal: row.gst_total ?? 0,
    treatmentDiscount: row.treatment_discount ?? 0,
    medicineDiscount: row.medicine_discount ?? 0,
    grandTotal: row.grand_total,
    amountPaid: row.amount_paid,
    pendingAmount: row.pending_amount,
  };
};

const mapExpense = (row: DbExpenseRow): Expense => ({
  id: normalizeId(row.id),
  description: row.description,
  amount: row.amount,
  date: row.date,
  category: row.category,
});

const mapAppointment = (row: DbAppointmentRow): Appointment => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  patientName: row.patient_name,
  date: row.date,
  reason: row.reason,
  status: row.status,
  isUpcoming: new Date(row.date) >= new Date(new Date().setHours(0, 0, 0, 0)),
});

// Dental-specific mappers
const mapToothRecord = (row: DbToothRecordRow): ToothRecord => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  toothNumber: row.tooth_number,
  quadrant: row.quadrant,
  condition: row.condition,
  notes: row.notes,
  treatmentId: row.treatment_id ? normalizeId(row.treatment_id) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTreatmentSitting = (row: DbTreatmentSittingRow): TreatmentSitting => {
  // Parse tooth_numbers if it's a string
  let toothNumbers = row.tooth_numbers ?? [];
  if (typeof toothNumbers === "string") {
    try {
      toothNumbers = JSON.parse(toothNumbers);
    } catch (e) {
      toothNumbers = [];
    }
  }

  // Parse sitting_details if it's a string
  let sittingDetails = row.sitting_details ?? [];
  if (typeof sittingDetails === "string") {
    try {
      sittingDetails = JSON.parse(sittingDetails);
    } catch (e) {
      sittingDetails = [];
    }
  }

  return {
    id: normalizeId(row.id),
    patientId: normalizeId(row.patient_id),
    treatmentId: normalizeId(row.treatment_id),
    treatmentName: row.treatment_name,
    billId: row.bill_id ? normalizeId(row.bill_id) : undefined,
    toothNumbers: toothNumbers as number[],
    totalSittings: row.total_sittings,
    completedSittings: row.completed_sittings,
    status: row.status,
    sittingDetails: sittingDetails as SittingDetail[],
    startDate: row.start_date,
    lastVisitDate: row.last_visit_date,
    notes: row.notes,
  };
};

const mapBodyRecord = (row: DbBodyRecordRow): BodyRecord => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  bodyPart: row.body_part,
  painLevel: row.pain_level,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PostgresStorage implements IStorage {
  private ready: Promise<void>;
  private idModes: Record<EntityTable, IdMode> = {
    referrers: "numeric",
    patients: "text",
    visits: "text",
    medicines: "text",
    treatments: "text",
    bills: "text",
    expenses: "text",
    appointments: "text",
    tooth_records: "text",
    treatment_sittings: "text",
    body_records: "text",
  };
  private cache = new DataCache(60_000); // 60 second cache TTL for better performance

  constructor() {
    this.ready = (async () => {
      await ensureTables();
      this.idModes = await detectIdModes();
    })();
  }

  private async waitForReady() {
    await this.ready;
  }

  private usesNumericId(table: EntityTable): boolean {
    return this.idModes[table] === "numeric";
  }

  private convertId(table: EntityTable, id: string): string | number {
    if (!this.usesNumericId(table)) {
      return id;
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid ${table} id: ${id}`);
    }
    return numericId;
  }

  // Patients
  async initialize(): Promise<void> {
    await this.waitForReady();

    // Patients extensions
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS chief_dental_complaint TEXT;
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS dental_history TEXT;
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS habit_history TEXT;
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT;
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_dental_visit_date TEXT;
    `);

    // Treatments extensions
    await pool.query(`
      ALTER TABLE treatments ADD COLUMN IF NOT EXISTS gst_percentage DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE treatments ADD COLUMN IF NOT EXISTS number_of_sittings INTEGER DEFAULT 1;
      ALTER TABLE treatments ADD COLUMN IF NOT EXISTS category TEXT;
    `);

    // Medicines extensions
    await pool.query(`
      ALTER TABLE medicines ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Medicine';
      ALTER TABLE medicines ADD COLUMN IF NOT EXISTS expiry_date TEXT;
    `);

    // Bills extensions
    await pool.query(`
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS gst_total DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS treatment_discount DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS medicine_discount DOUBLE PRECISION DEFAULT 0;
    `);

    // Tooth Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tooth_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        tooth_number INTEGER NOT NULL,
        quadrant TEXT NOT NULL,
        condition TEXT NOT NULL,
        notes TEXT,
        treatment_id INTEGER REFERENCES treatments(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add unique constraint for UPSERT support
    try {
      await pool.query(`
            ALTER TABLE tooth_records 
            ADD CONSTRAINT tooth_records_patient_tooth_unique UNIQUE (patient_id, tooth_number);
        `);
    } catch (e: any) {
      // Ignore if constraint already exists (42710: duplicate object, 42P07: duplicate relation)
      if (e.code !== '42710' && e.code !== '42P07') {
        console.error("Error adding unique constraint:", e);
      }
    }

    // Add missing columns for tooth_records (for existing databases)
    try {
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS quadrant TEXT DEFAULT 'UR';`);
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'Healthy';`);
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS notes TEXT;`);
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS treatment_id INTEGER;`);
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
      await pool.query(`ALTER TABLE tooth_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`);
    } catch (e: any) {
      console.log("Tooth records column migration note:", e.message);
    }

    // Drop the old CHECK constraint that blocks FDI notation (tooth numbers 31-48)
    // This constraint was incorrectly limiting tooth numbers, but FDI uses 11-48 for adults
    try {
      // First, try to get all check constraints on the table
      const { rows: constraints } = await pool.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'tooth_records'::regclass 
        AND contype = 'c'
      `);
      console.log("Found check constraints on tooth_records:", constraints.map(c => c.conname));

      // Drop any tooth_number related check constraints
      for (const c of constraints) {
        if (c.conname.includes('tooth_number') || c.conname.includes('check')) {
          console.log("Dropping constraint:", c.conname);
          await pool.query(`ALTER TABLE tooth_records DROP CONSTRAINT IF EXISTS "${c.conname}";`);
        }
      }
      console.log("Cleaned up tooth_number constraints for FDI notation support");
    } catch (e: any) {
      console.error("Error dropping check constraint:", e.message);
    }

    // Treatment Sittings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS treatment_sittings (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        treatment_id INTEGER REFERENCES treatments(id),
        treatment_name TEXT NOT NULL,
        bill_id INTEGER REFERENCES bills(id),
        tooth_numbers JSONB DEFAULT '[]',
        total_sittings INTEGER NOT NULL,
        completed_sittings INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Planned',
        sitting_details JSONB DEFAULT '[]',
        start_date TEXT NOT NULL,
        last_visit_date TEXT,
        notes TEXT
      );
    `);

    // Migration: Add ALL missing columns for treatment_sittings (for existing tables)
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS tooth_numbers JSONB DEFAULT '[]';
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS sitting_details JSONB DEFAULT '[]';
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS start_date TEXT;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS last_visit_date TEXT;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS total_sittings INTEGER DEFAULT 1;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS completed_sittings INTEGER DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Planned';
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS treatment_name TEXT;
    `);
    await pool.query(`
      ALTER TABLE treatment_sittings ADD COLUMN IF NOT EXISTS bill_id INTEGER;
    `);

    // Performance Indexes
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bills_patient_id ON bills(patient_id);
        CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
        CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
        CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);
        CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
        CREATE INDEX IF NOT EXISTS idx_tooth_records_patient_id ON tooth_records(patient_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_sittings_patient_id ON treatment_sittings(patient_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_sittings_status ON treatment_sittings(status);
      `);
    } catch (e: any) {
      console.log("Index creation note:", e.message);
    }

    // Body Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS body_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        body_part TEXT NOT NULL,
        pain_level INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(patient_id, body_part)
      );
    `);
  }

  // Body Records methods
  async getBodyRecords(patientId: string): Promise<BodyRecord[]> {
    const { rows } = await pool.query<DbBodyRecordRow>(
      `SELECT * FROM body_records WHERE patient_id = $1 ORDER BY created_at DESC`,
      [this.convertId("patients", patientId)]
    );
    return rows.map(mapBodyRecord);
  }

  async createBodyRecord(record: InsertBodyRecord): Promise<BodyRecord> {
    const { rows } = await pool.query<DbBodyRecordRow>(
      `INSERT INTO body_records (patient_id, body_part, pain_level, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patient_id, body_part) 
       DO UPDATE SET pain_level = EXCLUDED.pain_level, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [
        this.convertId("patients", record.patientId),
        record.bodyPart,
        record.painLevel,
        record.notes
      ]
    );
    return mapBodyRecord(rows[0]);
  }

  async deleteBodyRecord(patientId: string, bodyPart: string): Promise<void> {
    await pool.query(
      `DELETE FROM body_records WHERE patient_id = $1 AND body_part = $2`,
      [this.convertId("patients", patientId), bodyPart]
    );
  }

  async getPatients(): Promise<Patient[]> {
    await this.waitForReady();
    const cached = this.cache.get<Patient[]>("patients");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbPatientRow>(
      `SELECT id, name, phone, registration_date, chief_dental_complaint, dental_history,
        habit_history, allergies, last_dental_visit_date, referred_by_referrer_id,
        referred_by_patient_id, referral_credit_balance, first_bill_processed
       FROM patients ORDER BY registration_date DESC`
    );
    const patients = rows.map(mapPatient);
    this.cache.set("patients", patients);
    return patients;
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `patient:${normalizedId} `;
    const cached = this.cache.get<Patient>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("patients", id);
    const { rows } = await pool.query<DbPatientRow>(
      `SELECT id, name, phone, registration_date, chief_dental_complaint, dental_history,
        habit_history, allergies, last_dental_visit_date, referred_by_referrer_id,
        referred_by_patient_id, referral_credit_balance, first_bill_processed
       FROM patients WHERE id = $1`,
      [dbId]
    );
    const patient = rows[0] ? mapPatient(rows[0]) : undefined;
    if (patient) {
      this.cache.set(cacheKey, patient);
    }
    return patient;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("patients");
    const query = useNumericId
      ? `INSERT INTO patients (name, phone, registration_date, referred_by_patient_id, referral_credit_balance, first_bill_processed, referred_by_referrer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`
      : `INSERT INTO patients (id, name, phone, registration_date, referred_by_patient_id, referral_credit_balance, first_bill_processed, referred_by_referrer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`;

    // Handle string/number conversion for referrers if using numeric IDs
    let referrerId = null;
    if (insertPatient.referredByReferrerId) {
      referrerId = this.idModes.referrers === "numeric"
        ? parseInt(insertPatient.referredByReferrerId)
        : insertPatient.referredByReferrerId;
    }

    const params = useNumericId
      ? [
        insertPatient.name,
        insertPatient.phone,
        insertPatient.registrationDate,
        insertPatient.referredByPatientId ? this.convertId("patients", insertPatient.referredByPatientId) : null,
        insertPatient.referralCreditBalance ?? 0,
        insertPatient.firstBillProcessed ?? false,
        referrerId
      ]
      : [
        randomUUID(),
        insertPatient.name,
        insertPatient.phone,
        insertPatient.registrationDate,
        insertPatient.referredByPatientId ? this.convertId("patients", insertPatient.referredByPatientId) : null,
        insertPatient.referralCreditBalance ?? 0,
        insertPatient.firstBillProcessed ?? false,
        referrerId
      ];
    const { rows } = await pool.query<DbPatientRow>(query, params);
    const patient = mapPatient(rows[0]);

    // Note: Credit is added when the referred patient's FIRST BILL is created (5% commission)

    // Note: Additional credit is added when the referred patient's FIRST BILL is created

    this.cache.invalidate("patients");
    this.cache.invalidate("patient:");
    return patient;
  }

  async updatePatient(id: string, insertPatient: InsertPatient): Promise<Patient | undefined> {
    await this.waitForReady();
    const query = `UPDATE patients
       SET name = $1, phone = $2, registration_date = $3,
           referred_by_patient_id = $4, referral_credit_balance = $5, first_bill_processed = $6,
           referred_by_referrer_id = $7
       WHERE id = $8
       RETURNING *`;

    // Handle referrer conversion
    let referrerId = null;
    if (insertPatient.referredByReferrerId) {
      referrerId = this.idModes.referrers === "numeric"
        ? parseInt(insertPatient.referredByReferrerId)
        : insertPatient.referredByReferrerId;
    }

    const { rows } = await pool.query<DbPatientRow>(
      query,
      [insertPatient.name, insertPatient.phone, insertPatient.registrationDate,
      insertPatient.referredByPatientId ? this.convertId("patients", insertPatient.referredByPatientId) : null,
      insertPatient.referralCreditBalance ?? 0,
      insertPatient.firstBillProcessed ?? false,
        referrerId,
      this.convertId("patients", id)]
    );
    const patient = rows[0] ? mapPatient(rows[0]) : undefined;
    if (patient) {
      this.cache.invalidate("patients");
      this.cache.invalidate("patient:");
    }
    return patient;
  }

  async deletePatient(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("patients", id);

    // 0. Get the patient to check for referrer
    const patient = await this.getPatient(id);

    // 1. Get all bills for this patient
    const { rows: dbBills } = await pool.query<DbBillRow>(
      "SELECT * FROM bills WHERE patient_id = $1 ORDER BY date ASC, id ASC",
      [dbId]
    );
    const patientBills = dbBills.map(mapBill);

    // **REFERRAL CREDIT SYSTEM**: Reverse credit if patient is deleted
    if (patient && patient.referredByReferrerId && patient.firstBillProcessed && patientBills.length > 0) {
      // Find the first bill (should be the first one due to ORDER BY)
      const firstBill = patientBills[0];
      const referralCredit = firstBill.grandTotal * 0.05;

      // Deduct from referrer (negative amount)
      try {
        await this.updateReferrerCredit(patient.referredByReferrerId, -referralCredit);
      } catch (err: any) {
        console.error(`Failed to deduct referral credit on patient deletion:`, err.message);
      }
    }

    // 2. Restore stock for each bill
    for (const bill of patientBills) {
      for (const med of bill.medicines) {
        if (med.medicineId && med.quantity > 0) {
          try {
            await this.updateMedicineStock(med.medicineId, med.quantity);
          } catch (e) {
            console.error(`Failed to restore stock for medicine ${med.medicineId} in bill ${bill.id} `, e);
          }
        }
      }
    }

    // 3. Delete patient (Cascade will delete bills and visits)
    const result = await pool.query("DELETE FROM patients WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;

    if (success) {
      this.cache.invalidate("patients");
      this.cache.invalidate(`patient:${normalizeId(id)} `);
      this.cache.invalidate("bills");
      this.cache.invalidate("medicines");
      this.cache.invalidate("visits");
    }

    return success;
  }

  // Referral system methods
  async getPatientReferralInfo(patientId: string): Promise<PatientReferralInfo> {
    await this.waitForReady();
    const dbId = this.convertId("patients", patientId);

    // Get patients referred by this patient
    const { rows: referredPatientsRows } = await pool.query<DbPatientRow>(
      `SELECT * FROM patients WHERE referred_by_patient_id = $1 ORDER BY registration_date DESC`,
      [dbId]
    );
    const referredPatients = referredPatientsRows.map(mapPatient);

    // Get the patient's own info to check current credit balance
    const patient = await this.getPatient(patientId);
    const availableCredit = patient?.referralCreditBalance ?? 0;

    // Get who referred this patient (if anyone)
    let referredBy: Patient | undefined = undefined;
    if (patient?.referredByPatientId) {
      referredBy = await this.getPatient(patient.referredByPatientId);
    }

    return {
      referredPatients,
      totalReferrals: referredPatients.length,
      totalCreditEarned: availableCredit,  // Since we don't track usage yet, total = available
      availableCredit,
      referredBy,
    };
  }

  async updatePatientCreditBalance(patientId: string, additionalCredit: number): Promise<Patient | undefined> {
    await this.waitForReady();
    const patient = await this.getPatient(patientId);
    if (!patient) {
      return undefined;
    }

    const newCredit = (patient.referralCreditBalance ?? 0) + additionalCredit;

    const dbId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbPatientRow>(
      `UPDATE patients 
       SET referral_credit_balance = $1
       WHERE id = $2
       RETURNING *`,
      [newCredit, dbId]
    );

    // If this patient is also a referrer, update the referrer's available credit
    const { rows: referrerRows } = await pool.query<DbReferrerRow>(
      "SELECT * FROM referrers WHERE patient_id = $1",
      [dbId]
    );

    if (referrerRows.length > 0) {
      const referrerId = referrerRows[0].id;
      // We blindly update available_credit by the same amount
      // This handles spending (negative additionalCredit) naturally
      await pool.query(
        "UPDATE referrers SET available_credit = available_credit + $1 WHERE id = $2",
        [additionalCredit, referrerId]
      );
    }

    if (rows.length > 0) {
      this.cache.invalidate("patients");
      this.cache.invalidate(`patient:${normalizeId(patientId)}`);
      return mapPatient(rows[0]);
    }
    return undefined;
  }

  // Referrer System Implementation
  async getReferrers(): Promise<Referrer[]> {
    await this.waitForReady();
    const { rows } = await pool.query<DbReferrerRow>("SELECT * FROM referrers ORDER BY name ASC");
    return rows.map(mapReferrer);
  }

  async getReferrer(id: string): Promise<Referrer | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("referrers", id);
    const { rows } = await pool.query<DbReferrerRow>("SELECT * FROM referrers WHERE id = $1", [dbId]);
    return rows.length > 0 ? mapReferrer(rows[0]) : undefined;
  }

  async createReferrer(insertReferrer: InsertReferrer): Promise<Referrer> {
    await this.waitForReady();
    const useNumericId = this.idModes.referrers === "numeric";
    const useNumericPatientId = this.idModes.patients === "numeric";

    // If linking to a patient, get patient details first
    let patientId = null;
    if (insertReferrer.isPatient && insertReferrer.patientId) {
      if (useNumericPatientId) {
        const parsed = parseInt(insertReferrer.patientId);
        patientId = isNaN(parsed) ? null : parsed;
      } else {
        patientId = insertReferrer.patientId;
      }
    }

    const query = useNumericId
      ? `INSERT INTO referrers (name, phone, is_patient, patient_id, total_credit_earned, available_credit)
         VALUES ($1, $2, $3, $4, 0, 0)
         RETURNING *`
      : `INSERT INTO referrers (id, name, phone, is_patient, patient_id, total_credit_earned, available_credit)
         VALUES ($1, $2, $3, $4, $5, 0, 0)
         RETURNING *`;

    const params = useNumericId
      ? [insertReferrer.name, insertReferrer.phone, insertReferrer.isPatient, patientId]
      : [randomUUID(), insertReferrer.name, insertReferrer.phone, insertReferrer.isPatient, patientId];

    const { rows } = await pool.query<DbReferrerRow>(query, params);
    this.cache.invalidate("referrers");
    return mapReferrer(rows[0]);
  }

  async updateReferrerCredit(referrerId: string, additionalCredit: number): Promise<Referrer | undefined> {
    await this.waitForReady();
    const referrer = await this.getReferrer(referrerId);
    if (!referrer) return undefined;

    const newTotal = additionalCredit > 0 ? (referrer.totalCreditEarned + additionalCredit) : referrer.totalCreditEarned;
    const newAvailable = referrer.availableCredit + additionalCredit;
    console.log(`[ReferralLog] Updating credit for ${referrer.name}: OldAvailable=${referrer.availableCredit}, NewAvailable=${newAvailable}`);

    const dbId = this.convertId("referrers", referrerId);
    const { rows } = await pool.query<DbReferrerRow>(
      `UPDATE referrers 
       SET total_credit_earned = $1, available_credit = $2
       WHERE id = $3
       RETURNING *`,
      [newTotal, newAvailable, dbId]
    );

    // If this referrer is linked to a patient, update the patient's credit balance too
    // This helps keep both tables in sync
    if (referrer.patientId) {
      const dbPatientId = this.convertId("patients", referrer.patientId);
      // We don't call updatePatientCreditBalance to avoid potential circular/double logic
      // Just direct update to sync
      await pool.query(
        `UPDATE patients 
         SET referral_credit_balance = COALESCE(referral_credit_balance, 0) + $1
         WHERE id = $2`,
        [additionalCredit, dbPatientId]
      );
      this.cache.invalidate(`patient:${normalizeId(referrer.patientId)}`);
    }

    this.cache.invalidate("referrers");
    this.cache.invalidate(`referrer:${normalizeId(referrerId)}`);

    return rows.length > 0 ? mapReferrer(rows[0]) : undefined;
  }

  async getReferrerStats(id: string): Promise<ReferrerStats | undefined> {
    await this.waitForReady();
    const referrer = await this.getReferrer(id);
    if (!referrer) return undefined;

    const dbId = this.convertId("referrers", id);
    const { rows: patientRows } = await pool.query<DbPatientRow>(
      "SELECT * FROM patients WHERE referred_by_referrer_id = $1 ORDER BY registration_date DESC",
      [dbId]
    );

    const referredPatients = patientRows.map(mapPatient);

    return {
      ...referrer,
      totalReferrals: referredPatients.length,
      referredPatients
    };
  }


  // Visits
  async getVisits(): Promise<Visit[]> {
    await this.waitForReady();
    const cached = this.cache.get<Visit[]>("visits:all");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbVisitRow>(
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number FROM visits ORDER BY date DESC, visit_number DESC"
    );
    const visits = rows.map(mapVisit);
    this.cache.set("visits:all", visits);
    return visits;
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    await this.waitForReady();
    const normalizedPatientId = normalizeId(patientId);
    const cacheKey = `visits: patient: ${normalizedPatientId} `;
    const cached = this.cache.get<Visit[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbVisitRow>(
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number FROM visits WHERE patient_id = $1 ORDER BY visit_number DESC",
      [dbPatientId]
    );
    const visits = rows.map(mapVisit);
    this.cache.set(cacheKey, visits);
    return visits;
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    await this.waitForReady();
    const patientIdValue = this.convertId("patients", insertVisit.patientId);
    const [{ visit_number }] = (
      await pool.query<{ visit_number: number }>(
        `SELECT COALESCE(MAX(visit_number), 0) + 1 AS visit_number
         FROM visits
         WHERE patient_id = $1`,
        [patientIdValue]
      )
    ).rows;

    const visitNumber = Number(visit_number ?? 1);
    const usesNumericVisitId = this.usesNumericId("visits");
    const insertQuery = usesNumericVisitId
      ? `INSERT INTO visits(patient_id, date, complaints, diagnosis, visit_number)
VALUES($1, $2, $3, $4, $5)
         RETURNING id, patient_id, date, complaints, diagnosis, visit_number`
      : `INSERT INTO visits(id, patient_id, date, complaints, diagnosis, visit_number)
VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, patient_id, date, complaints, diagnosis, visit_number`;
    const insertParams = usesNumericVisitId
      ? [patientIdValue, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis, visitNumber]
      : [
        randomUUID(),
        patientIdValue,
        insertVisit.date,
        insertVisit.complaints,
        insertVisit.diagnosis,
        visitNumber,
      ];
    const { rows } = await pool.query<DbVisitRow>(insertQuery, insertParams);
    const visit = mapVisit(rows[0]);
    this.cache.invalidate("visits");
    this.cache.invalidate(`visits: patient: ${normalizeId(insertVisit.patientId)
      } `);
    return visit;
  }

  async updateVisit(id: string, insertVisit: InsertVisit): Promise<Visit | undefined> {
    await this.waitForReady();
    const dbVisitId = this.convertId("visits", id);
    const { rows } = await pool.query<DbVisitRow>(
      `UPDATE visits
       SET date = $2,
  complaints = $3,
  diagnosis = $4
       WHERE id = $1
       RETURNING id, patient_id, date, complaints, diagnosis, visit_number`,
      [dbVisitId, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis]
    );
    const visit = rows[0] ? mapVisit(rows[0]) : undefined;
    if (visit) {
      this.cache.invalidate("visits");
      this.cache.invalidate(`visits: patient:${visit.patientId} `);
    }
    return visit;
  }

  // Medicines
  async getMedicines(): Promise<Medicine[]> {
    await this.waitForReady();
    const cached = this.cache.get<Medicine[]>("medicines");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbMedicineRow>(
      `SELECT id, name, purchase_cost, selling_price, quantity, category, expiry_date 
       FROM medicines ORDER BY name ASC`
    );
    const medicines = rows.map(mapMedicine);
    this.cache.set("medicines", medicines);
    return medicines;
  }

  async getMedicine(id: string): Promise<Medicine | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `medicine:${normalizedId} `;
    const cached = this.cache.get<Medicine>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      `SELECT id, name, purchase_cost, selling_price, quantity, category, expiry_date 
       FROM medicines WHERE id = $1`,
      [dbId]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.set(cacheKey, medicine);
    }
    return medicine;
  }

  async createMedicine(insertMedicine: InsertMedicine): Promise<Medicine> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("medicines");
    const query = useNumericId
      ? `INSERT INTO medicines(name, purchase_cost, selling_price, quantity, category, expiry_date)
VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, name, purchase_cost, selling_price, quantity, category, expiry_date`
      : `INSERT INTO medicines(id, name, purchase_cost, selling_price, quantity, category, expiry_date)
VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, purchase_cost, selling_price, quantity, category, expiry_date`;
    const params = useNumericId
      ? [insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity,
      insertMedicine.category || 'Medicine', insertMedicine.expiryDate || null]
      : [randomUUID(), insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity,
      insertMedicine.category || 'Medicine', insertMedicine.expiryDate || null];
    const { rows } = await pool.query<DbMedicineRow>(query, params);
    const medicine = mapMedicine(rows[0]);
    this.cache.invalidate("medicines");
    this.cache.invalidate("medicine:");
    return medicine;
  }

  async updateMedicine(id: string, insertMedicine: InsertMedicine): Promise<Medicine | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      `UPDATE medicines
       SET name = $2,
  purchase_cost = $3,
  selling_price = $4,
  quantity = $5,
  category = $6,
  expiry_date = $7
       WHERE id = $1
       RETURNING id, name, purchase_cost, selling_price, quantity, category, expiry_date`,
      [dbId, insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity,
        insertMedicine.category || 'Medicine', insertMedicine.expiryDate || null]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id} `);
    }
    return medicine;
  }

  async deleteMedicine(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const result = await pool.query("DELETE FROM medicines WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${normalizeId(id)} `);
    }
    return success;
  }

  async updateMedicineStock(id: string, quantityChange: number): Promise<Medicine | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      `UPDATE medicines
       SET quantity = GREATEST(0, quantity + $2)
       WHERE id = $1
       RETURNING id, name, purchase_cost, selling_price, quantity, category, expiry_date`,
      [dbId, quantityChange]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id} `);
    }
    return medicine;
  }

  async updateMedicineStocksBulk(updates: { id: string; quantityChange: number }[]): Promise<void> {
    if (updates.length === 0) return;
    await this.waitForReady();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // We can use a temporary table or a series of updates. 
      // For simplicity and compatibility, we'll use a series of updates within a transaction.
      // Since it's a single transaction, it's atomic.
      // To improve speed, we can perform them in parallel promises since we are inside a transaction?
      // No, node-postgres client is single-stream. We must await them or use Promise.all but they will be serialized on the wire.

      // Better approach: Update with data items
      // "UPDATE medicines as m SET quantity = GREATEST(0, m.quantity + v.change) FROM (VALUES ...) as v(id, change) WHERE m.id = v.id::bigint" (if numeric)

      const values = updates.map(u => `(${this.convertId("medicines", u.id)}, ${u.quantityChange})`).join(",");
      // Cast to correct types in VALUES clause
      const query = `
        UPDATE medicines as m 
        SET quantity = GREATEST(0, m.quantity + v.change)
FROM(VALUES ${values}) as v(id, change) 
        WHERE m.id = v.id${this.usesNumericId("medicines") ? "" : "::text"}
`;

      await client.query(query);
      await client.query("COMMIT");

      // Invalidate cache once
      this.cache.invalidate("medicines");
      for (const u of updates) {
        this.cache.invalidate(`medicine:${normalizeId(u.id)} `);
      }
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getMedicinesByIds(ids: string[]): Promise<Medicine[]> {
    if (ids.length === 0) return [];
    await this.waitForReady();

    // We can't rely on cache for mixed hits/misses easily without logic. 
    // And usually this is for validation where fresh data is preferred.
    // So we fetch specific IDs.

    // Convert IDs
    const dbIds = ids.map(id => this.convertId("medicines", id));

    const { rows } = await pool.query<DbMedicineRow>(
      `SELECT id, name, purchase_cost, selling_price, quantity, category, expiry_date 
       FROM medicines 
       WHERE id = ANY($1)`,
      [dbIds]
    );

    return rows.map(mapMedicine);
  }

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    await this.waitForReady();
    const cached = this.cache.get<Treatment[]>("treatments");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbTreatmentRow>(
      `SELECT id, name, default_price, gst_percentage, number_of_sittings, category 
       FROM treatments ORDER BY name ASC`
    );
    const treatments = rows.map(mapTreatment);
    this.cache.set("treatments", treatments);
    return treatments;
  }

  async getTreatment(id: string): Promise<Treatment | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `treatment:${normalizedId} `;
    const cached = this.cache.get<Treatment>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("treatments", id);
    const { rows } = await pool.query<DbTreatmentRow>(
      `SELECT id, name, default_price, gst_percentage, number_of_sittings, category 
       FROM treatments WHERE id = $1`,
      [dbId]
    );
    const treatment = rows[0] ? mapTreatment(rows[0]) : undefined;
    if (treatment) {
      this.cache.set(cacheKey, treatment);
    }
    return treatment;
  }

  async getTreatmentByName(name: string): Promise<Treatment | undefined> {
    await this.waitForReady();
    const query = this.usesNumericId("treatments")
      ? `SELECT id, name, default_price, gst_percentage, number_of_sittings, category FROM treatments WHERE name = $1`
      : `SELECT id, name, default_price, gst_percentage, number_of_sittings, category FROM treatments WHERE name = $1`;
    const { rows } = await pool.query<DbTreatmentRow>(query, [name]);
    return rows.length > 0 ? mapTreatment(rows[0]) : undefined;
  }

  async createTreatment(insertTreatment: InsertTreatment): Promise<Treatment> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("treatments");
    const query = useNumericId
      ? `INSERT INTO treatments(name, default_price, gst_percentage, number_of_sittings, category)
VALUES($1, $2, $3, $4, $5)
         RETURNING id, name, default_price, gst_percentage, number_of_sittings, category`
      : `INSERT INTO treatments(id, name, default_price, gst_percentage, number_of_sittings, category)
VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, name, default_price, gst_percentage, number_of_sittings, category`;
    const params = useNumericId
      ? [insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.gstPercentage || 0,
      insertTreatment.numberOfSittings ?? 0, insertTreatment.category || null]
      : [randomUUID(), insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.gstPercentage || 0,
      insertTreatment.numberOfSittings ?? 0, insertTreatment.category || null];
    const { rows } = await pool.query<DbTreatmentRow>(query, params);
    const treatment = mapTreatment(rows[0]);
    this.cache.invalidate("treatments");
    this.cache.invalidate("treatment:");
    return treatment;
  }

  async updateTreatment(id: string, insertTreatment: InsertTreatment): Promise<Treatment | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("treatments", id);
    const { rows } = await pool.query<DbTreatmentRow>(
      `UPDATE treatments
       SET name = $2, default_price = $3, gst_percentage = $4, number_of_sittings = $5, category = $6
       WHERE id = $1
       RETURNING id, name, default_price, gst_percentage, number_of_sittings, category`,
      [dbId, insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.gstPercentage || 0,
        insertTreatment.numberOfSittings ?? 0, insertTreatment.category || null]
    );
    const treatment = rows[0] ? mapTreatment(rows[0]) : undefined;
    if (treatment) {
      this.cache.invalidate("treatments");
      this.cache.invalidate(`treatment:${treatment.id} `);
    }
    return treatment;
  }

  async deleteTreatment(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("treatments", id);

    // Check for usage in tooth_records
    const { rows: toothUsage } = await pool.query(
      "SELECT 1 FROM tooth_records WHERE treatment_id = $1 LIMIT 1",
      [dbId]
    );
    if (toothUsage.length > 0) {
      throw new Error("Cannot delete treatment because it is assigned to patient tooth records.");
    }

    // Check for usage in treatment_sittings
    const { rows: sittingUsage } = await pool.query(
      "SELECT 1 FROM treatment_sittings WHERE treatment_id = $1 LIMIT 1",
      [dbId]
    );
    if (sittingUsage.length > 0) {
      throw new Error("Cannot delete treatment because it is part of existing treatment plans.");
    }

    const result = await pool.query("DELETE FROM treatments WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("treatments");
      this.cache.invalidate(`treatment:${normalizeId(id)} `);
    }
    return success;
  }


  // Bills
  async getBills(): Promise<Bill[]> {
    await this.waitForReady();
    const cached = this.cache.get<Bill[]>("bills");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount
       FROM bills
       ORDER BY date DESC`
    );
    const bills = rows.map(mapBill);
    this.cache.set("bills", bills);
    return bills;
  }

  async getBill(id: string): Promise<Bill | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `bill:${normalizedId} `;
    const cached = this.cache.get<Bill>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("bills", id);
    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount
       FROM bills
       WHERE id = $1`,
      [dbId]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      this.cache.set(cacheKey, bill);
    }
    return bill;
  }

  async createBill(insertBill: InsertBill, patientName: string): Promise<Bill> {
    await this.waitForReady();
    try {
      const patientIdValue = this.convertId("patients", insertBill.patientId);
      const pendingAmount = Math.max(0, insertBill.grandTotal - insertBill.amountPaid);
      const useNumericId = this.usesNumericId("bills");
      const query = useNumericId
        ? `INSERT INTO bills(
    patient_id,
    patient_name,
    date,
    treatments,
    medicines,
    treatment_total,
    medicine_total,
    grand_total,
    amount_paid,
    pending_amount
  )
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`
        : `INSERT INTO bills(
    id,
    patient_id,
    patient_name,
    date,
    treatments,
    medicines,
    treatment_total,
    medicine_total,
    grand_total,
    amount_paid,
    pending_amount
  )
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`;
      const params = useNumericId
        ? [
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(insertBill.treatments || []),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.amountPaid,
          pendingAmount,
        ]
        : [
          randomUUID(),
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(insertBill.treatments || []),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.amountPaid,
          pendingAmount,
        ];
      const { rows } = await pool.query<DbBillRow>(query, params);
      if (!rows[0]) {
        throw new Error("Failed to create bill - no rows returned");
      }
      const bill = mapBill(rows[0]);

      // **REFERRAL CREDIT SYSTEM - PART 1**: Award credit to referrer if this is the first bill
      const patient = await this.getPatient(insertBill.patientId);

      // Check for Enhanced Referrer first
      if (patient && patient.referredByReferrerId && !patient.firstBillProcessed) {
        // Calculate 5% of the grand total as referral credit
        const referralCredit = insertBill.grandTotal * 0.05;

        // Add credit to the REFERRER (this will sync to patient record if applicable)
        await this.updateReferrerCredit(patient.referredByReferrerId, referralCredit);

        // Mark this patient's first bill as processed
        const dbPatientId = this.convertId("patients", insertBill.patientId);
        await pool.query(
          `UPDATE patients SET first_bill_processed = TRUE WHERE id = $1`,
          [dbPatientId]
        );

        this.cache.invalidate("patients");
        this.cache.invalidate(`patient:${normalizeId(insertBill.patientId)}`);
      }
      // Fallback to legacy patient referral if no modern referrer is set
      else if (patient && patient.referredByPatientId && !patient.firstBillProcessed) {
        // Calculate 5% of the grand total as referral credit
        const referralCredit = insertBill.grandTotal * 0.05;

        // Add credit to the referring patient
        await this.updatePatientCreditBalance(patient.referredByPatientId, referralCredit);

        // Mark this patient's first bill as processed
        const dbPatientId = this.convertId("patients", insertBill.patientId);
        await pool.query(
          `UPDATE patients SET first_bill_processed = TRUE WHERE id = $1`,
          [dbPatientId]
        );

        // Invalidate patient cache
        this.cache.invalidate("patients");
        this.cache.invalidate(`patient:${normalizeId(insertBill.patientId)}`);
      }

      // **REFERRAL CREDIT SYSTEM - PART 2**: Deduct credit from current patient if they used it
      if (patient && patient.referralCreditBalance && patient.referralCreditBalance > 0) {
        // Calculate how much credit was applied to this bill
        // The frontend calculates: creditToApply = Math.min(availableCredit, subtotal)
        // We need to reconstruct the subtotal to determine credit used
        const subtotal = insertBill.treatmentTotal + insertBill.medicineTotal;
        const creditUsed = Math.min(patient.referralCreditBalance, subtotal);

        // Only deduct if credit was actually applied (grandTotal < subtotal)
        if (insertBill.grandTotal < subtotal) {
          await this.updatePatientCreditBalance(insertBill.patientId, -creditUsed);
        }
      }

      this.cache.invalidate("bills");
      this.cache.invalidate("bill:");
      return bill;
    } catch (error) {
      console.error("Error in createBill:", error);
      throw error;
    }
  }

  async updateBill(id: string, insertBill: InsertBill, patientName: string): Promise<Bill | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const pendingAmount = Math.max(0, insertBill.grandTotal - insertBill.amountPaid);
    const { rows } = await pool.query<DbBillRow>(
      `UPDATE bills
       SET patient_id = $2,
  patient_name = $3,
  date = $4,
  treatments = $5,
  medicines = $6,
  treatment_total = $7,
  medicine_total = $8,
  grand_total = $9,
  amount_paid = $10,
  pending_amount = $11
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`,
      [
        dbId,
        this.convertId("patients", insertBill.patientId),
        patientName,
        insertBill.date,
        JSON.stringify(insertBill.treatments),
        JSON.stringify(insertBill.medicines),
        insertBill.treatmentTotal,
        insertBill.medicineTotal,
        insertBill.grandTotal,
        insertBill.amountPaid,
        pendingAmount,
      ]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${bill.id} `);
    }
    return bill;
  }

  async updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const { rows } = await pool.query<DbBillRow>(
      `UPDATE bills
       SET amount_paid = $2,
  pending_amount = GREATEST(0, grand_total - $2)
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`,
      [dbId, amountPaid]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${bill.id} `);
    }
    return bill;
  }

  async deleteBill(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);

    // **REFERRAL CREDIT SYSTEM**: Reverse credit if the FIRST bill is deleted
    try {
      const bill = await this.getBill(id);
      if (bill) {
        const patient = await this.getPatient(bill.patientId);
        if (patient && patient.firstBillProcessed && patient.referredByReferrerId) {
          // Check if this is the first bill
          const { rows: otherBills } = await pool.query<DbBillRow>(
            "SELECT id FROM bills WHERE patient_id = $1 ORDER BY date ASC, id ASC LIMIT 1",
            [this.convertId("patients", bill.patientId)]
          );

          if (otherBills.length > 0 && otherBills[0].id.toString() === dbId.toString()) {
            // This is the first bill! Reverse credit.
            const referralCredit = bill.grandTotal * 0.05;
            await this.updateReferrerCredit(patient.referredByReferrerId, -referralCredit);

            // Reset first_bill_processed flag
            await pool.query(
              "UPDATE patients SET first_bill_processed = false WHERE id = $1",
              [this.convertId("patients", bill.patientId)]
            );
            this.cache.invalidate("patients");
            this.cache.invalidate("patient:");
          }
        }
      }
    } catch (err: any) {
      console.error("Error reversing referral credit in deleteBill:", err.message);
    }

    const result = await pool.query("DELETE FROM bills WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${normalizeId(id)} `);
    }
    return success;
  }

  async updatePatientBillsName(patientId: string, patientName: string): Promise<void> {
    await this.waitForReady();
    const dbPatientId = this.convertId("patients", patientId);
    await pool.query(
      "UPDATE bills SET patient_name = $1 WHERE patient_id = $2",
      [patientName, dbPatientId]
    );
    this.cache.invalidate("bills");
    this.cache.invalidate("bill:");
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    await this.waitForReady();
    const cached = this.cache.get<Expense[]>("expenses");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbExpenseRow>(
      "SELECT id, description, amount, date, category FROM expenses ORDER BY date DESC"
    );
    const expenses = rows.map(mapExpense);
    this.cache.set("expenses", expenses);
    return expenses;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `expense:${normalizedId} `;
    const cached = this.cache.get<Expense>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("expenses", id);
    const { rows } = await pool.query<DbExpenseRow>(
      "SELECT id, description, amount, date, category FROM expenses WHERE id = $1",
      [dbId]
    );
    const expense = rows[0] ? mapExpense(rows[0]) : undefined;
    if (expense) {
      this.cache.set(cacheKey, expense);
    }
    return expense;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("expenses");
    const query = useNumericId
      ? `INSERT INTO expenses(description, amount, date, category)
VALUES($1, $2, $3, $4)
         RETURNING id, description, amount, date, category`
      : `INSERT INTO expenses(id, description, amount, date, category)
VALUES($1, $2, $3, $4, $5)
         RETURNING id, description, amount, date, category`;
    const params = useNumericId
      ? [insertExpense.description, insertExpense.amount, insertExpense.date, insertExpense.category]
      : [
        randomUUID(),
        insertExpense.description,
        insertExpense.amount,
        insertExpense.date,
        insertExpense.category,
      ];
    const { rows } = await pool.query<DbExpenseRow>(query, params);
    const expense = mapExpense(rows[0]);
    this.cache.invalidate("expenses");
    this.cache.invalidate("expense:");
    return expense;
  }

  async updateExpense(id: string, insertExpense: InsertExpense): Promise<Expense | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("expenses", id);
    const { rows } = await pool.query<DbExpenseRow>(
      `UPDATE expenses
       SET description = $2,
  amount = $3,
  date = $4,
  category = $5
       WHERE id = $1
       RETURNING id, description, amount, date, category`,
      [dbId, insertExpense.description, insertExpense.amount, insertExpense.date, insertExpense.category]
    );
    const expense = rows[0] ? mapExpense(rows[0]) : undefined;
    if (expense) {
      this.cache.invalidate("expenses");
      this.cache.invalidate(`expense:${expense.id} `);
    }
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("expenses", id);
    const result = await pool.query("DELETE FROM expenses WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("expenses");
      this.cache.invalidate(`expense:${normalizeId(id)} `);
    }
    return success;
  }

  // ==================== PAGINATION METHODS ====================

  /**
   * Get paginated patients with optional search
   * 
   * SQL Pattern:
   *   -- Count query (for pagination info)
   *   SELECT COUNT(*) FROM patients WHERE name ILIKE '%search%' OR phone ILIKE '%search%'
   *   
   *   -- Data query (for current page)
   *   SELECT * FROM patients 
   *   WHERE name ILIKE '%search%' OR phone ILIKE '%search%'
   *   ORDER BY registration_date DESC
   *   LIMIT 20 OFFSET 40  -- Page 3, 20 items per page
   * 
   * @param page - Page number (1-indexed)
   * @param limit - Number of records per page (default: 20)
   * @param search - Optional search term for name/phone (case-insensitive)
   * @returns { data: Patient[], total: number, page: number, limit: number }
   */
  async getPatientsPaginated(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<{ data: Patient[]; total: number; page: number; limit: number }> {
    await this.waitForReady();

    // Calculate offset: page 1 = offset 0, page 2 = offset 20, etc.
    const offset = (page - 1) * limit;

    // Build WHERE clause dynamically based on search parameter
    let whereClause = "";
    const params: (string | number)[] = [];

    if (search && search.trim()) {
      // ILIKE for case-insensitive search in PostgreSQL
      whereClause = "WHERE name ILIKE $1 OR phone ILIKE $1";
      params.push(`% ${search.trim()}% `);
    }

    // First query: Get total count for pagination info
    const countQuery = `SELECT COUNT(*) as count FROM patients ${whereClause} `;
    const { rows: countResult } = await pool.query<{ count: string }>(countQuery, params);
    const total = parseInt(countResult[0]?.count || "0", 10);

    // Second query: Get paginated data with dynamic parameter positions
    const dataParams = search && search.trim()
      ? [`% ${search.trim()}% `, limit, offset]
      : [limit, offset];
    const limitParam = search && search.trim() ? "$2" : "$1";
    const offsetParam = search && search.trim() ? "$3" : "$2";

    const { rows } = await pool.query<DbPatientRow>(
      `SELECT id, name, phone, registration_date, chief_dental_complaint, dental_history,
        habit_history, allergies, last_dental_visit_date, referred_by_referrer_id,
        referred_by_patient_id, referral_credit_balance, first_bill_processed
       FROM patients ${whereClause}
       ORDER BY registration_date DESC 
       LIMIT ${limitParam} OFFSET ${offsetParam} `,
      dataParams
    );
    const data = rows.map(mapPatient);
    return { data, total, page, limit };
  }

  /**
   * Get total patient count (cached for 60 seconds)
   * 
   * SQL: SELECT COUNT(*) FROM patients
   */
  async getPatientsCount(): Promise<number> {
    await this.waitForReady();
    const cacheKey = "patients:count";
    const cached = this.cache.get<number>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*) as count FROM patients");
    const count = parseInt(rows[0]?.count || "0", 10);
    this.cache.set(cacheKey, count);
    return count;
  }

  async getTodaysPatientsCount(): Promise<number> {
    await this.waitForReady();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const cacheKey = `patients: today:${today} `;
    const cached = this.cache.get<number>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const { rows } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM patients WHERE registration_date = $1",
      [today]
    );
    const count = parseInt(rows[0]?.count || "0", 10);
    this.cache.set(cacheKey, count);
    return count;
  }

  async getMedicinesPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Medicine[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM medicines"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbMedicineRow>(
      `SELECT id, name, purchase_cost, selling_price, quantity FROM medicines 
       ORDER BY name ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapMedicine);
    return { data, total };
  }

  async getTreatmentsPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Treatment[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM treatments"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbTreatmentRow>(
      `SELECT id, name, default_price, gst_percentage, number_of_sittings, category 
       FROM treatments 
       ORDER BY name ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapTreatment);
    return { data, total };
  }

  async getBillsPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Bill[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM bills"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
  treatment_total, medicine_total, grand_total, amount_paid, pending_amount
       FROM bills
       ORDER BY date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapBill);
    return { data, total };
  }

  async getExpensesPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Expense[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM expenses"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbExpenseRow>(
      `SELECT id, description, amount, date, category FROM expenses 
       ORDER BY date DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapExpense);
    return { data, total };
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    await this.waitForReady();
    const cached = this.cache.get<Appointment[]>("appointments");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.reason, a.status 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       ORDER BY a.date ASC`
    );
    const appointments = rows.map(mapAppointment);
    this.cache.set("appointments", appointments);
    return appointments;
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `appointment:${normalizedId} `;
    const cached = this.cache.get<Appointment>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("appointments", id);
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.reason, a.status 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [dbId]
    );
    const appointment = rows[0] ? mapAppointment(rows[0]) : undefined;
    if (appointment) {
      this.cache.set(cacheKey, appointment);
    }
    return appointment;
  }

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    await this.waitForReady();
    const normalizedPatientId = normalizeId(patientId);
    const cacheKey = `appointments: patient:${normalizedPatientId} `;
    const cached = this.cache.get<Appointment[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.reason, a.status 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.patient_id = $1
       ORDER BY a.date ASC`,
      [dbPatientId]
    );
    const appointments = rows.map(mapAppointment);
    this.cache.set(cacheKey, appointments);
    return appointments;
  }

  async createAppointment(insert: InsertAppointment): Promise<Appointment> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("appointments");
    const query = useNumericId
      ? `INSERT INTO appointments(patient_id, date, reason, status)
VALUES($1, $2, $3, $4)
         RETURNING id, patient_id, date, reason, status`
      : `INSERT INTO appointments(id, patient_id, date, reason, status)
VALUES($1, $2, $3, $4, $5)
         RETURNING id, patient_id, date, reason, status`;

    const dbPatientId = this.convertId("patients", insert.patientId);

    const params = useNumericId
      ? [dbPatientId, insert.date, insert.reason, insert.status]
      : [randomUUID(), dbPatientId, insert.date, insert.reason, insert.status];

    const { rows } = await pool.query<DbAppointmentRow>(query, params);

    // Fetch patient name for the return object
    const patientNameQuery = await pool.query<{ name: string }>("SELECT name FROM patients WHERE id = $1", [dbPatientId]);
    const patientName = patientNameQuery.rows[0]?.name;

    const appointment = mapAppointment({
      ...rows[0],
      patient_name: patientName
    });

    this.cache.invalidate("appointments");
    this.cache.invalidate(`appointments: patient:${normalizeId(insert.patientId)} `);
    return appointment;
  }

  async updateAppointment(id: string, insert: InsertAppointment): Promise<Appointment | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("appointments", id);
    const dbPatientId = this.convertId("patients", insert.patientId);

    const { rows } = await pool.query<DbAppointmentRow>(
      `UPDATE appointments
       SET patient_id = $2, date = $3, reason = $4, status = $5
       WHERE id = $1
       RETURNING id, patient_id, date, reason, status`,
      [dbId, dbPatientId, insert.date, insert.reason, insert.status]
    );

    if (!rows[0]) return undefined;

    // Fetch patient name
    const patientNameQuery = await pool.query<{ name: string }>("SELECT name FROM patients WHERE id = $1", [dbPatientId]);
    const patientName = patientNameQuery.rows[0]?.name;

    const appointment = mapAppointment({
      ...rows[0],
      patient_name: patientName
    });

    this.cache.invalidate("appointments");
    this.cache.invalidate(`appointment:${appointment.id} `);
    this.cache.invalidate(`appointments: patient:${normalizeId(insert.patientId)} `);
    return appointment;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("appointments", id);

    // Get appointment to invalidate cache
    const appt = await this.getAppointment(id);

    const result = await pool.query("DELETE FROM appointments WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;

    if (success) {
      this.cache.invalidate("appointments");
      this.cache.invalidate(`appointment:${normalizeId(id)} `);
      if (appt) {
        this.cache.invalidate(`appointments: patient:${appt.patientId} `);
      }
    }
    return success;
  }

  // Users/Auth
  // Authentication methods removed

  // ==================== TOOTH RECORDS (Dental Chart) ====================

  async getToothRecords(patientId: string): Promise<ToothRecord[]> {
    await this.waitForReady();
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbToothRecordRow>(
      `SELECT id, patient_id, tooth_number, quadrant, condition, notes, treatment_id,
  created_at, updated_at 
       FROM tooth_records 
       WHERE patient_id = $1 
       ORDER BY tooth_number ASC`,
      [dbPatientId]
    );
    return rows.map(mapToothRecord);
  }

  async getToothRecord(id: string): Promise<ToothRecord | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("tooth_records", id);
    const { rows } = await pool.query<DbToothRecordRow>(
      `SELECT id, patient_id, tooth_number, quadrant, condition, notes, treatment_id,
  created_at, updated_at 
       FROM tooth_records 
       WHERE id = $1`,
      [dbId]
    );
    return rows[0] ? mapToothRecord(rows[0]) : undefined;
  }

  async createToothRecord(record: InsertToothRecord): Promise<ToothRecord> {
    await this.waitForReady();
    const patientIdValue = this.convertId("patients", record.patientId);
    const treatmentIdValue = record.treatmentId ? this.convertId("treatments", record.treatmentId) : null;

    const useNumericId = this.usesNumericId("tooth_records");
    const query = useNumericId
      ? `INSERT INTO tooth_records(patient_id, tooth_number, quadrant, condition, notes, treatment_id)
VALUES($1, $2, $3, $4, $5, $6)
         ON CONFLICT(patient_id, tooth_number) 
         DO UPDATE SET condition = EXCLUDED.condition, notes = EXCLUDED.notes, updated_at = NOW()
         RETURNING id, patient_id, tooth_number, quadrant, condition, notes, treatment_id, created_at, updated_at`
      : `INSERT INTO tooth_records(id, patient_id, tooth_number, quadrant, condition, notes, treatment_id)
VALUES($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(patient_id, tooth_number) 
         DO UPDATE SET condition = EXCLUDED.condition, notes = EXCLUDED.notes, updated_at = NOW()
         RETURNING id, patient_id, tooth_number, quadrant, condition, notes, treatment_id, created_at, updated_at`;

    const params = useNumericId
      ? [patientIdValue, record.toothNumber, record.quadrant, record.condition, record.notes || null, treatmentIdValue]
      : [randomUUID(), patientIdValue, record.toothNumber, record.quadrant, record.condition, record.notes || null, treatmentIdValue];

    const { rows } = await pool.query<DbToothRecordRow>(query, params);
    return mapToothRecord(rows[0]);
  }

  async updateToothRecord(id: string, record: InsertToothRecord): Promise<ToothRecord | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("tooth_records", id);
    const treatmentIdValue = record.treatmentId ? this.convertId("treatments", record.treatmentId) : null;

    const { rows } = await pool.query<DbToothRecordRow>(
      `UPDATE tooth_records 
       SET tooth_number = $2, quadrant = $3, condition = $4, notes = $5, treatment_id = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, patient_id, tooth_number, quadrant, condition, notes, treatment_id, created_at, updated_at`,
      [dbId, record.toothNumber, record.quadrant, record.condition, record.notes || null, treatmentIdValue]
    );
    return rows[0] ? mapToothRecord(rows[0]) : undefined;
  }

  async deleteToothRecord(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("tooth_records", id);
    const result = await pool.query("DELETE FROM tooth_records WHERE id = $1", [dbId]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== TREATMENT SITTINGS (Multi-sitting workflow) ====================

  async getTreatmentSittings(patientId: string): Promise<TreatmentSitting[]> {
    await this.waitForReady();
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbTreatmentSittingRow>(
      `SELECT id, patient_id, treatment_id, treatment_name, bill_id, tooth_numbers,
  total_sittings, completed_sittings, status, sitting_details,
  start_date, last_visit_date, notes
       FROM treatment_sittings 
       WHERE patient_id = $1 
       ORDER BY start_date DESC`,
      [dbPatientId]
    );
    return rows.map(mapTreatmentSitting);
  }

  async getTreatmentSitting(id: string): Promise<TreatmentSitting | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("treatment_sittings", id);
    const { rows } = await pool.query<DbTreatmentSittingRow>(
      `SELECT id, patient_id, treatment_id, treatment_name, bill_id, tooth_numbers,
  total_sittings, completed_sittings, status, sitting_details,
  start_date, last_visit_date, notes
       FROM treatment_sittings 
       WHERE id = $1`,
      [dbId]
    );
    return rows[0] ? mapTreatmentSitting(rows[0]) : undefined;
  }

  async createTreatmentSitting(sitting: InsertTreatmentSitting): Promise<TreatmentSitting> {
    await this.waitForReady();
    const patientIdValue = this.convertId("patients", sitting.patientId);
    const treatmentIdValue = this.convertId("treatments", sitting.treatmentId);
    const billIdValue = sitting.billId ? this.convertId("bills", sitting.billId) : null;

    const useNumericId = this.usesNumericId("treatment_sittings");
    const query = useNumericId
      ? `INSERT INTO treatment_sittings
  (patient_id, treatment_id, treatment_name, bill_id, tooth_numbers, total_sittings,
    completed_sittings, status, sitting_details, start_date, last_visit_date, notes)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING * `
      : `INSERT INTO treatment_sittings
  (id, patient_id, treatment_id, treatment_name, bill_id, tooth_numbers, total_sittings,
    completed_sittings, status, sitting_details, start_date, last_visit_date, notes)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING * `;

    const params = useNumericId
      ? [patientIdValue, treatmentIdValue, sitting.treatmentName, billIdValue,
        JSON.stringify(sitting.toothNumbers), sitting.totalSittings, sitting.completedSittings,
        sitting.status, JSON.stringify(sitting.sittingDetails), sitting.startDate,
        sitting.lastVisitDate || null, sitting.notes || null]
      : [randomUUID(), patientIdValue, treatmentIdValue, sitting.treatmentName, billIdValue,
      JSON.stringify(sitting.toothNumbers), sitting.totalSittings, sitting.completedSittings,
      sitting.status, JSON.stringify(sitting.sittingDetails), sitting.startDate,
      sitting.lastVisitDate || null, sitting.notes || null];

    const { rows } = await pool.query<DbTreatmentSittingRow>(query, params);
    return mapTreatmentSitting(rows[0]);
  }

  async updateTreatmentSitting(id: string, sitting: UpdateTreatmentSitting): Promise<TreatmentSitting | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("treatment_sittings", id);

    // First, get the existing sitting to merge with updates
    const existing = await this.getTreatmentSitting(id);
    if (!existing) return undefined;

    // Merge existing with updates
    const merged = {
      treatmentName: sitting.treatmentName ?? existing.treatmentName,
      billId: sitting.billId !== undefined ? sitting.billId : existing.billId,
      toothNumbers: sitting.toothNumbers ?? existing.toothNumbers,
      totalSittings: sitting.totalSittings ?? existing.totalSittings,
      completedSittings: sitting.completedSittings ?? existing.completedSittings,
      status: sitting.status ?? existing.status,
      sittingDetails: sitting.sittingDetails ?? existing.sittingDetails,
      lastVisitDate: sitting.lastVisitDate !== undefined ? sitting.lastVisitDate : existing.lastVisitDate,
      notes: sitting.notes !== undefined ? sitting.notes : existing.notes,
    };

    const billIdValue = merged.billId ? this.convertId("bills", merged.billId) : null;

    const { rows } = await pool.query<DbTreatmentSittingRow>(
      `UPDATE treatment_sittings 
       SET treatment_name = $2, bill_id = $3, tooth_numbers = $4, total_sittings = $5,
  completed_sittings = $6, status = $7, sitting_details = $8,
  last_visit_date = $9, notes = $10
       WHERE id = $1
RETURNING * `,
      [dbId, merged.treatmentName, billIdValue, JSON.stringify(merged.toothNumbers),
        merged.totalSittings, merged.completedSittings, merged.status,
        JSON.stringify(merged.sittingDetails), merged.lastVisitDate || null, merged.notes || null]
    );
    return rows[0] ? mapTreatmentSitting(rows[0]) : undefined;
  }

  async deleteTreatmentSitting(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("treatment_sittings", id);
    const result = await pool.query("DELETE FROM treatment_sittings WHERE id = $1", [dbId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getPendingSittings(): Promise<TreatmentSitting[]> {
    await this.waitForReady();
    const { rows } = await pool.query<DbTreatmentSittingRow>(
      `SELECT id, patient_id, treatment_id, treatment_name, bill_id, tooth_numbers,
  total_sittings, completed_sittings, status, sitting_details,
  start_date, last_visit_date, notes
       FROM treatment_sittings 
       WHERE status IN('Planned', 'InProgress')
       ORDER BY start_date ASC`
    );
    return rows.map(mapTreatmentSitting);
  }
}

export const storage = new PostgresStorage();

