import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Printer, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { extractPaginatedData } from "@/lib/utils";
import type { Patient, Medicine } from "@shared/schema";

// Common post-procedure instructions for dental treatments
const POST_PROCEDURE_INSTRUCTIONS = {
    extraction: [
        "Bite on gauze for 30-45 minutes after procedure",
        "Do not rinse or spit forcefully for 24 hours",
        "Apply ice pack on cheek for 10-15 minutes if swelling occurs",
        "Avoid hot foods and beverages for 24 hours",
        "Do not use straw for drinking for 48 hours",
        "Take prescribed medications as directed",
    ],
    rct: [
        "Avoid chewing on the treated side until final restoration",
        "Mild discomfort is normal for a few days",
        "Take prescribed painkillers as directed",
        "Contact clinic if severe pain or swelling occurs",
        "Temporary filling may feel rough but is normal",
    ],
    filling: [
        "Avoid eating until numbness wears off completely",
        "Sensitivity to hot/cold is normal for a few days",
        "Avoid hard or sticky foods for 24 hours",
        "Maintain regular oral hygiene",
    ],
    scaling: [
        "Mild sensitivity is normal for a few days",
        "Use desensitizing toothpaste if needed",
        "Avoid hot or cold foods immediately after",
        "Continue regular brushing and flossing",
        "Next scaling recommended in 6 months",
    ],
    general: [
        "Take medications as prescribed",
        "Maintain good oral hygiene",
        "Contact clinic if any unusual symptoms occur",
        "Follow up as scheduled",
    ],
};

interface PrescriptionProps {
    patientId: string;
    visitId?: string;
    onClose?: () => void;
}

interface PrescriptionMedicine {
    medicineId: string;
    medicineName: string;
    dosage: string;
    duration: string;
    instructions: string;
}

export function DentalPrescription({ patientId, visitId, onClose }: PrescriptionProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [diagnosis, setDiagnosis] = useState("");
    const [procedureType, setProcedureType] = useState<string>("general");
    const [customInstructions, setCustomInstructions] = useState("");
    const [prescribedMedicines, setPrescribedMedicines] = useState<PrescriptionMedicine[]>([]);
    const [followUpDate, setFollowUpDate] = useState("");

    const { data: patientData } = useQuery<Patient>({
        queryKey: ["/api/patients", patientId],
        enabled: !!patientId,
    });

    const { data: medicinesResponse } = useQuery({
        queryKey: ["/api/medicines"],
    });
    const medicines = extractPaginatedData<Medicine>(medicinesResponse);

    const addMedicine = () => {
        setPrescribedMedicines([
            ...prescribedMedicines,
            { medicineId: "", medicineName: "", dosage: "", duration: "", instructions: "" },
        ]);
    };

    const updateMedicine = (index: number, field: keyof PrescriptionMedicine, value: string) => {
        const updated = [...prescribedMedicines];
        updated[index] = { ...updated[index], [field]: value };
        if (field === "medicineId") {
            const med = medicines.find((m) => m.id === value);
            if (med) updated[index].medicineName = med.name;
        }
        setPrescribedMedicines(updated);
    };

    const removeMedicine = (index: number) => {
        setPrescribedMedicines(prescribedMedicines.filter((_, i) => i !== index));
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prescription - ${patientData?.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                    .clinic-name { font-size: 24px; font-weight: bold; color: #1a5f7a; }
                    .patient-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f5f5f5; }
                    .section { margin-bottom: 20px; }
                    .section-title { font-weight: bold; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
                    .medicine-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    .medicine-table th, .medicine-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .medicine-table th { background: #f0f0f0; }
                    .instructions { padding: 10px; background: #fff8e1; border-left: 3px solid #ffc107; }
                    .instructions li { margin: 5px 0; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                    .signature { border-top: 1px solid #333; padding-top: 5px; width: 200px; text-align: center; }
                    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const selectedInstructions = POST_PROCEDURE_INSTRUCTIONS[procedureType as keyof typeof POST_PROCEDURE_INSTRUCTIONS] || POST_PROCEDURE_INSTRUCTIONS.general;

    return (
        <div className="space-y-4">
            {/* Prescription Form */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5" />
                        Dental Prescription
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Diagnosis */}
                    <div>
                        <Label>Diagnosis / Chief Complaint</Label>
                        <Textarea
                            placeholder="Enter diagnosis or findings..."
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    {/* Procedure Type for Instructions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Procedure Type (for instructions)</Label>
                            <Select value={procedureType} onValueChange={setProcedureType}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="extraction">Extraction</SelectItem>
                                    <SelectItem value="rct">Root Canal (RCT)</SelectItem>
                                    <SelectItem value="filling">Filling</SelectItem>
                                    <SelectItem value="scaling">Scaling & Cleaning</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Follow-up Date</Label>
                            <Input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Medicines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Prescribed Medicines</Label>
                            <Button variant="outline" size="sm" onClick={addMedicine}>
                                + Add Medicine
                            </Button>
                        </div>
                        {prescribedMedicines.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No medicines added</p>
                        ) : (
                            <div className="space-y-2">
                                {prescribedMedicines.map((med, index) => (
                                    <div key={index} className="grid grid-cols-5 gap-2 p-2 bg-muted/30 rounded">
                                        <Select
                                            value={med.medicineId}
                                            onValueChange={(v) => updateMedicine(index, "medicineId", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Medicine" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {medicines.map((m) => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            placeholder="Dosage (e.g. 1-0-1)"
                                            value={med.dosage}
                                            onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                                        />
                                        <Input
                                            placeholder="Duration (e.g. 5 days)"
                                            value={med.duration}
                                            onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                                        />
                                        <Input
                                            placeholder="Instructions"
                                            value={med.instructions}
                                            onChange={(e) => updateMedicine(index, "instructions", e.target.value)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => removeMedicine(index)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Custom Instructions */}
                    <div>
                        <Label>Additional Instructions</Label>
                        <Textarea
                            placeholder="Any additional instructions..."
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    {/* Print Button */}
                    <div className="flex justify-end gap-2">
                        {onClose && (
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                        )}
                        <Button onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print Prescription
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Print Preview (Hidden) */}
            <div className="hidden">
                <div ref={printRef}>
                    <div className="header">
                        <div className="clinic-name">Dental Care Clinic</div>
                        <div>Address Line 1, City - PIN</div>
                        <div>Phone: +91 XXXXXXXXXX</div>
                    </div>

                    <div className="patient-info">
                        <div>
                            <strong>Patient:</strong> {patientData?.name}<br />
                            <strong>Phone:</strong> {patientData?.phone}
                        </div>
                        <div>
                            <strong>Date:</strong> {format(new Date(), "dd MMM yyyy")}<br />
                            {followUpDate && <><strong>Follow-up:</strong> {format(new Date(followUpDate), "dd MMM yyyy")}</>}
                        </div>
                    </div>

                    {diagnosis && (
                        <div className="section">
                            <div className="section-title">Diagnosis</div>
                            <div>{diagnosis}</div>
                        </div>
                    )}

                    {prescribedMedicines.length > 0 && (
                        <div className="section">
                            <div className="section-title">Rx (Prescription)</div>
                            <table className="medicine-table">
                                <thead>
                                    <tr>
                                        <th>Medicine</th>
                                        <th>Dosage</th>
                                        <th>Duration</th>
                                        <th>Instructions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescribedMedicines.map((med, i) => (
                                        <tr key={i}>
                                            <td>{med.medicineName}</td>
                                            <td>{med.dosage}</td>
                                            <td>{med.duration}</td>
                                            <td>{med.instructions}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="section">
                        <div className="section-title">Post-Procedure Instructions</div>
                        <div className="instructions">
                            <ul>
                                {selectedInstructions.map((inst, i) => (
                                    <li key={i}>{inst}</li>
                                ))}
                                {customInstructions && <li>{customInstructions}</li>}
                            </ul>
                        </div>
                    </div>

                    <div className="footer">
                        <div></div>
                        <div className="signature">
                            Doctor's Signature
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
