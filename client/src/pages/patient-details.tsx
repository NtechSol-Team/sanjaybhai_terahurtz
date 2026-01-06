import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Phone,
  Calendar,
  FileText,
  Stethoscope,
  Plus,
  User,
  Pencil,
  X,
  Check,
  Trash2,
  Activity,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Patient, Visit, ToothRecord } from "@shared/schema";
import { insertVisitSchema, insertPatientSchema, TOOTH_CONDITIONS } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format, isValid } from "date-fns";
import { z } from "zod";
import { ToothChart } from "@/components/dental/tooth-chart";
import { TreatmentProgress } from "@/components/dental/treatment-progress";
import { DentalPrescription } from "@/components/dental/prescription";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const addVisitSchema = z.object({
  date: z.string(),
  complaints: z.string().min(1, "Complaints are required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
});

const updateToothSchema = z.object({
  condition: z.enum(TOOTH_CONDITIONS), // Requires strict typing from schema
  notes: z.string().optional(),
});

type AddVisitForm = z.infer<typeof addVisitSchema>;
type UpdateToothForm = z.infer<typeof updateToothSchema>;

export default function PatientDetails() {
  const [, params] = useRoute("/patient/:id");
  const patientId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [, setLocation] = useRoute("/patient/:id"); // Used for navigation after delete

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  const { data: visits = [], isLoading: visitsLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits", patientId],
    enabled: !!patientId,
  });

  const { data: toothRecords = [], isLoading: toothRecordsLoading } = useQuery<ToothRecord[]>({
    queryKey: ["/api/patients", patientId, "tooth-records"],
    enabled: !!patientId,
  });

  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const form = useForm<AddVisitForm>({
    resolver: zodResolver(addVisitSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      complaints: "",
      diagnosis: "",
    },
  });

  const toothForm = useForm<UpdateToothForm>({
    resolver: zodResolver(updateToothSchema),
    defaultValues: {
      condition: "Healthy",
      notes: "",
    }
  });

  const patientForm = useForm<z.infer<typeof insertPatientSchema>>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: {
      name: patient?.name || "",
      phone: patient?.phone || "",
      registrationDate: patient?.registrationDate || format(new Date(), "yyyy-MM-dd"),
      chiefDentalComplaint: patient?.chiefDentalComplaint || "",
      dentalHistory: patient?.dentalHistory || "",
      habitHistory: patient?.habitHistory || "",
      allergies: patient?.allergies || "",
      lastDentalVisitDate: patient?.lastDentalVisitDate || "",
    },
  });

  // Sync form with patient data when it loads or dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (patient && isEditingPatient && !patientForm.formState.isDirty) {
      patientForm.reset({
        name: patient.name,
        phone: patient.phone,
        registrationDate: patient.registrationDate,
        chiefDentalComplaint: patient.chiefDentalComplaint || "",
        dentalHistory: patient.dentalHistory || "",
        habitHistory: patient.habitHistory || "",
        allergies: patient.allergies || "",
        lastDentalVisitDate: patient.lastDentalVisitDate || "",
      });
    }
  }, [patient, isEditingPatient]);

  const editForm = useForm<AddVisitForm>({
    resolver: zodResolver(addVisitSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      complaints: "",
      diagnosis: "",
    },
  });

  const addVisitMutation = useMutation({
    mutationFn: async (data: AddVisitForm) => {
      return await apiRequest("POST", "/api/visits", {
        patientId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", patientId] });
      toast({
        title: "Visit Added",
        description: "New visit has been recorded successfully.",
      });
      setIsDialogOpen(false);
      form.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        complaints: "",
        diagnosis: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Visit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertPatientSchema>) => {
      return await apiRequest("PATCH", `/api/patients/${patientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Patient Updated",
        description: "Patient information has been updated successfully.",
      });
      setIsEditingPatient(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  const updateVisitMutation = useMutation({
    mutationFn: async (data: AddVisitForm) => {
      if (!patientId || !editingVisit) throw new Error("No visit selected");
      return await apiRequest("PATCH", `/api/visits/${editingVisit.id}`, {
        patientId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits", patientId] });
      toast({
        title: "Visit Updated",
        description: "Visit details have been updated successfully.",
      });
      handleEditDialogChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Visit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateToothMutation = useMutation({
    mutationFn: async (data: UpdateToothForm) => {
      if (!patientId || !selectedTooth) throw new Error("No tooth selected");

      // Calculate quadrant based on FDI
      const q = Math.floor(selectedTooth / 10);
      let quadrant = "UR";
      if (q === 2 || q === 6) quadrant = "UL";
      if (q === 3 || q === 7) quadrant = "LL";
      if (q === 4 || q === 8) quadrant = "LR";

      return await apiRequest("POST", "/api/tooth-records", {
        patientId,
        toothNumber: selectedTooth,
        quadrant,
        condition: data.condition,
        notes: data.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "tooth-records"] });
      toast({
        title: "Tooth Record Updated",
        description: `Tooth ${selectedTooth} has been updated.`,
      });
      setSelectedTooth(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Tooth",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePatientMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });

      toast({
        title: "Patient Deleted",
        description: "Patient and all associated records have been deleted.",
      });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Patient",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (visit: Visit) => {
    setEditingVisit(visit);
    editForm.reset({
      date: visit.date,
      complaints: visit.complaints,
      diagnosis: visit.diagnosis,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingVisit(null);
    }
  };

  const handleToothClick = (toothId: number) => {
    setSelectedTooth(toothId);
    // Pre-fill if record exists
    const record = toothRecords.find(r => r.toothNumber === toothId);
    if (record) {
      toothForm.reset({
        condition: record.condition as any,
        notes: record.notes || ""
      });
    } else {
      toothForm.reset({
        condition: "Healthy",
        notes: ""
      });
    }
  };

  const sortedVisits = [...visits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (patientLoading || visitsLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">Patient Not Found</h3>
          <p className="text-muted-foreground text-sm mb-4">
            The patient you're looking for doesn't exist.
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          {isEditingPatient ? (
            <div className="flex-1">
              <Form {...patientForm}>
                <form
                  onSubmit={patientForm.handleSubmit((data) =>
                    updatePatientMutation.mutate(data)
                  )}
                  className="space-y-3"
                >
                  <FormField
                    control={patientForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Patient name"
                            {...field}
                            className="text-2xl font-semibold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={patientForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updatePatientMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {updatePatientMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingPatient(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  data-testid="text-patient-name"
                >
                  {patient?.name}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    patientForm.reset({
                      name: patient?.name || "",
                      phone: patient?.phone || "",
                      registrationDate:
                        patient?.registrationDate || format(new Date(), "yyyy-MM-dd"),
                    });
                    setIsEditingPatient(true);
                  }}
                  data-testid="button-edit-patient"
                >
                  <Pencil className="w-4 h-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid="button-delete-patient"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the patient
                        <strong> {patient?.name}</strong> and all their associated visits,
                        bills, and records from the database.
                        <br /><br />
                        Any paid amounts will also be removed from revenue reports.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deletePatientMutation.mutate()}
                      >
                        {deletePatientMutation.isPending ? "Deleting..." : "Delete Patient"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {patient?.phone}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Registered: {patient?.registrationDate ? (isValid(new Date(patient.registrationDate)) ? format(new Date(patient.registrationDate), "dd MMM yyyy") : "N/A") : "N/A"}
                </span>
                {patient.lastDentalVisitDate && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Clock className="w-3 h-3" />
                      Last Dental Visit: {isValid(new Date(patient.lastDentalVisitDate)) ? format(new Date(patient.lastDentalVisitDate), "dd MMM yyyy") : "N/A"}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="visits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="visits" className="flex gap-2">
            <FileText className="w-4 h-4" />
            Visits & History
          </TabsTrigger>
          <TabsTrigger value="treatments" className="flex gap-2">
            <Stethoscope className="w-4 h-4" />
            Treatments
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex gap-2">
            <Activity className="w-4 h-4" />
            Dental Chart
          </TabsTrigger>
          <TabsTrigger value="prescription" className="flex gap-2">
            <FileText className="w-4 h-4" />
            Prescription
          </TabsTrigger>
        </TabsList>

        <TabsContent value="treatments">
          {patientId && <TreatmentProgress patientId={patientId} />}
        </TabsContent>

        <TabsContent value="prescription">
          {patientId && <DentalPrescription patientId={patientId} />}
        </TabsContent>

        <TabsContent value="visits" className="space-y-6">
          {/* DENTAL HISTORY SUMMARY CARD */}
          {(patient.chiefDentalComplaint || patient.dentalHistory || patient.habitHistory || patient.allergies) && (
            <Card className="bg-muted/10 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Dental & Medical Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                {patient.chiefDentalComplaint && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">Chief Complaint</span>
                    {patient.chiefDentalComplaint}
                  </div>
                )}
                {patient.allergies && (
                  <div className="text-red-600">
                    <span className="font-semibold block mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Allergies
                    </span>
                    {patient.allergies}
                  </div>
                )}
                {patient.habitHistory && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">Habits</span>
                    {patient.habitHistory}
                  </div>
                )}
                {patient.dentalHistory && (
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">Past History</span>
                    {patient.dentalHistory}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Dialog open={isEditingPatient} onOpenChange={setIsEditingPatient}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Dental & Medical Profile</DialogTitle>
                </DialogHeader>
                <Form {...patientForm}>
                  <form onSubmit={patientForm.handleSubmit((data) => {
                    const updatedData = { ...data };
                    // Ensure undefined for empty strings to match strict schema if needed,
                    // but for updatePatient type it likely accepts nulls.
                    // We'll just pass data and let backend handle it, or clean it up.
                    // apiRequest("PATCH", `/api/patients/${patientId}`, updatedData)
                    updatePatientMutation.mutate(updatedData);
                    // .then(() => {
                    //   queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
                    //   toast({ title: "Profile Updated", description: "Patient details updated successfully." });
                    //   setIsEditingPatient(false);
                    // })
                    // .catch((err) => {
                    //   toast({ title: "Update Failed", description: err.message, variant: "destructive" });
                    // });
                  })} className="space-y-4">

                    {/* Name, Phone, Date removed as per user request */}

                    <FormField
                      control={patientForm.control}
                      name="chiefDentalComplaint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chief Complaint</FormLabel>
                          <FormControl>
                            {/* changed to Input for full editability */}
                            <Input {...field} value={field.value || ""} placeholder="e.g. Tooth pain, Sensitivity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={patientForm.control}
                      name="dentalHistory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dental History</FormLabel>
                          <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={patientForm.control}
                      name="habitHistory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Habits</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="Tobacco, Smoking, etc." /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={patientForm.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allergies & Medical</FormLabel>
                          <FormControl><Textarea {...field} value={field.value || ""} placeholder="Drug allergies, medical conditions..." /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit">Save Changes</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">Visit History</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {sortedVisits.length} visit{sortedVisits.length !== 1 ? "s" : ""} recorded
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-visit">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Visit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add New Visit</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((data) => addVisitMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visit Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-visit-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="complaints"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complaints</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter patient's complaints..."
                                className="min-h-[80px] resize-none"
                                {...field}
                                data-testid="input-visit-complaints"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="diagnosis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diagnosis</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter diagnosis..."
                                className="min-h-[80px] resize-none"
                                {...field}
                                data-testid="input-visit-diagnosis"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={addVisitMutation.isPending}
                          data-testid="button-save-visit"
                        >
                          {addVisitMutation.isPending ? "Saving..." : "Save Visit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {sortedVisits.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No visits recorded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedVisits.map((visit, index) => (
                    <div
                      key={visit.id}
                      className="relative pl-6 pb-6 last:pb-0 border-l-2 border-border last:border-transparent"
                      data-testid={`card-visit-${visit.id}`}
                    >
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium">
                              {format(new Date(visit.date), "dd MMM yyyy")}
                            </span>
                            <Badge variant="secondary">
                              {sortedVisits.length - index === 1 ? "1st" :
                                sortedVisits.length - index === 2 ? "2nd" :
                                  sortedVisits.length - index === 3 ? "3rd" :
                                    `${sortedVisits.length - index}th`} Visit
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => openEditDialog(visit)}
                            data-testid={`button-edit-visit-${visit.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                              <FileText className="w-4 h-4" />
                              Complaints
                            </div>
                            <p className="text-sm" data-testid={`text-complaints-${visit.id}`}>
                              {visit.complaints}
                            </p>
                          </div>

                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                              <Stethoscope className="w-4 h-4" />
                              Diagnosis
                            </div>
                            <p className="text-sm" data-testid={`text-diagnosis-${visit.id}`}>
                              {visit.diagnosis}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <ToothChart
            records={toothRecords}
            onToothClick={handleToothClick}
            className="bg-card"
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Visit</DialogTitle>
          </DialogHeader>
          {editingVisit ? (
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((data) => updateVisitMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-visit-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="complaints"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complaints</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Update patient's complaints..."
                          className="min-h-[80px] resize-none"
                          {...field}
                          data-testid="input-edit-visit-complaints"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diagnosis</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Update diagnosis..."
                          className="min-h-[80px] resize-none"
                          {...field}
                          data-testid="input-edit-visit-diagnosis"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleEditDialogChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateVisitMutation.isPending}
                    data-testid="button-save-visit-edit"
                  >
                    {updateVisitMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <p className="text-sm text-muted-foreground">Select a visit to edit.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedTooth} onOpenChange={(open) => !open && setSelectedTooth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tooth {selectedTooth}</DialogTitle>
          </DialogHeader>
          <Form {...toothForm}>
            <form onSubmit={toothForm.handleSubmit((data) => updateToothMutation.mutate(data))} className="space-y-4">
              <FormField
                control={toothForm.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TOOTH_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={toothForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add notes about this tooth..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedTooth(null)}>Cancel</Button>
                <Button type="submit" disabled={updateToothMutation.isPending}>
                  {updateToothMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div >
  );
}
