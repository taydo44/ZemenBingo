import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, CheckCircle, Clock, Users, TrendingUp, Eye, LogOut } from "lucide-react";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  shopId: number;
  supervisorId: number;
  isBlocked?: boolean;
}

interface Cartela {
  id: number;
  cartelaNumber: number;
  name: string;
  pattern: number[][];
  numbers: number[];
  isBooked: boolean;
  bookedBy?: number;
  collectorId?: number;
  markedAt?: string;
  gameId?: number;
}

interface CollectorStats {
  totalMarked: number;
  todayMarked: number;
  availableCartelas: number;
  bookedCartelas: number;
}

export function CollectorDashboard({ user }: { user: User }) {
  const [searchCartela, setSearchCartela] = useState("");
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if collector is blocked
  if (user.isBlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Account Blocked</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Your account has been blocked by your supervisor. You cannot access cartela selection at this time.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your supervisor for assistance.
            </p>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logout function
  const handleLogout = async () => {
    try {
      await fetch("/api/mongodb/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  // Get supervisor (employee) information
  const { data: supervisor } = useQuery({
    queryKey: [`/api/users/${user.supervisorId}`],
    enabled: !!user.supervisorId,
  });

  // Fetch cartelas for this shop
  const { data: cartelas = [], isLoading: cartelasLoading } = useQuery({
    queryKey: [`/api/cartelas/${user.shopId}`],
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
  });

  // Fetch collector stats
  const { data: stats } = useQuery<CollectorStats>({
    queryKey: [`/api/collectors/${user.id}/stats`],
    refetchInterval: 5000,
  });

  // Check for active games (collectors cannot mark cartelas during active games)  
  const { data: activeGame } = useQuery({
    queryKey: [`/api/games/active`],
    refetchInterval: 2000,
    retry: false
  });

  // Mark cartela mutation
  const markCartelaMutation = useMutation({
    mutationFn: async (cartelaId: number) => {
      console.log("Marking cartela:", cartelaId, "for user:", user.id);
      return apiRequest("POST", `/api/collectors/mark-cartela`, { cartelaId, collectorId: user.id });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cartela marked for collection successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cartelas/${user.shopId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/collectors/${user.id}/stats`] });
    },
    onError: (error: any) => {
      console.error("Mark cartela error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark cartela",
        variant: "destructive",
      });
    },
  });

  // Unmark cartela mutation
  const unmarkCartelaMutation = useMutation({
    mutationFn: async (cartelaId: number) => {
      return apiRequest("POST", `/api/collectors/unmark-cartela`, { cartelaId, collectorId: user.id });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Cartela unbooking completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cartelas/${user.shopId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/collectors/${user.id}/stats`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unbook cartela",
        variant: "destructive",
      });
    },
  });

  // Reset all cartelas mutation
  const resetAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cartelas/reset`, { shopId: user.shopId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All cartelas reset successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cartelas/${user.shopId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/collectors/${user.id}/stats`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset cartelas",
        variant: "destructive",
      });
    },
  });

  // Filter cartelas based on search
  const filteredCartelas = (cartelas as Cartela[]).filter((cartela: Cartela) =>
    cartela.cartelaNumber.toString().includes(searchCartela) ||
    cartela.name.toLowerCase().includes(searchCartela.toLowerCase())
  );

  // Available cartelas (not booked by employees, not marked by any collector, and not in active game)
  const availableCartelas = filteredCartelas.filter(
    (cartela: Cartela) => {
      const isAvailable = !cartela.collectorId && !cartela.isBooked && !cartela.bookedBy && !cartela.gameId;
      if (!isAvailable && cartela.bookedBy) {
        console.log(`Cartela ${cartela.cartelaNumber} unavailable - marked by employee ${cartela.bookedBy}`);
      }
      return isAvailable;
    }
  );

  // Cartelas marked by this collector
  const myMarkedCartelas = filteredCartelas.filter(
    (cartela: Cartela) => cartela.collectorId === user.id
  );

  const handleMarkCartela = (cartelaId: number) => {
    console.log("Button clicked - marking cartela:", cartelaId, "by user:", user.id);
    if (markCartelaMutation.isPending) {
      console.log("Mutation already pending, skipping");
      return;
    }
    markCartelaMutation.mutate(cartelaId);
  };

  const handleUnmarkCartela = (cartelaId: number) => {
    unmarkCartelaMutation.mutate(cartelaId);
  };

  const handleResetAllCartelas = () => {
    resetAllMutation.mutate();
  };

  const handleViewCartela = (cartela: Cartela) => {
    setSelectedCartela(cartela);
    setIsViewDialogOpen(true);
  };

  // Render cartela grid for viewing
  const renderCartelaGrid = (pattern: number[][]) => {
    return (
      <div className="w-full max-w-xs mx-auto">
        <div className="grid grid-cols-5 gap-1 text-xs">
          {["B", "I", "N", "G", "O"].map((letter) => (
            <div key={letter} className="text-center font-bold p-1 bg-gray-100">
              {letter}
            </div>
          ))}
          {pattern.map((row, rowIndex) =>
            row.map((number, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="text-center p-1 border border-gray-200 bg-white text-xs"
              >
                {number === 0 ? "FREE" : number}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-md mx-auto space-y-4 sm:max-w-7xl sm:space-y-6">
        {/* Mobile Header */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              Collector Dashboard
            </h1>
            <div className="text-xs sm:text-base text-gray-600 mt-1">
              <div className="sm:hidden">
                <div><strong>{user.name}</strong></div>
                <div>Under: {(supervisor as any)?.name || 'Loading...'}</div>
                <div>Shop: {user.shopId}</div>
              </div>
              <div className="hidden sm:block">
                Collector: {user.name} | Working under: {(supervisor as any)?.name || 'Loading...'} | Shop: {user.shopId}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto sm:ml-4">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Mobile Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
            </CardHeader>
            <CardContent className="pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{stats?.totalMarked || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Today</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{stats?.todayMarked || 0}</div>
              <p className="text-xs text-muted-foreground">Today's count</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Available</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
            </CardHeader>
            <CardContent className="pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{availableCartelas.length}</div>
              <p className="text-xs text-muted-foreground">Ready</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Mine</CardTitle>
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
            </CardHeader>
            <CardContent className="pt-1 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{myMarkedCartelas.length}</div>
              <p className="text-xs text-muted-foreground">Collected</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mark" className="space-y-3 sm:space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="mark" className="text-xs sm:text-sm py-2 sm:py-3">
              <span className="hidden sm:inline">Mark Cartelas</span>
              <span className="sm:hidden">Mark</span>
            </TabsTrigger>
            <TabsTrigger value="my-marked" className="text-xs sm:text-sm py-2 sm:py-3">
              <span className="hidden sm:inline">My Marked ({myMarkedCartelas.length})</span>
              <span className="sm:hidden">Mine ({myMarkedCartelas.length})</span>
            </TabsTrigger>
            <TabsTrigger value="available" className="text-xs sm:text-sm py-2 sm:py-3">
              <span className="hidden sm:inline">Available ({availableCartelas.length})</span>
              <span className="sm:hidden">Free ({availableCartelas.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mark" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Available Cartelas</CardTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search number..."
                      value={searchCartela}
                      onChange={(e) => setSearchCartela(e.target.value)}
                      className="pl-10 text-sm sm:text-base"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {cartelasLoading ? (
                  <div className="text-center py-8">Loading cartelas...</div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 sm:gap-3">
                      {availableCartelas.map((cartela: Cartela) => {
                        const isGameActive = activeGame && ((activeGame as any)?.status === 'active' || (activeGame as any)?.status === 'paused');
                        const isDisabled = markCartelaMutation.isPending || isGameActive;
                        
                        return (
                          <div key={cartela.id} className="flex flex-col items-center space-y-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className={`w-full h-14 sm:h-12 text-xs flex flex-col gap-1 ${
                                isGameActive 
                                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                                  : "hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100"
                              }`}
                              onClick={() => !isGameActive && handleMarkCartela(cartela.id)}
                              disabled={isDisabled}
                            >
                              <span className="font-bold text-sm sm:text-xs">{cartela.cartelaNumber}</span>
                              <span className="text-xs text-muted-foreground truncate w-full hidden sm:block">
                                {cartela.name}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-full text-xs px-1 sm:h-6 sm:px-2"
                              onClick={() => handleViewCartela(cartela)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {availableCartelas.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No available cartelas found
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-marked" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base sm:text-lg">My Marked Cartelas</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">Tap to unbook if needed</p>
                  </div>
                  {myMarkedCartelas.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleResetAllCartelas}
                      disabled={resetAllMutation.isPending}
                      className="text-xs"
                    >
                      {resetAllMutation.isPending ? "Resetting..." : "Reset All Cartelas"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-2">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 sm:gap-3">
                    {myMarkedCartelas.map((cartela: Cartela) => (
                      <div key={cartela.id} className="flex flex-col items-center space-y-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-14 sm:h-12 text-xs flex flex-col gap-1 bg-green-50 border-green-300 hover:bg-green-100 active:bg-green-200"
                        >
                          <span className="font-bold text-sm sm:text-xs">{cartela.cartelaNumber}</span>
                          <span className="text-xs text-muted-foreground truncate w-full hidden sm:block">
                            {cartela.name}
                          </span>
                        </Button>
                        <div className="flex gap-1 w-full">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 flex-1 text-xs px-1 sm:h-6 sm:px-2"
                            onClick={() => handleViewCartela(cartela)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 flex-1 text-xs text-red-600 hover:text-red-700 px-1 sm:h-6 sm:px-2"
                            onClick={() => handleUnmarkCartela(cartela.id)}
                            disabled={unmarkCartelaMutation.isPending}
                          >
                            {unmarkCartelaMutation.isPending ? "..." : "✕"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {myMarkedCartelas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No marked cartelas yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="available" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">All Available Cartelas</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">View only - can't mark from here</p>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-2">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 sm:gap-3">
                    {availableCartelas.map((cartela: Cartela) => (
                      <div key={cartela.id} className="flex flex-col items-center space-y-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-14 sm:h-12 text-xs flex flex-col gap-1 hover:bg-gray-50 active:bg-gray-100"
                        >
                          <span className="font-bold text-sm sm:text-xs">{cartela.cartelaNumber}</span>
                          <span className="text-xs text-muted-foreground truncate w-full hidden sm:block">
                            {cartela.name}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-full text-xs px-1 sm:h-6 sm:px-2"
                          onClick={() => handleViewCartela(cartela)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                  {availableCartelas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No available cartelas
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Cartela View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Cartela #{selectedCartela?.cartelaNumber} - {selectedCartela?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedCartela && renderCartelaGrid(selectedCartela.pattern)}
              <div className="flex gap-2 justify-center">
                <Badge variant="outline">
                  {selectedCartela?.collectorId === user.id ? "Marked by You" : "Available"}
                </Badge>
                {selectedCartela?.markedAt && (
                  <Badge variant="secondary">
                    Marked: {new Date(selectedCartela.markedAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}