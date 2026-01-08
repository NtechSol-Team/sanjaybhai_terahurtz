import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { UserPlus, Calendar, Phone, User, FileText, Stethoscope, Activity, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertPatientSchema, type InsertPatient, CHIEF_DENTAL_COMPLAINTS, HABIT_HISTORY_OPTIONS } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { z } from "zod";

const registrationSchema = insertPatientSchema.extend({
  // Dental specific fields from schema are already optional but we might want to enforce some logic here
  chiefDentalComplaint: z.string().optional(),
  dentalHistory: z.string().optional(),
  habitHistory: z.string().optional(), // We'll handle this as a joined string from checkboxes
  allergies: z.string().optional(),
  lastDentalVisitDate: z.string().optional(),
  // Visit specific
  complaints: z.string().optional(), // General complaints
  diagnosis: z.string().optional(),
  selectedHabits: z.array(z.string()).optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema> & {
  selectedHabits: string[]; // Helper for UI
};

export default function Registration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      phone: "",
      registrationDate: format(new Date(), "yyyy-MM-dd"),
      complaints: "",
      diagnosis: "",
      chiefDentalComplaint: "",
      dentalHistory: "",
      habitHistory: "",
      selectedHabits: [],
      allergies: "",
      lastDentalVisitDate: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegistrationForm) => {
      // transform selectedHabits to comma-separated string if habitHistory is empty
      const selectedHabits = data.selectedHabits || [];
      const habitString = selectedHabits.length > 0 ? selectedHabits.join(", ") : data.habitHistory;

      const patientData: InsertPatient = {
        name: data.name,
        phone: data.phone,
        registrationDate: data.registrationDate,
        chiefDentalComplaint: data.chiefDentalComplaint || undefined,
        dentalHistory: data.dentalHistory || undefined,
        habitHistory: habitString || undefined,
        allergies: data.allergies || undefined,
        lastDentalVisitDate: data.lastDentalVisitDate || undefined,
      };

      const patientResponse = await apiRequest("POST", "/api/patients", patientData);
      const patient = await patientResponse.json();

      // Create initial visit
      await apiRequest("POST", "/api/visits", {
        patientId: patient.id,
        date: data.registrationDate,
        complaints: data.chiefDentalComplaint || data.complaints || "Initial Registration", // Priority to dental complaint
        diagnosis: data.diagnosis,
      });

      return patient;
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      toast({
        title: "Patient Registered",
        description: `${patient.name} has been successfully registered.`,
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegistrationForm) => {
    mutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          New Patient Registration
        </h1>
        <p className="text-muted-foreground">
          Register a new patient with their dental history and initial details
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* PERSONAL INFO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="w-5 h-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} data-testid="input-patient-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="10-digit number" type="tel" {...field} data-testid="input-patient-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registrationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-registration-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* DENTAL HISTORY */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Dental & Medical History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="chiefDentalComplaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chief Complaint</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select primary complaint" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHIEF_DENTAL_COMPLAINTS.map((complaint) => (
                            <SelectItem key={complaint} value={complaint}>
                              {complaint}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Main reason for visiting</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastDentalVisitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Dental Visit</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dentalHistory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Past Dental History (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Previous treatments (RCT, Extractions, etc.)..."
                        className="resize-none"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      Allergies & Medical Conditions (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Drug allergies (Local Anesthesia, Antibiotics), BP, Diabetes..."
                        className="resize-none border-red-200 focus-visible:ring-red-500"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>Habits</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {HABIT_HISTORY_OPTIONS.map((habit) => (
                    <FormField
                      key={habit}
                      control={form.control}
                      name="selectedHabits"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={habit}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(habit)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, habit])
                                    : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== habit
                                      )
                                    )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {habit}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>

          {/* INITIAL VISIT */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="w-5 h-5 text-primary" />
                Initial Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provisional Diagnosis</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Initial diagnosis based on examination..."
                          className="min-h-[100px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-testid="button-register"
              className="px-8"
            >
              {mutation.isPending ? "Registering..." : "Register Patient"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
