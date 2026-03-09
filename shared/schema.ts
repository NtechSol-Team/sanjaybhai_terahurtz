import { z } from "zod";

// User Schema
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Patient Schema
export interface Patient {
  id: string;
  name: string;
  phone: string;
  registrationDate: string;
  // Referral system fields
  referredByPatientId?: string;  // ID of patient who referred this one (legacy - being migrated to referrers)
  referredByReferrerId?: string;  // ID of referrer (patient or non-patient) who referred this one
  referralCreditBalance?: number;  // Money earned from referrals (can be used to pay bills)
  firstBillProcessed?: boolean;  // Track if this patient's first bill has rewarded the referrer
}

export const insertPatientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  registrationDate: z.string(),
  // Referral system
  referredByPatientId: z.string().optional(),  // Legacy field
  referredByReferrerId: z.string().optional(),  // New referrer-based system
  referralCreditBalance: z.number().optional(),
  firstBillProcessed: z.boolean().optional(),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;

// Referrer System - supports both patient and non-patient referrers
export interface Referrer {
  id: string;
  name: string;
  phone?: string;
  isPatient: boolean;  // true if this referrer is also a patient
  patientId?: string;  // link to patient record if applicable
  totalCreditEarned: number;
  availableCredit: number;
  createdAt: string;
}

export const insertReferrerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  isPatient: z.boolean().default(false),
  patientId: z.string().optional(),
});

export type InsertReferrer = z.infer<typeof insertReferrerSchema>;

export interface ReferrerStats extends Referrer {
  totalReferrals: number;
  referredPatients: Patient[];
}


// Referral system support
export interface PatientReferralInfo {
  referredPatients: Patient[];  // Patients referred by this patient
  totalReferrals: number;
  totalCreditEarned: number;  // Total credit earned from referrals
  availableCredit: number;  // Current available credit balance
  referredBy?: Patient;  // The patient who referred this one (if any)
}

// Visit Schema
export interface Visit {
  id: string;
  patientId: string;
  date: string;
  complaints: string;
  diagnosis: string;
  visitNumber: number;
}

export const insertVisitSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  complaints: z.string().min(1, "Complaints are required"),
  diagnosis: z.string().optional(),
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;

// Medicine Schema - Extended for Dental Inventory
export interface Medicine {
  id: string;
  name: string;
  purchaseCost: number;
  sellingPrice: number;
  quantity: number;
  // Dental-specific fields
  category?: string; // "Dental Material", "Consumable", "Medicine"
  expiryDate?: string;
}

export const insertMedicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  purchaseCost: z.number().min(0, "Purchase cost must be positive"),
  sellingPrice: z.number().min(0, "Selling price must be positive"),
  quantity: z.number().min(0, "Quantity must be positive"),
  category: z.string().optional().default("Medicine"),
  expiryDate: z.string().optional(),
});

export type InsertMedicine = z.infer<typeof insertMedicineSchema>;

// Treatment Schema - Extended for Dental Procedures
export interface Treatment {
  id: string;
  name: string;
  defaultPrice: number;
  // Dental-specific fields
  gstPercentage: number;
  numberOfSittings: number;
  category?: string; // "Preventive", "Restorative", "Surgical", "Orthodontic", "Prosthodontic"
}

export const insertTreatmentSchema = z.object({
  name: z.string().min(1, "Treatment name is required"),
  defaultPrice: z.number().min(0, "Price must be positive"),
  gstPercentage: z.number().min(0).max(28).default(0),
  numberOfSittings: z.number().min(0).optional().default(0),
  category: z.string().optional(),
});

export type InsertTreatment = z.infer<typeof insertTreatmentSchema>;

// Bill Item for medicines in a bill
export interface BillMedicineItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // Percentage
  total: number;
}

// Bill Item for treatments in a bill - Extended for Dental
export interface BillTreatmentItem {
  treatmentId: string;
  treatmentName: string;
  price: number;
  // Dental-specific fields
  toothNumbers?: number[]; // Which teeth for this treatment
  discount?: number; // Percentage
  gstPercentage?: number;
  gstAmount?: number;
  sittingId?: string; // Link to treatment sitting
}

// Bill Schema - Extended for Dental
export interface Bill {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  treatments: BillTreatmentItem[];
  medicines: BillMedicineItem[];
  treatmentTotal: number;
  medicineTotal: number;
  treatmentDiscount?: number; // Percentage
  medicineDiscount?: number; // Percentage
  gstTotal: number; // Total GST amount
  grandTotal: number;
  amountPaid: number;
  pendingAmount: number;
}

export const insertBillSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  date: z.string(),
  treatments: z.array(z.object({
    treatmentId: z.string(),
    treatmentName: z.string(),
    price: z.number(),
    discount: z.number().min(0).max(100).optional().default(0),
  })),
  medicines: z.array(z.object({
    medicineId: z.string(),
    medicineName: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).max(100).optional().default(0),
    total: z.number(),
  })),
  treatmentTotal: z.number(),
  medicineTotal: z.number(),
  treatmentDiscount: z.number().min(0).max(100).optional(),
  medicineDiscount: z.number().min(0).max(100).optional(),
  gstTotal: z.number().default(0),
  grandTotal: z.number(),
  amountPaid: z.number().min(0),
});

export type InsertBill = z.infer<typeof insertBillSchema>;

// Expense Schema
export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export const insertExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0, "Amount must be positive"),
  date: z.string(),
  category: z.string().min(1, "Category is required"),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Payment adjustment schema
export const paymentAdjustmentSchema = z.object({
  billId: z.string(),
  amountPaid: z.number().min(0),
});

export type PaymentAdjustment = z.infer<typeof paymentAdjustmentSchema>;

// Report types
export interface MonthlyReport {
  month: string;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  treatmentRevenue: number;
  medicineRevenue: number;
  medicineProfit: number;
}

export interface MedicineReport {
  medicineId: string;
  medicineName: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

// Pagination Schema
export const paginationSchema = z.object({
  // Increase default and maximum limits to allow larger page sizes when needed.
  // Be cautious: very large limits can increase DB load; use sensible bounds for your workload.
  limit: z.coerce.number().int().positive().max(1000).default(1000),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Appointment Schema
export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string; // Optional, for display purposes
  date: string;
  reason: string;
  status: string; // "Scheduled", "Completed", "Cancelled"
  isUpcoming: boolean; // Computed or stored
}

export const insertAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  reason: z.string().optional().default(""),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// ==================== DENTAL-SPECIFIC ENTITIES ====================

// Tooth Record for Dental Chart
export interface ToothRecord {
  id: string;
  patientId: string;
  toothNumber: number; // 1-32 (FDI notation can be mapped)
  quadrant: string; // "UL", "UR", "LL", "LR"
  condition: string; // "Healthy", "Caries", "Missing", "Filled", "Crown", "RootCanal"
  notes?: string;
  treatmentId?: string; // Link to treatment if applicable
  createdAt: string;
  updatedAt: string;
}

export const TOOTH_CONDITIONS = [
  "Healthy",
  "Caries",
  "Missing",
  "Filled",
  "Crown",
  "RootCanal",
] as const;

export const QUADRANTS = ["UL", "UR", "LL", "LR"] as const;

export const insertToothRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  toothNumber: z.number().min(1).max(99),
  quadrant: z.enum(QUADRANTS),
  condition: z.enum(TOOTH_CONDITIONS),
  notes: z.string().optional(),
  treatmentId: z.string().optional(),
});

export type InsertToothRecord = z.infer<typeof insertToothRecordSchema>;

// Sitting Detail for multi-sitting treatments
export interface SittingDetail {
  sittingNumber: number;
  date?: string;
  status: "Planned" | "Completed" | "Skipped";
  notes?: string;
}

// Treatment Sitting for multi-sitting workflow
export interface TreatmentSitting {
  id: string;
  patientId: string;
  treatmentId: string;
  treatmentName: string;
  billId?: string; // Link to bill when billed
  toothNumbers: number[]; // Which teeth this treatment applies to
  totalSittings: number;
  completedSittings: number;
  status: string; // "Planned", "InProgress", "Completed", "Cancelled"
  sittingDetails: SittingDetail[];
  startDate: string;
  lastVisitDate?: string;
  notes?: string;
}

export const SITTING_STATUSES = ["Planned", "InProgress", "Completed", "Cancelled"] as const;

export const insertTreatmentSittingSchema = z.object({
  patientId: z.string().min(1),
  treatmentId: z.string().min(1),
  treatmentName: z.string(),
  billId: z.string().optional(),
  toothNumbers: z.array(z.number()).default([]),
  totalSittings: z.number().min(0),
  completedSittings: z.number().default(0),
  status: z.enum(SITTING_STATUSES).default("Planned"),
  sittingDetails: z.array(z.object({
    sittingNumber: z.number(),
    date: z.string().optional(),
    status: z.enum(["Planned", "Completed", "Skipped"]),
    notes: z.string().optional(),
  })).default([]),
  startDate: z.string(),
  lastVisitDate: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertTreatmentSitting = z.infer<typeof insertTreatmentSittingSchema>;

// Update schema for PATCH operations - all fields optional
export const updateTreatmentSittingSchema = z.object({
  patientId: z.string().optional(),
  treatmentId: z.string().optional(),
  treatmentName: z.string().optional(),
  billId: z.string().optional().nullable(),
  toothNumbers: z.array(z.number()).optional(),
  totalSittings: z.number().min(0).optional(),
  completedSittings: z.number().optional(),
  status: z.enum(SITTING_STATUSES).optional(),
  sittingDetails: z.array(z.object({
    sittingNumber: z.number(),
    date: z.string().optional(),
    status: z.enum(["Planned", "Completed", "Skipped"]),
    notes: z.string().optional(),
  })).optional(),
  startDate: z.string().optional(),
  lastVisitDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateTreatmentSitting = z.infer<typeof updateTreatmentSittingSchema>;

// Dental-specific constants
export const DENTAL_TREATMENT_CATEGORIES = [
  "Preventive",
  "Restorative",
  "Surgical",
  "Orthodontic",
  "Prosthodontic",
  "Endodontic",
  "Periodontic",
  "Diagnostic",
] as const;

export const INVENTORY_CATEGORIES = [
  "Medicine",
  "Dental Material",
  "Consumable",
  "Impression Material",
  "Equipment",
] as const;

// Dental-specific constants removed - no longer needed after schema simplification

export const COMMON_DENTAL_TREATMENTS = [
  { name: "Consultation", defaultPrice: 500, gstPercentage: 0, numberOfSittings: 1, category: "Diagnostic" },
  { name: "Scaling & Polishing", defaultPrice: 1500, gstPercentage: 0, numberOfSittings: 1, category: "Preventive" },
  { name: "Root Canal Treatment (Anterior)", defaultPrice: 4000, gstPercentage: 0, numberOfSittings: 2, category: "Endodontic" },
  { name: "Root Canal Treatment (Posterior)", defaultPrice: 6000, gstPercentage: 0, numberOfSittings: 3, category: "Endodontic" },
  { name: "Composite Filling (Class I)", defaultPrice: 1200, gstPercentage: 0, numberOfSittings: 1, category: "Restorative" },
  { name: "Composite Filling (Class II)", defaultPrice: 1800, gstPercentage: 0, numberOfSittings: 1, category: "Restorative" },
  { name: "Extraction (Simple)", defaultPrice: 1000, gstPercentage: 0, numberOfSittings: 1, category: "Surgical" },
  { name: "Extraction (Surgical)", defaultPrice: 3500, gstPercentage: 0, numberOfSittings: 2, category: "Surgical" },
  { name: "Crown (PFM)", defaultPrice: 4500, gstPercentage: 0, numberOfSittings: 2, category: "Prosthodontic" },
  { name: "Crown (Zirconia)", defaultPrice: 8000, gstPercentage: 0, numberOfSittings: 2, category: "Prosthodontic" },
  { name: "Complete Denture", defaultPrice: 25000, gstPercentage: 0, numberOfSittings: 5, category: "Prosthodontic" },
  { name: "Implant (Standard)", defaultPrice: 30000, gstPercentage: 18, numberOfSittings: 3, category: "Surgical" },
  { name: "Orthodontic Treatment (Metal)", defaultPrice: 35000, gstPercentage: 0, numberOfSittings: 12, category: "Orthodontic" },
  { name: "Orthodontic Treatment (Ceramic)", defaultPrice: 50000, gstPercentage: 0, numberOfSittings: 12, category: "Orthodontic" },
  { name: "Bleaching (Office)", defaultPrice: 8000, gstPercentage: 18, numberOfSittings: 1, category: "Cosmetic" },
] as const;

// Body Chart Record
export interface BodyRecord {
  id: string;
  patientId: string;
  bodyPart: string;
  painLevel?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertBodyRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  bodyPart: z.string().min(1, "Body part ID is required"),
  painLevel: z.number().min(0).max(10).optional(),
  notes: z.string().optional(),
});

export type InsertBodyRecord = z.infer<typeof insertBodyRecordSchema>;
