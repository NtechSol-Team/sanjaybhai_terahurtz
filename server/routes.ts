/**
 * API Routes for Dental Clinic Management System
 * 
 * This file contains all REST API endpoints for:
 * - Patients (CRUD + pagination + search)
 * - Visits (patient visit history)
 * - Medicines (inventory management)
 * - Treatments (treatment catalog)
 * - Bills (billing with medicine stock deduction)
 * - Expenses (clinic expense tracking)
 * - Appointments (scheduling)
 * - Dental records (tooth-specific data, treatment sittings)
 * 
 * All endpoints are protected by authentication middleware.
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertPatientSchema,
  insertVisitSchema,
  insertMedicineSchema,
  insertTreatmentSchema,
  insertBillSchema,
  insertExpenseSchema,
  paymentAdjustmentSchema,
  insertAppointmentSchema,
  paginationSchema,
  // Dental-specific schemas
  insertToothRecordSchema,
  insertTreatmentSittingSchema,
  updateTreatmentSittingSchema,
  insertBodyRecordSchema,
  insertReferrerSchema,
} from "@shared/schema";
import { z } from "zod";
import { ensureAuthenticated } from "./auth.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Authentication middleware - protects all /api/* endpoints
  app.use("/api", ensureAuthenticated);


  // ==================== PATIENTS ====================

  /**
   * GET /api/dashboard-summary
   * 
   * Returns aggregated statistics for the dashboard in a single API call.
   * This reduces the number of API calls needed to load the dashboard.
   * 
   * Response: { totalPatients: number, todaysPatients: number }
   */
  app.get("/api/dashboard-summary", async (req, res) => {
    try {
      const [patientsCount, todaysPatientsCount] = await Promise.all([
        storage.getPatientsCount(),
        storage.getTodaysPatientsCount(),
      ]);
      res.json({
        totalPatients: patientsCount,
        todaysPatients: todaysPatientsCount,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  /**
   * GET /api/patients
   * 
   * Server-side paginated patient list with optional search.
   * 
   * Query Parameters:
   *   - page (default: 1): Page number (1-indexed)
   *   - limit (default: 20): Number of records per page
   *   - search (optional): Search term for name/phone (case-insensitive)
   * 
   * SQL Logic:
   *   SELECT * FROM patients 
   *   WHERE name ILIKE '%search%' OR phone ILIKE '%search%'
   *   ORDER BY registration_date DESC
   *   LIMIT :limit OFFSET (:page - 1) * :limit
   * 
   * Response: { data: Patient[], total: number, page: number, limit: number }
   */
  app.get("/api/patients", async (req, res) => {
    try {
      // Parse pagination parameters from query string
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;

      // Fetch paginated results from database
      const result = await storage.getPatientsPaginated(page, limit, search);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json(patient);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const validated = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validated);
      res.status(201).json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", async (req, res) => {
    try {
      const validated = insertPatientSchema.parse(req.body);
      const patient = await storage.updatePatient(req.params.id, validated);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      // Update all related bills with the new patient name
      await storage.updatePatientBillsName(req.params.id, patient.name);
      res.json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update patient" });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePatient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  // ==================== PATIENT REFERRALS ====================

  app.get("/api/patients/:id/referrals", async (req, res) => {
    try {
      const referralInfo = await storage.getPatientReferralInfo(req.params.id);
      res.json(referralInfo);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referral information" });
    }
  });

  // ==================== REFERRERS ====================

  app.get("/api/referrers", async (req, res) => {
    try {
      const referrers = await storage.getReferrers();
      // Calculate stats for each referrer to show in the list
      // This might be expensive if there are many referrers, but for now it's fine
      // Optimization: Implement getReferrersWithStats() in storage if needed later
      const referrersWithStats = await Promise.all(
        referrers.map(async (r) => {
          const stats = await storage.getReferrerStats(r.id);
          return stats || r;
        })
      );
      res.json(referrersWithStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrers" });
    }
  });

  app.get("/api/referrers/:id", async (req, res) => {
    try {
      const referrer = await storage.getReferrer(req.params.id);
      if (!referrer) {
        return res.status(404).json({ error: "Referrer not found" });
      }
      res.json(referrer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrer Details" });
    }
  });

  app.post("/api/referrers", async (req, res) => {
    console.log("POST /api/referrers request received:", req.body);
    try {
      const validated = insertReferrerSchema.parse(req.body);
      const referrer = await storage.createReferrer(validated);
      console.log("Referrer created successfully:", referrer.id);
      res.status(201).json(referrer);
    } catch (error) {
      console.error("Error creating referrer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create referrer" });
    }
  });

  app.get("/api/referrers/:id/stats", async (req, res) => {
    try {
      const stats = await storage.getReferrerStats(req.params.id);
      if (!stats) {
        return res.status(404).json({ error: "Referrer not found" });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrer stats" });
    }
  });

  app.post("/api/referrers/:id/payout", async (req, res) => {
    try {
      const { amount } = z.object({ amount: z.number().positive() }).parse(req.body);
      const referrer = await storage.getReferrer(req.params.id);
      if (!referrer) {
        return res.status(404).json({ error: "Referrer not found" });
      }
      if (amount > referrer.availableCredit) {
        return res.status(400).json({ error: "Amount exceeds available credit" });
      }

      // Deduct from available credit (pass negative amount)
      await storage.updateReferrerCredit(req.params.id, -amount);
      res.json({ message: "Payout recorded successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to record payout" });
    }
  });

  // ==================== VISITS ====================

  app.get("/api/visits", async (req, res) => {
    try {
      const visits = await storage.getVisits();
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  app.get("/api/visits/:patientId", async (req, res) => {
    try {
      const visits = await storage.getVisitsByPatient(req.params.patientId);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });


  app.post("/api/visits", async (req, res) => {
    try {
      const validated = insertVisitSchema.parse(req.body);
      const visit = await storage.createVisit(validated);
      res.status(201).json(visit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create visit" });
    }
  });

  app.patch("/api/visits/:id", async (req, res) => {
    try {
      const validated = insertVisitSchema.parse(req.body);
      const visit = await storage.updateVisit(req.params.id, validated);
      if (!visit) {
        return res.status(404).json({ error: "Visit not found" });
      }
      res.json(visit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update visit" });
    }
  });

  // ==================== MEDICINES ====================

  app.get("/api/medicines", async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getMedicinesPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch medicines" });
    }
  });

  app.get("/api/medicines/:id", async (req, res) => {
    try {
      const medicine = await storage.getMedicine(req.params.id);
      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.json(medicine);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch medicine" });
    }
  });

  app.post("/api/medicines", async (req, res) => {
    try {
      const validated = insertMedicineSchema.parse(req.body);
      const medicine = await storage.createMedicine(validated);
      res.status(201).json(medicine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create medicine" });
    }
  });

  app.patch("/api/medicines/:id", async (req, res) => {
    try {
      const validated = insertMedicineSchema.parse(req.body);
      const medicine = await storage.updateMedicine(req.params.id, validated);
      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.json(medicine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update medicine" });
    }
  });

  app.delete("/api/medicines/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMedicine(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete medicine" });
    }
  });

  // ==================== TREATMENTS ====================

  // Seed common dental treatments
  app.post("/api/treatments/seed", async (req, res) => {
    try {
      const { COMMON_DENTAL_TREATMENTS } = await import("@shared/schema");
      let count = 0;
      for (const t of COMMON_DENTAL_TREATMENTS) {
        // Simple check to avoid duplicates by name
        const existing = await storage.getTreatmentByName(t.name);
        if (!existing) {
          await storage.createTreatment(t);
          count++;
        }
      }
      res.json({ message: `Seeded ${count} new treatments.` });
    } catch (error) {
      console.error("Seeding error:", error);
      res.status(500).json({ error: "Failed to seed treatments" });
    }
  });

  app.get("/api/treatments", async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      try {
        const { data, total } = await storage.getTreatmentsPaginated(limit, offset);
        res.json({ data, total, limit, offset });
      } catch (paginationError) {
        // Fallback to non-paginated method
        const allTreatments = await storage.getTreatments();
        const data = allTreatments.slice(offset, offset + limit);
        const total = allTreatments.length;
        res.json({ data, total, limit, offset });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Treatments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch treatments" });
    }
  });

  app.get("/api/treatments/:id", async (req, res) => {
    try {
      const treatment = await storage.getTreatment(req.params.id);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch treatment" });
    }
  });

  app.post("/api/treatments", async (req, res) => {
    try {
      const validated = insertTreatmentSchema.parse(req.body);
      const treatment = await storage.createTreatment(validated);
      res.status(201).json(treatment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create treatment" });
    }
  });

  app.patch("/api/treatments/:id", async (req, res) => {
    try {
      const validated = insertTreatmentSchema.parse(req.body);
      const treatment = await storage.updateTreatment(req.params.id, validated);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update treatment" });
    }
  });

  app.delete("/api/treatments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTreatment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Cannot delete treatment")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete treatment" });
    }
  });

  // ==================== BILLS ====================

  app.get("/api/bills", async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getBillsPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch bills" });
    }
  });

  app.get("/api/bills/:id", async (req, res) => {
    try {
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bill" });
    }
  });

  /**
   * Helper function to calculate bill grand total with discounts
   * 
   * Formula:
   *   treatmentNet = treatmentTotal * (1 - treatmentDiscount/100)
   *   medicineNet = medicineTotal * (1 - medicineDiscount/100)
   *   grandTotal = ROUND(treatmentNet + medicineNet + GST)
   */
  const calculateBillTotals = (validated: {
    treatmentTotal: number;
    medicineTotal: number;
    treatmentDiscount?: number;
    medicineDiscount?: number;
    gstTotal?: number;
  }) => {
    const treatmentDisc = validated.treatmentDiscount || 0;
    const medicineDisc = validated.medicineDiscount || 0;

    const treatmentNet = validated.treatmentTotal * (1 - treatmentDisc / 100);
    const medicineNet = validated.medicineTotal * (1 - medicineDisc / 100);

    const grandTotal = treatmentNet + medicineNet + (validated.gstTotal || 0);
    return Math.round(grandTotal);
  };

  /**
   * POST /api/bills
   * 
   * Creates a new bill and handles medicine stock management.
   * 
   * Business Logic:
   * 1. Validate bill data using Zod schema
   * 2. Recalculate grand total server-side for security
   * 3. Verify patient exists
   * 4. For each medicine in bill:
   *    - Check if sufficient stock exists
   *    - Deduct quantity from inventory using bulk update
   * 5. Create bill record with patient name denormalized
   * 
   * Stock Management:
   *   UPDATE medicines SET quantity = quantity - :billQty WHERE id = :medicineId
   * 
   * Rollback: If bill creation fails after stock deduction, manual intervention required
   */
  app.post("/api/bills", async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);

      // Recalculate total with discounts to ensure server-side consistency
      validated.grandTotal = calculateBillTotals(validated);

      // Get patient name for denormalization in bill record
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }

      /**
       * Medicine Stock Deduction Logic:
       * 1. Extract all medicine IDs from the bill
       * 2. Fetch current stock for all medicines in one query
       * 3. Validate each medicine has sufficient stock
       * 4. Apply all stock changes in a single bulk update
       */
      if (validated.medicines && validated.medicines.length > 0) {
        const medIds = validated.medicines
          .map((m) => m.medicineId)
          .filter((id): id is string => !!id);

        if (medIds.length > 0) {
          // Fetch all medicines in one query for efficiency
          const medicines = await storage.getMedicinesByIds(medIds);
          const medMap = new Map(medicines.map((m) => [m.id, m]));
          const updates: { id: string; quantityChange: number }[] = [];

          // Validate stock availability for each medicine
          for (const med of validated.medicines) {
            if (med.medicineId) {
              const medicine = medMap.get(med.medicineId);
              if (!medicine) {
                return res
                  .status(400)
                  .json({ error: `Medicine with ID ${med.medicineId} not found` });
              }
              if (medicine.quantity < med.quantity) {
                return res.status(400).json({
                  error: `Insufficient stock for ${med.medicineName}. Available: ${medicine.quantity}, Required: ${med.quantity}`,
                });
              }
              // Prepare stock deduction (negative change)
              updates.push({ id: med.medicineId, quantityChange: -med.quantity });
            }
          }
          // Apply all stock changes in one bulk operation
          await storage.updateMedicineStocksBulk(updates);
        }
      }

      const bill = await storage.createBill(validated, patient.name);
      res.status(201).json(bill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create bill", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/bills/:id", async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);

      // Recalculate total with discounts
      validated.grandTotal = calculateBillTotals(validated);

      // Get patient name
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }

      // Get existing bill to restore and update stock
      const existingBill = await storage.getBill(req.params.id);

      const stockChanges = new Map<string, number>();

      // 1. Calculate restoration (add back old quantities)
      if (existingBill && existingBill.medicines) {
        for (const med of existingBill.medicines) {
          if (med.medicineId) {
            const current = stockChanges.get(med.medicineId) || 0;
            stockChanges.set(med.medicineId, current + med.quantity);
          }
        }
      }

      // 2. Calculate consumption (subtract new quantities)
      if (validated.medicines) {
        for (const med of validated.medicines) {
          if (med.medicineId) {
            const current = stockChanges.get(med.medicineId) || 0;
            stockChanges.set(med.medicineId, current - med.quantity);
          }
        }
      }

      // 3. Process changes
      if (stockChanges.size > 0) {
        const medIds = Array.from(stockChanges.keys());
        const medicines = await storage.getMedicinesByIds(medIds);
        const medMap = new Map(medicines.map((m) => [m.id, m]));
        const updates: { id: string; quantityChange: number }[] = [];

        for (const [id, change] of Array.from(stockChanges)) {
          // If change is 0, no update needed
          if (change === 0) continue;

          const medicine = medMap.get(id);
          if (!medicine) {
            // If medicine was deleted but we are trying to restore stock, we might just ignore it 
            // or error. safer to error if we are consuming, but if restoring maybe fine?
            // But here we are just validating sufficient stock if change is negative.
            if (change < 0) {
              return res.status(400).json({ error: `Medicine with ID ${id} not found` });
            }
            // If we are adding stock to a deleted medicine, we can't. 
            // Ideally we should warn or ignore. I'll ignore if not found for restoration, 
            // but strictly error for consumption of non-existent.
            continue;
          }

          if (change < 0 && medicine.quantity + change < 0) {
            return res.status(400).json({
              error: `Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}, Net Change: ${change}`
            });
          }
          updates.push({ id, quantityChange: change });
        }

        if (updates.length > 0) {
          await storage.updateMedicineStocksBulk(updates);
        }
      }

      const bill = await storage.updateBill(req.params.id, validated, patient.name);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update bill" });
    }
  });

  app.patch("/api/bills/:id/payment", async (req, res) => {
    try {
      const { addAmount, setAmount } = req.body;

      // Validate incoming numeric values if present
      if (typeof addAmount !== "undefined" && typeof addAmount !== "number") {
        return res.status(400).json({ error: "Invalid addAmount" });
      }
      if (typeof setAmount !== "undefined" && typeof setAmount !== "number") {
        return res.status(400).json({ error: "Invalid setAmount" });
      }

      // Get current bill to calculate new total
      const currentBill = await storage.getBill(req.params.id);
      if (!currentBill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      let newTotalPaid: number;

      // If setAmount is provided, use it as the absolute paid total (allow correcting mistakes)
      if (typeof setAmount === "number") {
        if (setAmount < 0 || setAmount > currentBill.grandTotal) {
          return res.status(400).json({ error: "setAmount must be between 0 and bill total" });
        }
        newTotalPaid = setAmount;
      } else {
        // Otherwise use additive flow (existing behavior)
        const add = typeof addAmount === "number" ? addAmount : undefined;
        if (typeof add === "undefined" || add < 0) {
          return res.status(400).json({ error: "Invalid payment amount" });
        }
        newTotalPaid = currentBill.amountPaid + add;
        if (newTotalPaid > currentBill.grandTotal) {
          return res.status(400).json({
            error: `Cannot exceed bill amount. Remaining: ₹${(currentBill.grandTotal - currentBill.amountPaid).toFixed(2)}`
          });
        }
      }

      const bill = await storage.updateBillPayment(req.params.id, newTotalPaid);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/bills/:id", async (req, res) => {
    try {
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      // Restore medicine stock for deleted bill
      const medicines = Array.isArray(bill.medicines) ? bill.medicines : [];

      const updates: { id: string; quantityChange: number }[] = [];

      for (const med of medicines) {
        if (med && med.medicineId && med.quantity) {
          updates.push({ id: med.medicineId, quantityChange: med.quantity });
        }
      }

      if (updates.length > 0) {
        await storage.updateMedicineStocksBulk(updates);
      }

      const deleted = await storage.deleteBill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bill not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete bill error:", error);
      res.status(500).json({ error: "Failed to delete bill" });
    }
  });

  // ==================== EXPENSES ====================

  app.get("/api/expenses", async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getExpensesPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validated = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validated);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const validated = insertExpenseSchema.parse(req.body);
      const expense = await storage.updateExpense(req.params.id, validated);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ==================== APPOINTMENTS ====================

  app.get("/api/appointments", async (req, res) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/patient/:patientId", async (req, res) => {
    try {
      const appointments = await storage.getAppointmentsByPatient(req.params.patientId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", async (req, res) => {
    try {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const validated = insertAppointmentSchema.parse(req.body);
      const appointment = await storage.createAppointment(validated);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const validated = insertAppointmentSchema.parse(req.body);
      const appointment = await storage.updateAppointment(req.params.id, validated);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAppointment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // ==================== TOOTH RECORDS (Dental Chart) ====================

  // Get all tooth records for a patient
  app.get("/api/patients/:patientId/tooth-records", async (req, res) => {
    try {
      const records = await storage.getToothRecords(req.params.patientId);
      res.json(records);
    } catch (error) {
      console.error("GET tooth-records error:", error);
      res.status(500).json({ error: "Failed to fetch tooth records" });
    }
  });

  // Get single tooth record
  app.get("/api/tooth-records/:id", async (req, res) => {
    try {
      const record = await storage.getToothRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Record not found" });
      res.json(record);
    } catch (error) {
      console.error("GET tooth-record/:id error:", error);
      res.status(500).json({ error: "Failed to fetch tooth record" });
    }
  });

  // Create tooth record
  app.post("/api/tooth-records", async (req, res) => {
    try {
      const record = insertToothRecordSchema.parse(req.body);
      const created = await storage.createToothRecord(record);
      res.json(created);
    } catch (error) {
      console.error("POST tooth-records error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create tooth record" });
    }
  });

  // Update tooth record
  app.patch("/api/tooth-records/:id", async (req, res) => {
    try {
      const validated = insertToothRecordSchema.parse(req.body);
      const record = await storage.updateToothRecord(req.params.id, validated);
      if (!record) {
        return res.status(404).json({ error: "Tooth record not found" });
      }
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update tooth record" });
    }
  });

  // Delete tooth record
  app.delete("/api/tooth-records/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteToothRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tooth record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tooth record" });
    }
  });

  // ==================== TREATMENT SITTINGS (Multi-sitting workflow) ====================

  // Get all treatment sittings for a patient
  app.get("/api/patients/:patientId/treatment-sittings", async (req, res) => {
    try {
      const sittings = await storage.getTreatmentSittings(req.params.patientId);
      res.json(sittings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch treatment sittings" });
    }
  });

  // Get pending sittings (for reports/dashboard)
  app.get("/api/treatment-sittings/pending", async (req, res) => {
    try {
      const sittings = await storage.getPendingSittings();
      res.json(sittings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending sittings" });
    }
  });

  // Get single treatment sitting
  app.get("/api/treatment-sittings/:id", async (req, res) => {
    try {
      const sitting = await storage.getTreatmentSitting(req.params.id);
      if (!sitting) {
        return res.status(404).json({ error: "Treatment sitting not found" });
      }
      res.json(sitting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch treatment sitting" });
    }
  });

  // Create treatment sitting
  app.post("/api/treatment-sittings", async (req, res) => {
    try {
      const validated = insertTreatmentSittingSchema.parse(req.body);
      const sitting = await storage.createTreatmentSitting(validated);
      res.status(201).json(sitting);
    } catch (error) {
      console.error("POST treatment-sittings error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create treatment sitting" });
    }
  });

  // Update treatment sitting (for progress updates)
  app.patch("/api/treatment-sittings/:id", async (req, res) => {
    try {
      const validated = updateTreatmentSittingSchema.parse(req.body);
      const sitting = await storage.updateTreatmentSitting(req.params.id, validated);
      if (!sitting) {
        return res.status(404).json({ error: "Treatment sitting not found" });
      }
      res.json(sitting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update treatment sitting" });
    }
  });

  // Delete treatment sitting
  app.delete("/api/treatment-sittings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTreatmentSitting(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Treatment sitting not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete treatment sitting" });
    }
  });

  // ==================== BODY RECORDS (Body Chart) ====================

  // Get all body records for a patient
  app.get("/api/patients/:patientId/body-records", async (req, res) => {
    try {
      const records = await storage.getBodyRecords(req.params.patientId);
      res.json(records);
    } catch (error) {
      console.error("GET body-records error:", error);
      res.status(500).json({ error: "Failed to fetch body records" });
    }
  });

  // Create/Update body record
  app.post("/api/body-records", async (req, res) => {
    try {
      const record = insertBodyRecordSchema.parse(req.body);
      const created = await storage.createBodyRecord(record);
      res.status(201).json(created);
    } catch (error) {
      console.error("POST body-records error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create body record" });
    }
  });

  // Delete body record
  app.delete("/api/patients/:patientId/body-records/:bodyPart", async (req, res) => {
    try {
      await storage.deleteBodyRecord(req.params.patientId, req.params.bodyPart);
      res.status(204).send();
    } catch (error) {
      console.error("DELETE body-records error:", error);
      res.status(500).json({ error: "Failed to delete body record" });
    }
  });

  // Catch-all for API routes to prevent falling through to frontend index.html
  // IMPORTANT: This must be registered AFTER all other API routes.
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  return httpServer;
}
