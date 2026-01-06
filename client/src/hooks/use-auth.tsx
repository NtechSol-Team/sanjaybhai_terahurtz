import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, LoginInput } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    error: Error | null;
    loginMutation: ReturnType<typeof useMutation<User, Error, LoginInput>>;
    logoutMutation: ReturnType<typeof useMutation<void, Error, void>>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const {
        data: user,
        error,
        isLoading,
    } = useQuery<User | null, Error>({
        queryKey: ["/api/user"],
        queryFn: getQueryFn({ on401: "returnNull" }),
    });

    const loginMutation = useMutation({
        mutationFn: async (credentials: LoginInput) => {
            const res = await apiRequest("POST", "/api/login", credentials);
            return await res.json();
        },
        onSuccess: (user: User) => {
            queryClient.setQueryData(["/api/user"], user);
            toast({
                title: "Welcome back!",
                description: "You have successfully logged in.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Login failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("POST", "/api/logout");
        },
        onSuccess: () => {
            queryClient.setQueryData(["/api/user"], null);
            toast({
                title: "Logged out",
                description: "You have been logged out successfully.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Logout failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    return (
        <AuthContext.Provider
            value={{
                user: user ?? null,
                isLoading,
                error,
                loginMutation,
                logoutMutation,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
