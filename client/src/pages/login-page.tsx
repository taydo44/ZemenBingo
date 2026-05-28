import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      console.log("Attempting login with:", { username: credentials.username, password: "***" });
      const response = await apiRequest("POST", "/api/mongodb/auth/login", credentials);
      const data = await response.json();
      console.log("Login response:", data);
      return data;
    },
    onSuccess: (data: any) => {
      const user = data.user;
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });
      
      // Redirect based on user role
      if (user.role === "super_admin") {
        setLocation("/dashboard/super-admin");
      } else if (user.role === "admin") {
        setLocation("/dashboard/admin");
      } else if (user.role === "employee") {
        setLocation("/dashboard/employee");
      } else if (user.role === "collector") {
        setLocation("/dashboard/collector");
      }
    },
    onError: (error: any) => {
      console.error("Login error details:", error);
      const errorMessage = error.message || "Invalid username or password";
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Bingo System Login</CardTitle>
          <CardDescription>
            Enter your username and password to access the system
            <br />
            <span className="text-sm text-gray-500 mt-1">
              Admin users will be redirected to admin dashboard
              <br />
              Employee users will be redirected to employee dashboard
              <br />
              Collector users will be redirected to collector dashboard
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
          

        </CardContent>
      </Card>
    </div>
  );
}