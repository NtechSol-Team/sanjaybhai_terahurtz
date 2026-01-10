import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  Patient,
  Medicine,
  Treatment,
  BillMedicineItem,
  BillTreatmentItem,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { extractPaginatedData } from "@/lib/utils";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function BillingCreate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [selectedTreatments, setSelectedTreatments] = useState<BillTreatmentItem[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<BillMedicineItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");

  // Fetch all patients for search and selection
  const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients", { limit: 10000 }],
    queryFn: async () => {
      const res = await fetch("/api/patients?limit=10000");
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
  });
  const patients = extractPaginatedData<Patient>(patientsResponse);

  // Handle patient pre-selection from URL or Session Storage and clear it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let patientId = params.get("patientId");

    // Check session storage if not in URL
    if (!patientId) {
      patientId = sessionStorage.getItem("preselectedPatientId");
    }

    if (patientId && patients.length > 0 && !selectedPatient) {
      const patient = patients.find(p => String(p.id) === patientId);
      if (patient) {
        setSelectedPatient(patient);
        // Clear session storage to prevent persistence
        sessionStorage.removeItem("preselectedPatientId");
      }
    }
  }, [patients, selectedPatient]);

  const { data: medicinesResponse } = useQuery({
    queryKey: ["/api/medicines"],
  });
  const medicines = extractPaginatedData<Medicine>(medicinesResponse);

  const { data: treatmentsResponse } = useQuery({
    queryKey: ["/api/treatments"],
  });
  const treatments = extractPaginatedData<Treatment>(treatmentsResponse);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery)
  );

  const createBillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Please select a patient");

      const treatmentTotal = selectedTreatments.reduce((sum, t) => sum + (t.price * (1 - (t.discount || 0) / 100)), 0);
      const medicineTotal = selectedMedicines.reduce((sum, m) => sum + (m.total * (1 - (m.discount || 0) / 100)), 0);
      const grandTotal = treatmentTotal + medicineTotal;
      const paid = parseFloat(amountPaid) || 0;

      return await apiRequest("POST", "/api/bills", {
        patientId: selectedPatient.id,
        date: billDate,
        treatments: selectedTreatments,
        medicines: selectedMedicines,
        treatmentTotal,
        medicineTotal,
        // Discounts are now per-item
        grandTotal,
        amountPaid: paid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
      toast({
        title: "Bill Created",
        description: "Bill has been saved successfully.",
      });
      resetForm();
      // Force page reload as requested
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedPatient(null);
    setSelectedTreatments([]);
    setSelectedMedicines([]);
    setAmountPaid("");
    setSearchQuery("");
    setBillDate(format(new Date(), "yyyy-MM-dd"));
  };

  const addTreatment = (treatmentId: string) => {
    const treatment = treatments.find((t) => t.id === treatmentId);
    if (treatment) {
      setSelectedTreatments([
        ...selectedTreatments,
        {
          treatmentId: treatment.id,
          treatmentName: treatment.name,
          price: treatment.defaultPrice,
          discount: 0,
        },
      ]);
    }
  };

  const updateTreatmentPrice = (index: number, price: number) => {
    const updated = [...selectedTreatments];
    updated[index].price = price;
    setSelectedTreatments(updated);
  };

  const updateTreatmentDiscount = (index: number, discount: number) => {
    const updated = [...selectedTreatments];
    updated[index].discount = Math.min(100, Math.max(0, discount));
    setSelectedTreatments(updated);
  };

  const removeTreatment = (index: number) => {
    setSelectedTreatments(selectedTreatments.filter((_, i) => i !== index));
  };

  const addMedicine = () => {
    setSelectedMedicines([
      ...selectedMedicines,
      {
        medicineId: "",
        medicineName: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        total: 0,
      },
    ]);
  };

  const updateMedicine = (index: number, medicineId: string) => {
    const medicine = medicines.find((m) => m.id === medicineId);
    if (medicine) {
      const updated = [...selectedMedicines];
      updated[index] = {
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantity: 1,
        unitPrice: medicine.sellingPrice,
        total: medicine.sellingPrice,
      };
      setSelectedMedicines(updated);
    }
  };

  const updateMedicineQuantity = (index: number, quantity: number) => {
    const updated = [...selectedMedicines];
    updated[index].quantity = quantity;
    updated[index].total = updated[index].unitPrice * quantity;
    setSelectedMedicines(updated);
  };

  const updateMedicinePrice = (index: number, price: number) => {
    const updated = [...selectedMedicines];
    updated[index].unitPrice = price;
    updated[index].total = price * updated[index].quantity;
    setSelectedMedicines(updated);
  };

  const updateMedicineDiscount = (index: number, discount: number) => {
    const updated = [...selectedMedicines];
    updated[index].discount = Math.min(100, Math.max(0, discount));
    setSelectedMedicines(updated);
  };

  const removeMedicine = (index: number) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index));
  };

  // Calculate totals including itemized discounts
  // Calculate totals including itemized discounts
  // Treatment totals
  const treatmentGross = selectedTreatments.reduce((sum, t) => sum + t.price, 0);
  const treatmentDiscountAmount = selectedTreatments.reduce((sum, t) => sum + (t.price * (t.discount || 0) / 100), 0);
  const treatmentNet = treatmentGross - treatmentDiscountAmount;

  // Medicine totals
  const medicineGross = selectedMedicines.reduce((sum, m) => sum + m.total, 0);
  const medicineDiscountAmount = selectedMedicines.reduce((sum, m) => sum + (m.total * (m.discount || 0) / 100), 0);
  const medicineNet = medicineGross - medicineDiscountAmount;

  const totalDiscount = treatmentDiscountAmount + medicineDiscountAmount;
  const grossTotal = treatmentGross + medicineGross;
  const finalAmount = Math.round(treatmentNet + medicineNet);
  const paid = parseFloat(amountPaid) || 0;
  const pendingAmount = finalAmount - paid;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create New Bill</h1>
        <p className="text-muted-foreground">
          Create a bill for a patient with treatments and medicines
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5 text-primary" />
            Bill Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bill Date */}
          <div>
            <label className="text-sm font-medium mb-2 block">Bill Date</label>
            <Input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="max-w-xs"
              data-testid="input-bill-date"
            />
          </div>

          {/* Patient Selection */}
          <div className="border-t pt-4">
            <label className="text-sm font-medium mb-2 block">Select Patient</label>
            {selectedPatient ? (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {selectedPatient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{selectedPatient.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedPatient.phone}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-patient-search"
                  />
                </div>
                {searchQuery && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No patients found
                      </div>
                    ) : (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setSearchQuery("");
                          }}
                          className="w-full p-3 text-left hover-elevate flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{patient.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {patient.phone}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedPatient && (
            <>
              {/* Treatments Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Treatments</label>
                  <Select onValueChange={addTreatment}>
                    <SelectTrigger className="w-48" data-testid="select-treatment">
                      <SelectValue placeholder="Add treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.name} - ₹{treatment.defaultPrice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTreatments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    No treatments added
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Treatment</TableHead>
                          <TableHead className="w-[30%]">Teeth</TableHead>
                          <TableHead className="text-right w-[15%]">Price (₹)</TableHead>
                          <TableHead className="text-right w-[10%]">Disc %</TableHead>
                          <TableHead className="text-right w-[15%]">Total (Net)</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTreatments.map((treatment, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{treatment.treatmentName}</TableCell>
                            <TableCell>
                              <Input
                                placeholder="e.g. 18, 24"
                                value={treatment.toothNumbers?.join(", ") || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = [...selectedTreatments];
                                  const numbers = val.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                  updated[index].toothNumbers = numbers;
                                  setSelectedTreatments(updated);
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                value={treatment.price}
                                onChange={(e) => updateTreatmentPrice(index, parseFloat(e.target.value) || 0)}
                                className="h-8 w-24 ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={treatment.discount || 0}
                                onChange={(e) => updateTreatmentDiscount(index, parseFloat(e.target.value) || 0)}
                                className="h-8 w-16 ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <div className="flex flex-col items-end leading-tight">
                                <span>₹{(treatment.price * (1 - (treatment.discount || 0) / 100)).toFixed(2)}</span>
                                {(treatment.discount || 0) > 0 && (
                                  <span className="text-xs text-destructive whitespace-nowrap">
                                    (-₹{(treatment.price * (treatment.discount || 0) / 100).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeTreatment(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Medicines Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Medicines</label>
                  <Button variant="outline" size="sm" onClick={addMedicine}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Medicine
                  </Button>
                </div>
                {selectedMedicines.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    No medicines added
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedMedicines.map((med, index) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={med.medicineId}
                            onValueChange={(value) => updateMedicine(index, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select medicine" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicines.map((medicine) => (
                                <SelectItem
                                  key={medicine.id}
                                  value={medicine.id}
                                  disabled={medicine.quantity === 0}
                                >
                                  {medicine.name} (Stock: {medicine.quantity})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive shrink-0"
                            onClick={() => removeMedicine(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {med.medicineId && (
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Qty</label>
                              <Input
                                type="number"
                                min="1"
                                value={med.quantity}
                                onChange={(e) =>
                                  updateMedicineQuantity(index, parseInt(e.target.value) || 1)
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Price</label>
                              <Input
                                type="number"
                                min="0"
                                value={med.unitPrice}
                                onChange={(e) =>
                                  updateMedicinePrice(index, parseFloat(e.target.value) || 0)
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Disc %</label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={med.discount || 0}
                                onChange={(e) =>
                                  updateMedicineDiscount(index, parseFloat(e.target.value) || 0)
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Total (Net)</label>
                              <div className="h-8 flex flex-col justify-center font-medium text-sm leading-tight">
                                <span>₹{(med.total * (1 - (med.discount || 0) / 100)).toFixed(2)}</span>
                                {(med.discount || 0) > 0 && (
                                  <span className="text-xs text-destructive">
                                    (-₹{(med.total * (med.discount || 0) / 100).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bill Summary */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span>Treatment Total</span>
                  <span>₹{treatmentGross.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span>Medicine Total</span>
                  <span>₹{medicineGross.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm pt-1 border-t border-dashed font-medium">
                  <span>Gross Total</span>
                  <span>₹{grossTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm text-destructive">
                  <span>Total Discount</span>
                  <span>-₹{totalDiscount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between font-semibold text-lg border-t pt-3">
                  <span>Final Amount</span>
                  <span>₹{finalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="border-t pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount Paid</label>
                    <Input
                      type="number"
                      min="0"
                      max={finalAmount}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0"
                      className="max-w-xs"
                      data-testid="input-amount-paid"
                    />
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span>₹{paid.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-semibold ${pendingAmount > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      <span>Pending Amount:</span>
                      <span>₹{pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t pt-4 flex gap-3 justify-end">
                <Button variant="outline" onClick={resetForm}>
                  Clear
                </Button>
                <Button
                  size="lg"
                  disabled={
                    createBillMutation.isPending ||
                    !selectedPatient ||
                    (selectedTreatments.length === 0 && selectedMedicines.length === 0)
                  }
                  onClick={() => createBillMutation.mutate()}
                  data-testid="button-create-bill"
                >
                  {createBillMutation.isPending ? "Creating..." : "Create Bill"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div >
  );
}
