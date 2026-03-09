import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertPatientSchema, type InsertPatient, type Patient, type Referrer, insertReferrerSchema, type InsertReferrer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { z } from "zod";
import { useState } from "react";

const registrationSchema = insertPatientSchema.extend({
  // Visit specific
  complaints: z.string().optional(), // General complaints
  diagnosis: z.string().optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

// Referrer Search Select Component
function ReferrerSelect({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newReferrerName, setNewReferrerName] = useState("");
  const [newReferrerPhone, setNewReferrerPhone] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Referrers
  const { data: referrers = [] } = useQuery<Referrer[]>({
    queryKey: ["/api/referrers"],
  });

  const filteredReferrers = referrers.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.phone && r.phone.includes(searchTerm))
  );

  const selectedReferrer = referrers.find(r => r.id === value);

  // Mutation to create referrer
  const createReferrerMutation = useMutation({
    mutationFn: async (data: InsertReferrer) => {
      const res = await apiRequest("POST", "/api/referrers", data);
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const json = await res.json();
          throw new Error(json.error || "Failed to create referrer");
        } else {
          const text = await res.text();
          throw new Error(`Server Error: ${text.slice(0, 100)}...`);
        }
      }
      return res.json();
    },
    onSuccess: (newReferrer: Referrer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrers"] });
      onChange(newReferrer.id);
      setIsDialogOpen(false);
      setNewReferrerName("");
      setNewReferrerPhone("");
      toast({
        title: "Referrer Added",
        description: `${newReferrer.name} has been added as a referrer.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add referrer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddExternalReferrer = () => {
    if (!newReferrerName) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    createReferrerMutation.mutate({
      name: newReferrerName,
      phone: newReferrerPhone,
      isPatient: false,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search referrer by name/phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="whitespace-nowrap gap-1">
              <UserPlus className="h-4 w-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Referrer</DialogTitle>
              <DialogDescription>
                Add a new referrer either from existing patients or as an external contact.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="patient" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="patient">Existing Patient</TabsTrigger>
                <TabsTrigger value="external">External</TabsTrigger>
              </TabsList>

              {/* Tab: Existing Patient */}
              <TabsContent value="patient">
                <div className="space-y-4 py-4">
                  <PatientSearchForReferral onSelect={(patient) => {
                    createReferrerMutation.mutate({
                      name: patient.name,
                      phone: patient.phone,
                      isPatient: true,
                      patientId: patient.id
                    });
                  }} />
                </div>
              </TabsContent>

              {/* Tab: External */}
              <TabsContent value="external">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <FormLabel>Name</FormLabel>
                    <Input
                      value={newReferrerName}
                      onChange={(e) => setNewReferrerName(e.target.value)}
                      placeholder="Referrer Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Phone</FormLabel>
                    <Input
                      value={newReferrerPhone}
                      onChange={(e) => setNewReferrerPhone(e.target.value)}
                      placeholder="Phone Number"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleAddExternalReferrer}
                    disabled={createReferrerMutation.isPending}
                  >
                    {createReferrerMutation.isPending ? "Adding..." : "Add External Referrer"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Select value={value || "none"} onValueChange={(val) => onChange(val === "none" ? undefined : val)}>
        <SelectTrigger>
          <SelectValue placeholder="Select referrer">
            {selectedReferrer
              ? `${selectedReferrer.name} (${selectedReferrer.isPatient ? 'Patient' : 'External'})`
              : "Select referrer..."}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None (No referral)</SelectItem>
          {filteredReferrers.map((referrer) => (
            <SelectItem key={referrer.id} value={referrer.id}>
              {referrer.name} {referrer.phone ? `(${referrer.phone})` : ''} - {referrer.isPatient ? 'Patient' : 'External'}
            </SelectItem>
          ))}
          {searchTerm && filteredReferrers.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No referrers found. Click "Add New" to create one.
            </div>
          )}
          {!searchTerm && filteredReferrers.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No referrers available. Please add a referrer.
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// Helper component for searching patients inside the dialog
function PatientSearchForReferral({ onSelect }: { onSelect: (patient: Patient) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  // Search for patients (default to first 5 if no search term)
  const { data } = useQuery<{ data: Patient[] }>({
    queryKey: ["/api/patients", { search: searchTerm, limit: 5 }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "5" });
      if (searchTerm) params.append("search", searchTerm);
      const res = await apiRequest("GET", `/api/patients?${params.toString()}`);
      return res.json();
    },
    // Always enabled to show recent patients by default
  });

  return (
    <div className="space-y-2">
      <FormLabel>Search Patient</FormLabel>
      <div className="flex gap-2">
        <Input
          placeholder="Type to search or select from recent..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button variant="secondary" size="icon" disabled>
          <SearchIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="border rounded-md max-h-[200px] overflow-y-auto">
        {data?.data && data.data.length > 0 ? (
          data.data.map(p => (
            <div
              key={p.id}
              className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
              onClick={() => onSelect(p)}
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.phone}</div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchTerm ? "No patients found" : "No recent patients found"}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple search icon component if needed, or import Search from lucide-react
function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

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
      referredByReferrerId: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegistrationForm) => {
      const patientData: InsertPatient = {
        name: data.name,
        phone: data.phone,
        registrationDate: data.registrationDate,
        referredByReferrerId: data.referredByReferrerId,
      };

      const patientResponse = await apiRequest("POST", "/api/patients", patientData);
      const patient = await patientResponse.json();

      // Create initial visit
      await apiRequest("POST", "/api/visits", {
        patientId: patient.id,
        date: data.registrationDate,
        complaints: data.complaints || "Initial Registration",
        diagnosis: data.diagnosis,
      });

      return patient;
    },
    onSuccess: (patient) => {
      toast({
        title: "Patient Registered",
        description: `${patient.name} has been successfully registered.`,
      });
      // Wait for queries to refetch before navigating so Today's Patients updates immediately
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/patients"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/visits"], refetchType: 'all' }),
      ]).then(() => {
        setLocation("/");
      });
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
          Register a new patient with their therapy history and initial details
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

              <FormField
                control={form.control}
                name="complaints"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Complaints</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter patient's complaints..."
                        className="min-h-[80px] resize-none"
                        {...field}
                        data-testid="input-complaints"
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
                  <FormItem className="md:col-span-2">
                    <FormLabel>Diagnosis</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter diagnosis..."
                        className="min-h-[80px] resize-none"
                        {...field}
                        data-testid="input-diagnosis"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* REFERRAL INFORMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="w-5 h-5 text-primary" />
                Referral Information (Optional)
              </CardTitle>
              <CardDescription>
                If this patient was referred by an existing patient, select them below. The referring patient will receive 5% of this patient's first bill as credit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="referredByReferrerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referred By (Patient or External)</FormLabel>
                    <FormControl>
                      <ReferrerSelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Search for an existing referrer or add a new one. The referrer will receive credit for this patient's first bill.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
