import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Calendar as CalendarIcon,
    Plus,
    Search,
    Edit2,
    Trash2,
    User,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Patient } from "@shared/schema";
import { extractPaginatedData } from "@/lib/utils";
import { insertAppointmentSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { z } from "zod";

const appointmentFormSchema = insertAppointmentSchema;
type AppointmentForm = z.infer<typeof appointmentFormSchema>;

export default function AppointmentMaster() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [deletingAppointment, setDeletingAppointment] = useState<Appointment | null>(null);

    const { data: appointmentsResponse, isLoading } = useQuery({
        queryKey: ["/api/appointments"],
    });
    // Since api returns array directly based on my implementation
    const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : [];

    // Fetch all patients for selection dropdowns
    const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
        queryKey: ["/api/patients", { limit: 10000 }],
        queryFn: async () => {
            const res = await fetch("/api/patients?limit=10000");
            if (!res.ok) throw new Error("Failed to fetch patients");
            return res.json();
        },
    });
    const patients = extractPaginatedData<Patient>(patientsResponse);

    const form = useForm<AppointmentForm>({
        resolver: zodResolver(appointmentFormSchema),
        defaultValues: {
            patientId: "",
            date: format(new Date(), "yyyy-MM-dd"),
            reason: "",
            status: "Scheduled",
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: AppointmentForm) => {
            return await apiRequest("POST", "/api/appointments", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Scheduled",
                description: "New appointment has been successfully created.",
            });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Schedule",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: AppointmentForm }) => {
            return await apiRequest("PATCH", `/api/appointments/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Updated",
                description: "Appointment details have been updated.",
            });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Update",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await apiRequest("DELETE", `/api/appointments/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
            toast({
                title: "Appointment Cancelled",
                description: "Appointment has been removed.",
            });
            setDeletingAppointment(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Delete",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingAppointment(null);
        form.reset({
            patientId: "",
            date: format(new Date(), "yyyy-MM-dd"),
            reason: "",
            status: "Scheduled",
        });
    };

    const openEditDialog = (appointment: Appointment) => {
        setEditingAppointment(appointment);
        form.reset({
            patientId: appointment.patientId,
            date: appointment.date,
            reason: appointment.reason,
            status: appointment.status as "Scheduled" | "Completed" | "Cancelled",
        });
        setIsDialogOpen(true);
    };

    const onSubmit = (data: AppointmentForm) => {
        // If we're creating a new appointment, valid patient is required
        if (!editingAppointment && !patients.find(p => p.id === data.patientId)) {
            toast({
                title: "Invalid Patient",
                description: "Please select a valid patient from the list.",
                variant: "destructive",
            });
            return;
        }

        if (editingAppointment) {
            updateMutation.mutate({ id: editingAppointment.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const filteredAppointments = appointments.filter((appt: Appointment) => {
        const patientName = appt.patientName || patients.find(p => p.id === appt.patientId)?.name || "";
        const matchesSearch = (
            patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            appt.reason.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Filter out past appointments (date < today)
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const isUpcoming = appt.date >= todayStr;

        return matchesSearch && isUpcoming;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Scheduled":
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Scheduled</Badge>;
            case "Completed":
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Completed</Badge>;
            case "Cancelled":
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // WhatsApp message generation and sending
    const sendWhatsAppMessage = (appointment: Appointment, patient: Patient | undefined) => {
        if (!patient?.phone) {
            toast({
                title: "Phone number missing",
                description: "Cannot send WhatsApp message - patient phone number is not available.",
                variant: "destructive",
            });
            return;
        }

        // Clean phone number (remove spaces, dashes) and add India country code
        const cleanPhone = patient.phone.replace(/[\s-]/g, "");
        const phoneWithCountryCode = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

        // Format date nicely
        const formattedDate = format(new Date(appointment.date), "dd MMMM yyyy");

        // Clinic settings (configurable defaults)
        const clinicName = "TeraCare"; // TODO: Make configurable from system settings
        const arriveMinutes = 10; // TODO: Make configurable

        // Generate message
        const message = `Hello ${patient.name},

Your appointment has been confirmed for ${formattedDate} at ${clinicName}.
Please arrive ${arriveMinutes} minutes early.

Reason: ${appointment.reason || "General Checkup"}

We look forward to seeing you!

Warm regards,
${clinicName}`;

        // URL encode the message and create wa.me link
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodedMessage}`;

        // Open in new tab without page reload
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    };

    // Helper to get patient phone for an appointment
    const getPatientPhone = (appointment: Appointment): string | undefined => {
        const patient = patients.find(p => p.id === appointment.patientId);
        return patient?.phone;
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Upcoming Appointment Master
                </h1>
                <p className="text-muted-foreground">
                    Manage patient appointments and schedules
                </p>
            </div>

            {/* Today's Appointment Module - Highlighted */}
            <Card className="border-l-4 border-l-blue-600 shadow-md">
                <CardHeader className="pb-3 bg-blue-50/50">
                    <CardTitle className="text-lg font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-blue-600" />
                            Today's Appointments ({appointments.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).length})
                        </div>
                        <Badge variant={appointments.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).length > 0 ? "default" : "secondary"}>
                            {appointments.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).length > 0 ? "Action Required" : "No Appointments"}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {appointments.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                            No appointments scheduled for today.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {appointments.filter(a => a.date === format(new Date(), "yyyy-MM-dd")).map((appt) => (
                                <div key={appt.id} className="p-3 border rounded-md bg-card flex flex-col gap-2 shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="font-medium">
                                            {appt.patientName || patients.find(p => p.id === appt.patientId)?.name || "Unknown Patient"}
                                        </div>
                                        <Badge variant="outline" className={
                                            appt.status === "Scheduled" ? "bg-blue-50 text-blue-700" :
                                                appt.status === "Completed" ? "bg-green-50 text-green-700" : "bg-gray-100"
                                        }>{appt.status}</Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate" title={appt.reason}>
                                        {appt.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarIcon className="w-5 h-5 text-primary" />
                            All Appointments
                        </CardTitle>
                        <div className="flex items-center gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search patient or reason..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
                                <DialogTrigger asChild>
                                    <Button onClick={() => setIsDialogOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Appointment
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            {editingAppointment ? "Edit Appointment" : "Schedule New Appointment"}
                                        </DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                                            <FormField
                                                control={form.control}
                                                name="patientId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Patient</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                            disabled={!!editingAppointment} // Disable changing patient on edit
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={patientsLoading ? "Loading..." : "Select Patient"} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {patients.map((patient) => (
                                                                    <SelectItem key={patient.id} value={patient.id}>
                                                                        {patient.name} ({patient.phone})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="reason"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Reason for Visit</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="e.g. Regular Checkup, Follow-up"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Date</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="status"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Status</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select status" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                                                <SelectItem value="Completed">Completed</SelectItem>
                                                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex justify-end gap-3 pt-2">
                                                <Button type="button" variant="outline" onClick={closeDialog}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={createMutation.isPending || updateMutation.isPending}
                                                >
                                                    {createMutation.isPending || updateMutation.isPending
                                                        ? "Saving..."
                                                        : editingAppointment
                                                            ? "Update"
                                                            : "Schedule"}
                                                </Button>
                                            </div>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="text-center py-12">
                            <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-1">No appointments found</h3>
                            <p className="text-muted-foreground text-sm">
                                Schedule your first appointment
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Patient</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAppointments.map((appt: Appointment) => (
                                        <TableRow key={appt.id}>
                                            <TableCell className="font-medium">
                                                {format(new Date(appt.date), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {appt.patientName || "Unknown Patient"}
                                                </div>
                                            </TableCell>
                                            <TableCell>{appt.reason}</TableCell>
                                            <TableCell>{getStatusBadge(appt.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    onClick={() => sendWhatsAppMessage(appt, patients.find(p => p.id === appt.patientId))}
                                                                    disabled={!getPatientPhone(appt)}
                                                                >
                                                                    <MessageCircle className="w-4 h-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{getPatientPhone(appt) ? "Send WhatsApp Message" : "Phone number missing"}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditDialog(appt)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        onClick={() => setDeletingAppointment(appt)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deletingAppointment} onOpenChange={() => setDeletingAppointment(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this appointment for {deletingAppointment?.patientName}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => deletingAppointment && deleteMutation.mutate(deletingAppointment.id)}
                        >
                            {deleteMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
