import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
    Plus,
    Check,
    Play,
    AlertCircle,
    Stethoscope,
    ChevronRight,
    FileText
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { extractPaginatedData } from "@/lib/utils";
import type { Treatment, TreatmentSitting, InsertTreatmentSitting } from "@shared/schema";
import { SITTING_STATUSES } from "@shared/schema";

interface TreatmentProgressProps {
    patientId: string;
}

export function TreatmentProgress({ patientId }: TreatmentProgressProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>("");

    // For marking sitting complete dialog
    const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
    const [completingSitting, setCompletingSitting] = useState<TreatmentSitting | null>(null);
    const [sittingNotes, setSittingNotes] = useState("");

    // Fetch treatments for selection
    const { data: treatmentsRaw } = useQuery({
        queryKey: ["/api/treatments"],
    });
    const treatments = extractPaginatedData<Treatment>(treatmentsRaw);

    // Debug: log treatments to see numberOfSittings values
    console.log("Treatments data:", treatments.map(t => ({ id: t.id, name: t.name, numberOfSittings: t.numberOfSittings })));

    // Fetch active treatment sittings
    const { data: sittings = [], isLoading } = useQuery<TreatmentSitting[]>({
        queryKey: ["/api/patients", patientId, "treatment-sittings"],
        enabled: !!patientId,
    });

    const startTreatmentMutation = useMutation({
        mutationFn: async (treatmentId: string) => {
            const treatment = treatments.find((t) => t.id === treatmentId);
            if (!treatment) throw new Error("Treatment not found");

            const newSitting: InsertTreatmentSitting = {
                patientId,
                treatmentId,
                treatmentName: treatment.name,
                totalSittings: treatment.numberOfSittings,
                completedSittings: 0,
                status: "Planned",
                startDate: format(new Date(), "yyyy-MM-dd"),
                sittingDetails: [],
                toothNumbers: [], // Can be enhanced to select teeth later
            };

            return await apiRequest("POST", "/api/treatment-sittings", newSitting);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatment-sittings"] });
            toast({
                title: "Treatment Started",
                description: "New treatment plan has been initiated.",
            });
            setIsStartDialogOpen(false);
            setSelectedTreatmentId("");
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Start",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const updateProgressMutation = useMutation({
        mutationFn: async ({ sitting, notes }: { sitting: TreatmentSitting; notes: string }) => {
            const isComplete = sitting.completedSittings + 1 >= sitting.totalSittings;

            // Send only the fields that are changing - server merges with existing data
            const updatePayload = {
                completedSittings: sitting.completedSittings + 1,
                status: isComplete ? "Completed" : "InProgress",
                sittingDetails: [
                    ...(sitting.sittingDetails || []),
                    {
                        sittingNumber: sitting.completedSittings + 1,
                        date: format(new Date(), "yyyy-MM-dd"),
                        status: "Completed" as const,
                        notes: notes || "Routine update",
                    },
                ],
                lastVisitDate: format(new Date(), "yyyy-MM-dd"),
            };

            return await apiRequest("PATCH", `/api/treatment-sittings/${sitting.id}`, updatePayload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "treatment-sittings"] });
            toast({
                title: "Progress Updated",
                description: "Treatment sitting recorded.",
            });
            setIsCompleteDialogOpen(false);
            setCompletingSitting(null);
            setSittingNotes("");
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const openCompleteDialog = (sitting: TreatmentSitting) => {
        setCompletingSitting(sitting);
        setSittingNotes("");
        setIsCompleteDialogOpen(true);
    };

    const handleMarkComplete = () => {
        if (!completingSitting) return;
        updateProgressMutation.mutate({ sitting: completingSitting, notes: sittingNotes });
    };

    const activeSittings = sittings.filter(s => s.status !== "Completed" && s.status !== "Cancelled");
    const completedSittings = sittings.filter(s => s.status === "Completed");

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    Ongoing Treatments
                </h3>
                <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Start New Treatment
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Start New Treatment Plan</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Treatment</label>
                                <Select value={selectedTreatmentId} onValueChange={setSelectedTreatmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose treatment..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {treatments.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name} ({t.numberOfSittings} sittings)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={() => startTreatmentMutation.mutate(selectedTreatmentId)}
                                disabled={!selectedTreatmentId || startTreatmentMutation.isPending}
                                className="w-full"
                            >
                                {startTreatmentMutation.isPending ? "Starting..." : "Start Treatment"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {activeSittings.length === 0 ? (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-muted-foreground mb-4">No active treatments found.</p>
                        <Button variant="outline" size="sm" onClick={() => setIsStartDialogOpen(true)}>
                            Start a treatment plan
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {activeSittings.map((sitting) => (
                        <Card key={sitting.id} className="border-l-4" style={{
                            borderLeftColor: sitting.status === "InProgress" ? "#3b82f6" :
                                sitting.status === "Planned" ? "#f59e0b" : "#22c55e"
                        }}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{sitting.treatmentName}</CardTitle>
                                        <CardDescription>
                                            Started on {isValid(new Date(sitting.startDate)) ? format(new Date(sitting.startDate), "dd MMM yyyy") : "N/A"}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={sitting.status === "InProgress" ? "default" : "secondary"}>
                                        {sitting.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span>Progress</span>
                                            <span className="text-muted-foreground">
                                                {sitting.completedSittings} / {sitting.totalSittings} sittings
                                            </span>
                                        </div>
                                        <Progress value={sitting.totalSittings > 0 ? (sitting.completedSittings / sitting.totalSittings) * 100 : 0} />
                                    </div>

                                    {/* Show sitting history if any */}
                                    {sitting.sittingDetails && sitting.sittingDetails.length > 0 && (
                                        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                <FileText className="w-4 h-4" />
                                                Sitting History
                                            </div>
                                            <div className="space-y-1">
                                                {sitting.sittingDetails.map((detail, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span>Sitting {detail.sittingNumber}: {detail.date}</span>
                                                        <span className="text-muted-foreground">{detail.notes}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => openCompleteDialog(sitting)}
                                            disabled={updateProgressMutation.isPending}
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Mark Sitting Complete
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {completedSittings.length > 0 && (
                <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Completed Treatments</h4>
                    <div className="space-y-2">
                        {completedSittings.map((sitting) => (
                            <details key={sitting.id} className="group">
                                <summary className="flex items-center justify-between text-sm p-3 bg-muted/20 rounded-lg border border-l-4 border-l-green-500 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                                        <span className="font-medium">{sitting.treatmentName}</span>
                                        <span className="text-muted-foreground">
                                            ({sitting.completedSittings}/{sitting.totalSittings} sittings)
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        Completed
                                    </Badge>
                                </summary>
                                <div className="ml-6 mt-2 p-3 bg-muted/10 rounded-lg border space-y-3">
                                    {/* Sitting Details */}
                                    {sitting.sittingDetails && sitting.sittingDetails.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                <FileText className="w-4 h-4" />
                                                Sitting History
                                            </div>
                                            <div className="space-y-1">
                                                {sitting.sittingDetails.map((detail, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm bg-background/50 p-2 rounded">
                                                        <span>Sitting {detail.sittingNumber}: {detail.date}</span>
                                                        <span className="text-muted-foreground">{detail.notes || "No notes"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Treatment Info */}
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Started:</span>{" "}
                                            {sitting.startDate}
                                        </div>
                                        {sitting.lastVisitDate && (
                                            <div>
                                                <span className="text-muted-foreground">Last Visit:</span>{" "}
                                                {sitting.lastVisitDate}
                                            </div>
                                        )}
                                    </div>

                                    {sitting.notes && (
                                        <div className="text-sm">
                                            <span className="text-muted-foreground">Notes:</span> {sitting.notes}
                                        </div>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            )}

            {/* Mark Complete Dialog */}
            <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mark Sitting Complete</DialogTitle>
                    </DialogHeader>
                    {completingSitting && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="font-medium">{completingSitting.treatmentName}</p>
                                <p className="text-sm text-muted-foreground">
                                    This will mark sitting {completingSitting.completedSittings + 1} of {completingSitting.totalSittings} as complete
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sitting-notes">Description / Notes (Optional)</Label>
                                <Textarea
                                    id="sitting-notes"
                                    placeholder="Add any notes about this sitting..."
                                    value={sittingNotes}
                                    onChange={(e) => setSittingNotes(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsCompleteDialogOpen(false);
                                        setCompletingSitting(null);
                                        setSittingNotes("");
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleMarkComplete}
                                    disabled={updateProgressMutation.isPending}
                                >
                                    {updateProgressMutation.isPending ? "Saving..." : "Mark Complete"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
