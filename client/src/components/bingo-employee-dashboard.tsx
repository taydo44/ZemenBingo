import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FIXED_CARTELAS, getCartelaNumbers, getFixedCartelaPattern } from "@/data/fixed-cartelas";
import { EmployeeCollectorManagement } from "@/components/employee-collector-management";
import { Volume2, Palette } from "lucide-react";

interface BingoEmployeeDashboardProps {
  onLogout: () => void;
}

export default function BingoEmployeeDashboard({ onLogout }: BingoEmployeeDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Game state
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]); // Numbers shown as marked on board
  const [blinkingNumber, setBlinkingNumber] = useState<number | null>(null); // Number currently blinking
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [gameAmount, setGameAmount] = useState("20");
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentAudioRef, setCurrentAudioRef] = useState<HTMLAudioElement | null>(null);

  
  // Voice selection
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('bingoVoice') || 'female1';
  });

  // Theme selection
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    return localStorage.getItem('employeeTheme') || 'classic';
  });

  // Save voice preference to localStorage
  useEffect(() => {
    localStorage.setItem('bingoVoice', selectedVoice);
  }, [selectedVoice]);

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('employeeTheme', selectedTheme);
  }, [selectedTheme]);

  // Theme configurations
  const themes = {
    classic: {
      name: "Classic Blue",
      primary: "bg-blue-600 hover:bg-blue-700",
      secondary: "bg-gray-100",
      accent: "bg-blue-100",
      text: "text-gray-900",
      cardBg: "bg-white",
      border: "border-gray-200",
      calledNumbers: "bg-blue-500",
      gameButton: "bg-blue-600 hover:bg-blue-700 border-blue-200",
      numberCell: "hover:bg-blue-50",
      selectedCartela: "border-blue-500 bg-blue-50"
    },
    dark: {
      name: "Dark Pro",
      primary: "bg-slate-700 hover:bg-slate-800",
      secondary: "bg-slate-800",
      accent: "bg-slate-600",
      text: "text-slate-100",
      cardBg: "bg-slate-900",
      border: "border-slate-700",
      calledNumbers: "bg-slate-600",
      gameButton: "bg-slate-700 hover:bg-slate-800 border-slate-500",
      numberCell: "hover:bg-slate-700",
      selectedCartela: "border-slate-400 bg-slate-800"
    },
    green: {
      name: "Green Success",
      primary: "bg-green-600 hover:bg-green-700",
      secondary: "bg-green-50",
      accent: "bg-green-100",
      text: "text-gray-900",
      cardBg: "bg-white",
      border: "border-green-200",
      calledNumbers: "bg-green-500",
      gameButton: "bg-green-600 hover:bg-green-700 border-green-200",
      numberCell: "hover:bg-green-50",
      selectedCartela: "border-green-500 bg-green-50"
    },
    purple: {
      name: "Purple Premium",
      primary: "bg-purple-600 hover:bg-purple-700",
      secondary: "bg-purple-50",
      accent: "bg-purple-100",
      text: "text-gray-900",
      cardBg: "bg-white",
      border: "border-purple-200",
      calledNumbers: "bg-purple-500",
      gameButton: "bg-purple-600 hover:bg-purple-700 border-purple-200",
      numberCell: "hover:bg-purple-50",
      selectedCartela: "border-purple-500 bg-purple-50"
    },
    orange: {
      name: "Orange Energy",
      primary: "bg-orange-600 hover:bg-orange-700",
      secondary: "bg-orange-50",
      accent: "bg-orange-100",
      text: "text-gray-900",
      cardBg: "bg-white",
      border: "border-orange-200",
      calledNumbers: "bg-orange-500",
      gameButton: "bg-orange-600 hover:bg-orange-700 border-orange-200",
      numberCell: "hover:bg-orange-50",
      selectedCartela: "border-orange-500 bg-orange-50"
    },
    gobingo: {
      name: "GoBingo Style",
      primary: "bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700",
      secondary: "bg-red-800",
      accent: "bg-yellow-400",
      text: "text-white",
      cardBg: "bg-red-900",
      border: "border-yellow-400",
      calledNumbers: "bg-gradient-to-b from-yellow-400 to-yellow-600",
      gameButton: "bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 border-yellow-400 text-black font-bold",
      numberCell: "hover:bg-yellow-100 hover:text-black",
      selectedCartela: "border-yellow-400 bg-yellow-900 bg-opacity-20"
    }
  };

  const currentTheme = themes[selectedTheme as keyof typeof themes] || themes.classic;
  
  // Cartela management
  const [selectedCartelas, setSelectedCartelas] = useState<Set<number>>(new Set());
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  
  // Winner checking
  const [showWinnerChecker, setShowWinnerChecker] = useState(false);
  const [winnerCartelaNumber, setWinnerCartelaNumber] = useState("");
  const [showWinnerResult, setShowWinnerResult] = useState(false);
  
  // Cartela disqualification tracking
  const [checkedCartelas, setCheckedCartelas] = useState<Set<number>>(new Set()); // Track cartelas checked once
  const [disqualifiedCartelas, setDisqualifiedCartelas] = useState<Set<number>>(new Set()); // Track disqualified cartelas
  const [showDisqualificationPopup, setShowDisqualificationPopup] = useState(false);
  const [disqualificationCartelaNumber, setDisqualificationCartelaNumber] = useState<number | null>(null);
  interface WinnerResult {
    isWinner: boolean;
    cartela: number;
    message: string;
    pattern: string;
    winningCells: number[];
    cartelaPattern?: number[][];
  }
  
  const [winnerResult, setWinnerResult] = useState<WinnerResult>({ isWinner: false, cartela: 0, message: "", pattern: "", winningCells: [], cartelaPattern: undefined });
  
  // Animation states
  const [isShuffling, setIsShuffling] = useState(false);
  const [showCartelaPreview, setShowCartelaPreview] = useState(false);
  const [previewCartela, setPreviewCartela] = useState<number | null>(null);
  const [isBoardShuffling, setIsBoardShuffling] = useState(false);
  const [shuffledPositions, setShuffledPositions] = useState<number[]>([]);
  
  // Auto-calling states
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [pausedAudio, setPausedAudio] = useState<HTMLAudioElement | null>(null);
  const [pausedAudioTime, setPausedAudioTime] = useState<number>(0);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // Speed control
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(4); // seconds between numbers - default balanced for all voices
  
  // Timer reference for instant pause control
  const numberCallTimer = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [pauseOperationInProgress, setPauseOperationInProgress] = useState(false);
  
  // Store previous game setup for restart functionality
  const [previousGameSetup, setPreviousGameSetup] = useState<{
    cartelas: Set<number>;
    amount: string;
  } | null>(null);
  
  // Active game query
  const { data: activeGame } = useQuery({
    queryKey: ['/api/mongodb/games/active'],
    refetchInterval: gameActive ? 5000 : 30000 // More frequent polling during active games
  });

  // Shop data query with frequent refresh for real-time profit margin updates
  const { data: shopData } = useQuery({
    queryKey: [`/api/mongodb/shops/${user?.shopId}`],
    enabled: !!user?.shopId,
    refetchInterval: 60000 // Refresh every 60 seconds to catch admin changes
  });

  // Calculate amounts based on selected cartelas and profit margin
  const calculateAmounts = () => {
    // Only use bookedCartelas (actual database-marked cartelas) to avoid double-counting
    // selectedCartelas is local state that can be stale during active games
    const totalCartelas = bookedCartelas.size;
    // Always use the current gameAmount state for real-time calculation updates
    const amountPerCartela = parseFloat(gameAmount) || 20;
    const totalCollected = totalCartelas * amountPerCartela;
    // Use admin's flexible profit margin from shop data - no fallback to ensure admin control
    const profitMargin = parseFloat((shopData as any)?.profitMargin || '0') / 100;
    const winnerAmount = totalCollected * (1 - profitMargin);
    const profitAmount = totalCollected * profitMargin;
    
    // Removed heavy debug logging for better performance
    
    return {
      totalCollected,
      winnerAmount,
      profitAmount,
      totalCartelas
    };
  };

  // Game history query for admin connection
  const { data: gameHistory } = useQuery({
    queryKey: ['/api/mongodb/analytics/shop', user?.shopId],
    enabled: !!user?.shopId,
    refetchInterval: 20000 // Refresh every 20 seconds for live updates
  });

  // Admin credit balance query
  const { data: adminData } = useQuery({
    queryKey: ['/api/mongodb/users', (shopData as any)?.adminId],
    queryFn: async () => {
      if (!(shopData as any)?.adminId) return null;
      const response = await fetch(`/api/mongodb/users/${(shopData as any).adminId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!(shopData as any)?.adminId,
    refetchInterval: 30000 // Check admin balance every 30 seconds
  });

  // Cartelas query for real-time updates
  const { data: cartelas, refetch: refetchCartelas } = useQuery({
    queryKey: ['/api/mongodb/cartelas', user?.shopId],
    queryFn: async () => {
      if (!user?.shopId) return [];
      const response = await fetch(`/api/mongodb/cartelas/${user.shopId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.shopId,
    refetchInterval: false // Disable automatic polling - use manual refetch after mutations
  });

  // Sync with active game data
  useEffect(() => {
    if (activeGame) {
      // Only sync if this is a different game or if we don't have a current game
      const incomingGameId = (activeGame as any).id;
      const incomingStatus = (activeGame as any).status;
      
      // Removed game sync logging for better performance
      
      // If the incoming game is completed, don't set it as active
      if (incomingStatus === 'completed') {
        // Skip completed games
        return;
      }
      
      // Always sync the game ID to prevent mismatches
      if (incomingGameId !== activeGameId) {
        // Update active game ID
      }
      
      setActiveGameId(incomingGameId);
      
      // Convert string array to number array for proper number tracking
      const gameCalledNumbers = ((activeGame as any).calledNumbers || []).map((n: string) => parseInt(n));
      
      // Check if this is a reset scenario (game has 'waiting' status with leftover called numbers)
      if (incomingStatus === 'waiting' && gameCalledNumbers.length > 0) {
        // Reset detected - clear called numbers
        // Force clear all numbers and visual state for reset scenario
        setCalledNumbers([]);
        setMarkedNumbers([]);
        setBlinkingNumber(null);
        setLastCalledNumber(null);
        return; // Skip normal sync logic
      }
      
      // Skip state updates if pause operation is in progress
      if (pauseOperationInProgress) {
        console.log(`🚫 SKIPPING SYNC - pause operation in progress`);
        return;
      }
      
      // Only update game state if it's a different game or if we're transitioning to a new state
      if (incomingGameId !== activeGameId || 
          (incomingStatus === 'active' && !gameActive) ||
          (incomingStatus === 'paused' && !gamePaused) ||
          (incomingStatus === 'waiting' && (gameActive || gamePaused))) {
        // Update game state
        setGameActive(incomingStatus === 'active');
        setGameFinished(incomingStatus === 'completed');
        setGamePaused(incomingStatus === 'paused');
      } else {
        // Preserve local state
      }
      
      // Always update called numbers to reflect the current game state
      setCalledNumbers(gameCalledNumbers);
      // Always sync marked numbers to match called numbers from server
      if (gameCalledNumbers.length === 0) {
        // If no called numbers, ensure board is completely clear
        setMarkedNumbers([]);
        setBlinkingNumber(null);
        setLastCalledNumber(null);
        // Board cleared - no called numbers
      } else if (!markedNumbers.length || markedNumbers.length !== gameCalledNumbers.length - 1) {
        // Fresh game load or desync: mark all numbers except the last one
        const numbersToMark = gameCalledNumbers.slice(0, -1);
        setMarkedNumbers(numbersToMark); // All except last number
        // Sync board with called numbers
      }
      
      // Include game cartelas and all marked cartelas (avoiding double-counting)
      const gameCartelas = new Set((activeGame as any).cartelas || []);
      
      // Debug: Log all cartelas to see their structure
      // Active game cartela processing
      
      // Get all marked cartelas (both collector and employee) without double-counting
      const allMarkedCartelas = (cartelas || [])
        .filter((c: any) => {
          const hasCollector = c.collectorId !== null && c.collectorId !== undefined;
          const hasEmployee = c.bookedBy !== null && c.bookedBy !== undefined;
          const isMarked = hasCollector || hasEmployee;
          
          if (isMarked) {
            const source = hasCollector ? 'collector' : 'employee';
            const dualMarked = hasCollector && hasEmployee ? ' (DUAL-MARKED)' : '';
            // Process marked cartela
          }
          
          return isMarked;
        })
        .map((c: any) => c.cartelaNumber);
      
      // Combine game cartelas and marked cartelas without duplication
      const combinedCartelas = new Set([...Array.from(gameCartelas), ...allMarkedCartelas]);
      
      // Process game cartelas
      // Process all marked cartelas and combine without duplicates
      
      setBookedCartelas(combinedCartelas);
      
      const lastNumber = gameCalledNumbers.slice(-1)[0];
      setLastCalledNumber(lastNumber || null);
    } else {
      // Clear all game state when no active game but keep collector-marked cartelas unavailable
      setActiveGameId(null);
      setGameActive(false);
      setGameFinished(false);
      setCalledNumbers([]);
      setMarkedNumbers([]);
      setLastCalledNumber(null);
      
      // Still show all marked cartelas as unavailable even when no active game
      // Debug: Log all cartelas to see their structure
      // No active game cartela processing
      
      const allMarkedCartelas = (cartelas || [])
        .filter((c: any) => {
          const hasCollector = c.collectorId !== null && c.collectorId !== undefined;
          const hasEmployee = c.bookedBy !== null && c.bookedBy !== undefined;
          const isMarked = hasCollector || hasEmployee;
          
          if (isMarked) {
            const source = hasCollector ? 'collector' : 'employee';
            const dualMarked = hasCollector && hasEmployee ? ' (DUAL-MARKED)' : '';
            // Process marked cartela without active game
          }
          
          return isMarked;
        })
        .map((c: any) => c.cartelaNumber);
      
      console.log("No active game - All marked cartelas (no duplicates):", allMarkedCartelas);
      setBookedCartelas(new Set(allMarkedCartelas));
    }
  }, [activeGame, cartelas, user?.id]);

  // Clear timers and stop audio immediately when game is paused
  useEffect(() => {
    if (gamePaused) {
      // Clear number calling timer
      if (numberCallTimer.current) {
        clearTimeout(numberCallTimer.current);
        numberCallTimer.current = null;
      }
      
      // Stop current audio like pausing music
      if (currentAudioRef) {
        currentAudioRef.pause();
        currentAudioRef.currentTime = 0;
        setCurrentAudioRef(null);
        setAudioPlaying(false);
      }
    }
  }, [gamePaused, currentAudioRef]);

  // Cleanup auto-calling interval on unmount
  useEffect(() => {
    return () => {
      if (autoCallInterval) {
        clearInterval(autoCallInterval);
      }
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [autoCallInterval, currentAudio]);

  // Helper function to get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "?";
  };

  // Helper function to get audio file path based on voice and number
  const getAudioPath = (num: number): string => {
    const letter = getLetterForNumber(num);
    let fileName = '';
    
    if (selectedVoice === 'alex') {
      // Alex voice files use specific naming patterns based on observation
      if (num >= 1 && num <= 4) {
        fileName = `${letter} ${num}.mp3`;
      } else if (num >= 5 && num <= 9) {
        fileName = `${letter}0${num}.mp3`;
      } else if (num >= 10 && num <= 75) {
        fileName = `${letter}0${num}.mp3`;
      }
      return `/voices/alex/${fileName}`;
    } else if (selectedVoice === 'melat') {
      // Melat voice uses standard naming format (updated files)
      fileName = `${letter}${num}.mp3`;
      return `/voices/melat2/${fileName}`;
    } else if (selectedVoice === 'arada') {
      // Arada voice uses normalized names
      fileName = `${letter}${num}.mp3`;
      return `/voices/arada/${fileName}`;
    } else if (selectedVoice === 'real-arada') {
      // Real Arada voice uses standard naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/real-arada/${fileName}`;
    } else if (selectedVoice === 'tigrigna') {
      // Tigrigna voice uses standard naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/tigrigna/${fileName}`;
    } else if (selectedVoice === 'oromifa') {
      // Oromifa voice uses standard naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/oromifa/${fileName}`;
    } else if (selectedVoice === 'betty') {
      // Betty voice uses standard naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/betty/${fileName}`;
    } else if (selectedVoice === 'nati') {
      // Nati voice uses standard naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/nati/${fileName}`;
    } else {
      // Female voices use the original naming format
      fileName = `${letter}${num}.mp3`;
      return `/voices/${selectedVoice}/${fileName}`;
    }
  };

  // Helper function to get audio file path for game events based on voice
  const getGameEventAudioPath = (eventType: string): string => {
    if (selectedVoice === 'alex') {
      switch (eventType) {
        case 'gameStart':
          return '/voices/alex/Start game.mp3';
        case 'winner':
          return '/voices/alex/Winner.mp3';
        case 'notWinner':
          return '/voices/alex/not winner cartela.mp3';
        case 'passedBeforeBingo':
          return '/voices/alex/passed before you say bingo.mp3';
        case 'disqualified':
          return '/voices/alex/disqualified.mp3';
        case 'notSelected':
          return '/voices/alex/not_selected.mp3';
        case 'shuffle':
          return '/voices/alex/shuffle.mp3'; // Alex uses own shuffle if available, otherwise silent
        default:
          return '';
      }
    } else if (selectedVoice === 'melat') {
      // Melat voice uses updated voice files
      switch (eventType) {
        case 'gameStart':
          return '/voices/melat2/start_game.mp3';
        case 'winner':
          return '/voices/melat2/winner.mp3';
        case 'notWinner':
          return '/voices/melat2/not_winner_cartela.mp3';
        case 'passedBeforeBingo':
          return '/voices/melat2/not_winner_cartela.mp3'; // Use same as not_winner for now
        case 'disqualified':
          return '/voices/melat2/disqualified.mp3';
        case 'shuffle':
          return '/voices/common/shuffle.mp3'; // Use common shuffle for melat
        case 'notSelected':
          return '/voices/melat2/not_winner_cartela.mp3'; // Use same as not_winner for now
        default:
          return '';
      }
    } else if (['arada', 'real-arada', 'betty', 'nati', 'tigrigna', 'oromifa', 'female1'].includes(selectedVoice)) {
      // Common voices for arada, real-arada, betty, nati, tigrigna, oromifa, and female voice
      switch (eventType) {
        case 'gameStart':
          return '/voices/common/start_game.mp3';
        case 'winner':
          return '/voices/common/winner.mp3';
        case 'notWinner':
          return '/voices/common/not_winner_cartela.mp3';
        case 'passedBeforeBingo':
          return '/voices/common/not_winner_cartela.mp3'; // Use same as not_winner for now
        case 'disqualified':
          return '/voices/common/disqualified.mp3';
        case 'shuffle':
          return '/voices/common/shuffle.mp3';
        case 'notSelected':
          return '/voices/common/not_winner_cartela.mp3'; // Use same as not_winner for now
        default:
          return '';
      }
    } else {
      // Female voice uses original files
      switch (eventType) {
        case 'gameStart':
          return '/attached_assets/game started_1750069128880.mp3';
        case 'winner':
          return '/attached_assets/winner_1750069128882.mp3';
        case 'notWinner':
          return '/attached_assets/losser_1750069128883.mp3';
        case 'disqualified':
          return '/voices/female1/disqualified.mp3';
        case 'notSelected':
          return '/voices/female1/not_selected.mp3';
        default:
          return '';
      }
    }
  };



  // Helper function to get ball color for number
  const getBallColor = (num: number): string => {
    if (num >= 1 && num <= 15) return "from-blue-500 to-blue-700"; // B - Blue
    if (num >= 16 && num <= 30) return "from-red-500 to-red-700"; // I - Red
    if (num >= 31 && num <= 45) return "from-green-500 to-green-700"; // N - Green
    if (num >= 46 && num <= 60) return "from-yellow-500 to-yellow-600"; // G - Yellow
    if (num >= 61 && num <= 75) return "from-purple-500 to-purple-700"; // O - Purple
    return "from-gray-400 to-gray-600";
  };

  // Generate next number for calling
  const getNextNumber = (): number | null => {
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(n => !calledNumbers.includes(n));
    
    if (availableNumbers.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    return availableNumbers[randomIndex];
  };

  // Call a single number with hover effect and audio
  const callNumber = async () => {
    if (!activeGameId || isPaused) return;

    const numberToCall = getNextNumber();
    if (!numberToCall) {
      setGameActive(false);
      setGameFinished(true);
      setIsAutoCall(false);
      return;
    }

    // Set hovering state for preview
    setNextNumber(numberToCall);
    setIsHovering(true);
    
    // Hover effect duration
    setTimeout(() => {
      setIsHovering(false);
      setIsShuffling(true);
      
      // Play calling sound
      try {
        const audio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
        audio.volume = 0.6;
        setCurrentAudio(audio);
        audio.play().catch(() => {
          console.log('Money counter sound not available');
        });
      } catch (error) {
        console.log('Audio playback error for calling sound');
      }

      // Call the API to add the number
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/mongodb/games/${activeGameId}/numbers`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: numberToCall })
          });

          if (response.ok) {
            const updatedNumbers = [...calledNumbers, numberToCall];
            setCalledNumbers(updatedNumbers);
            setLastCalledNumber(numberToCall);
          }
        } catch (error) {
          console.error('Failed to call number:', error);
        }
        
        setIsShuffling(false);
        setNextNumber(null);
      }, 1500);
    }, 800); // Hover duration
  };

  // Start auto-calling
  const startAutoCall = () => {
    if (autoCallInterval) clearInterval(autoCallInterval);
    
    setIsAutoCall(true);
    setIsPaused(false);
    
    const interval = setInterval(() => {
      console.log(`🎯 AUTO-CALL CHECK: isPaused=${isPaused}, gameActive=${gameActive}, gameFinished=${gameFinished}, audioPlaying=${audioPlaying}, voice=${selectedVoice}`);
      // For Arada voice, be more lenient with audio blocking to ensure smooth flow
      const canCallNumber = selectedVoice === 'arada' || selectedVoice === 'real-arada' 
        ? (!isPaused && gameActive && !gameFinished) // Less strict for Arada
        : (!isPaused && gameActive && !gameFinished && !audioPlaying); // Original logic for others
        
      if (canCallNumber) {
        console.log(`🎯 CALLING NUMBER: speed=${autoPlaySpeed}s, voice=${selectedVoice}`);
        callNumber();
      } else {
        console.log(`🎯 SKIPPING CALL: blocked by audioPlaying=${audioPlaying} or other conditions`);
      }
    }, autoPlaySpeed * 1000); // Use the actual autoPlaySpeed setting
    
    setAutoCallInterval(interval);
  };

  // Stop auto-calling immediately
  const stopAutoCall = () => {
    setIsAutoCall(false);
    setIsPaused(false);
    
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
    
    // Stop any currently playing audio immediately
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Reset states
    setIsShuffling(false);
    setIsHovering(false);
    setNextNumber(null);
  };

  // Pause auto-calling immediately
  const pauseAutoCall = () => {
    setIsPaused(!isPaused);
    
    // Stop any currently playing audio immediately when pausing
    if (!isPaused && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsShuffling(false);
      setIsHovering(false);
      setNextNumber(null);
    }
  };

  // Enhanced pause game function for immediate stop
  const enhancedPauseGame = async () => {
    try {
      console.log(`🛑 PAUSING GAME: activeGameId=${activeGameId}, gameActive=${gameActive}`);
      
      // Set operation flag to prevent state corruption from sync
      setPauseOperationInProgress(true);
      
      // Call backend to pause the game
      const response = await fetch(`/api/mongodb/games/${activeGameId}/pause`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: true })
      });
      
      if (response.ok) {
        console.log(`✅ PAUSE API SUCCESS - Setting gamePaused=true`);
        setGamePaused(true);
        
        // Immediately stop all audio and animations
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          setCurrentAudio(null);
        }
        
        // Clear any pending timers
        if (numberCallTimer.current) {
          clearTimeout(numberCallTimer.current);
          numberCallTimer.current = null;
        }
        
        // Stop all animations immediately
        setIsShuffling(false);
        setIsHovering(false);
        setNextNumber(null);
        setAudioPlaying(false);
        
        // Force refresh active game state to prevent state corruption
        queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
        
        toast({
          title: "Game Paused",
          description: "Game has been paused immediately"
        });
        
        console.log(`🛑 PAUSE COMPLETE: gamePaused=${true}, gameActive=${gameActive}`);
      } else {
        console.error(`❌ PAUSE API FAILED: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to pause game:', error);
    } finally {
      // Always clear the operation flag
      setTimeout(() => setPauseOperationInProgress(false), 1000);
    }
  };

  // Board shuffle animation - purely visual entertainment
  const shuffleBingoBoard = () => {
    setIsBoardShuffling(true);
    
    // Create array of all 75 numbers for shuffling
    const allNumbers = Array.from({length: 75}, (_, i) => i + 1);
    
    // Play universal shuffle sound (independent of voice selection)
    try {
      const audio = new Audio('/voices/common/shuffle.mp3');
      audio.volume = 0.7;
      audio.play().catch((error) => {
        console.log('Shuffle sound not available, trying fallback:', error);
        // Fallback to money counter sound
        const fallbackAudio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
        fallbackAudio.volume = 0.7;
        fallbackAudio.play().catch(() => {
          console.log('Fallback shuffle sound also not available');
        });
      });
    } catch (error) {
      console.log('Error playing shuffle sound:', error);
    }
    
    // Shuffle animation phases - synchronized with 5-second audio
    let shuffleCount = 0;
    const maxShuffles = 10; // 10 shuffles over 5 seconds
    const shuffleIntervalTime = 500; // 500ms per shuffle = 5 seconds total
    
    const shuffleInterval = setInterval(() => {
      // Create randomized positions for visual effect
      const shuffled = [...allNumbers].sort(() => Math.random() - 0.5);
      setShuffledPositions(shuffled);
      
      shuffleCount++;
      if (shuffleCount >= maxShuffles) {
        clearInterval(shuffleInterval);
        // Return to original positions
        setShuffledPositions([]);
        setTimeout(() => {
          setIsBoardShuffling(false);
        }, 200);
      }
    }, shuffleIntervalTime);
  };

  // Enhanced restart function - restore previous game setup
  const restartGame = () => {
    if (previousGameSetup) {
      // Restore previous cartelas and amount
      setSelectedCartelas(previousGameSetup.cartelas);
      setGameAmount(previousGameSetup.amount);
      
      toast({
        title: "Game Setup Restored",
        description: `Restored ${previousGameSetup.cartelas.size} cartelas and ${previousGameSetup.amount} Birr per cartela. Click Start Game to begin.`
      });
    } else {
      // If no previous setup, just play shuffle sound for feedback
      try {
        const audio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
        audio.volume = 0.6;
        audio.play().catch(() => {
          console.log('Money counter sound not available');
        });
      } catch (error) {
        console.log('Audio playback error for shuffle sound');
      }
      
      toast({
        title: "No Previous Game",
        description: "No previous game setup to restore. Select cartelas and start a new game."
      });
    }
  };

  // Original shuffle for number calling - keep existing functionality
  const shuffleNumbers = () => {
    if (!activeGameId) return;
    
    setIsShuffling(true);
    
    // Play money counter sound effect for shuffle
    try {
      const audio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {
        console.log('Money counter sound not available');
      });
    } catch (error) {
      console.log('Audio playback error for shuffle sound');
    }
    
    setTimeout(() => {
      setIsShuffling(false);
    }, 2500);
  };

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/mongodb/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(gameAmount),
          cartelas: Array.from(selectedCartelas)
        })
      });
      if (!response.ok) throw new Error('Failed to create game');
      return response.json();
    },
    onSuccess: (data) => {
      setActiveGameId(data.id);
      setGameActive(false);
      setGameFinished(false);
      setCalledNumbers([]); // Ensure no numbers are pre-marked
      setLastCalledNumber(null);
      setBookedCartelas(new Set(selectedCartelas));
      // Keep selectedCartelas for validation during the game
      queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
      toast({
        title: "Game Created",
        description: `Game created with ${Array.from(selectedCartelas).length} cartelas`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create game",
        variant: "destructive"
      });
    }
  });

  // Mark cartela by employee mutation
  const markCartelaByEmployeeMutation = useMutation({
    mutationFn: async (cartelaNumber: number) => {
      const cartela = (cartelas || []).find((c: any) => c.cartelaNumber === cartelaNumber);
      if (!cartela) throw new Error('Cartela not found');
      
      const response = await fetch('/api/mongodb/employees/mark-cartela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cartelaId: cartela.id, 
          employeeId: user?.id 
        })
      });
      if (!response.ok) throw new Error('Failed to mark cartela');
      return response.json();
    },
    onSuccess: async (data, cartelaNumber) => {
      // Update local state immediately for instant UI feedback
      setSelectedCartelas(prev => new Set([...prev, cartelaNumber]));
      
      // Force immediate refetch for instant update
      await refetchCartelas();
      
      toast({
        title: "Cartela Marked",
        description: `Cartela #${cartelaNumber} marked successfully`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark cartela",
        variant: "destructive"
      });
    }
  });

  // Unmark cartela by employee mutation
  const unmarkCartelaByEmployeeMutation = useMutation({
    mutationFn: async (cartelaNumber: number) => {
      const cartela = (cartelas || []).find((c: any) => c.cartelaNumber === cartelaNumber);
      if (!cartela) throw new Error('Cartela not found');
      
      const response = await fetch('/api/mongodb/employees/unmark-cartela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cartelaId: cartela.id, 
          employeeId: user?.id 
        })
      });
      if (!response.ok) throw new Error('Failed to unmark cartela');
      return response.json();
    },
    onSuccess: async (data, cartelaNumber) => {
      // Update local state immediately for instant UI feedback
      setSelectedCartelas(prev => {
        const newSet = new Set(prev);
        newSet.delete(cartelaNumber);
        return newSet;
      });
      
      // Force immediate refetch for instant update
      await refetchCartelas();
      
      toast({
        title: "Cartela Unmarked",
        description: `Cartela #${cartelaNumber} unmarked successfully`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unmark cartela",
        variant: "destructive"
      });
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/mongodb/games/${activeGameId}/start`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to start game');
      return response.json();
    },
    onSuccess: (data) => {
      // Save current game setup before starting
      setPreviousGameSetup({
        cartelas: new Set(selectedCartelas),
        amount: gameAmount
      });
      
      setGameActive(true);
      setActiveGameId(data.id);
      setCalledNumbers([]); // Clear any previous numbers when starting
      setLastCalledNumber(null);
      queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
      
      // Play game start sound
      try {
        const audioPath = getGameEventAudioPath('gameStart');
        if (audioPath) {
          const audio = new Audio(audioPath);
          audio.volume = 0.8;
          audio.play().catch(() => {
            console.log('Start game sound not available');
          });
        }
      } catch (error) {
        console.log('Start audio playback error');
      }
      
      toast({
        title: "Game Started",
        description: "Bingo game is now active - start calling numbers!"
      });
      
      // Automatically start calling numbers after a short delay
      setTimeout(() => {
        callNumberMutation.mutate();
      }, 2000);
    },
    onError: (error: any) => {
      console.error("Start game error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive"
      });
    }
  });

  // Call number mutation
  const callNumberMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/mongodb/games/${activeGameId}/numbers`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to call number');
      return response.json();
    },
    onSuccess: (data) => {
      const newNumber = data.calledNumber;
      setLastCalledNumber(newNumber);
      queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
      
      // Update the full called numbers list
      const updatedNumbers = (data.calledNumbers || []).map((n: string) => parseInt(n));
      setCalledNumbers(updatedNumbers);

      // Don't process audio or set timers if game is paused
      if (gamePaused) {
        setMarkedNumbers(updatedNumbers);
        return;
      }
      
      // Play number audio if available and no other audio is playing
      if (newNumber && !audioPlaying && !currentAudioRef) {
        const letter = getLetterForNumber(newNumber);
        console.log(`🔊 AUDIO: Starting playback for ${letter}${newNumber} (audioPlaying: ${audioPlaying})`);
        setAudioPlaying(true);
        
        // If there was a previous blinking number, mark it fully now
        if (blinkingNumber !== null) {
          setMarkedNumbers(prev => [...prev, blinkingNumber]);
        }
        
        // Mark all numbers from called numbers EXCEPT the current one being spoken
        const numbersToMark = updatedNumbers.slice(0, -1); // All except the last (current) number
        setMarkedNumbers(numbersToMark);
        
        // Start blinking the current number immediately
        setBlinkingNumber(newNumber);
        
        // Don't mark the current number - it will be marked when the NEXT number starts
        // Dynamic timeout based on calling speed - for faster speeds, force shorter audio
        // Special handling for Arada voice which needs longer audio time
        const callingSpeedMs = autoPlaySpeed * 1000;
        let maxAudioTime;
        
        if (selectedVoice === 'arada' || selectedVoice === 'real-arada') {
          // Arada voice gets most of the calling interval for audio completion
          maxAudioTime = Math.max(callingSpeedMs - 300, 2000); // Leave 300ms buffer, min 2 seconds
          console.log(`🔊 ARADA TIMING: Using ${maxAudioTime}ms timeout for Arada voice (calling every ${callingSpeedMs}ms)`);
        } else {
          // Other voices use the original timing
          maxAudioTime = Math.min(callingSpeedMs - 500, 4500); // Leave 500ms buffer, max 4.5s
        }
        const audioResetTimer = setTimeout(() => {
          console.log(`🔊 AUDIO TIMEOUT: Force stopping after ${maxAudioTime}ms for speed ${autoPlaySpeed}s`);
          if (currentAudioRef) {
            currentAudioRef.pause();
            currentAudioRef.currentTime = 0;
          }
          setAudioPlaying(false);
          setCurrentAudioRef(null);
        }, maxAudioTime);
        
        try {
          const audioPath = getAudioPath(newNumber);
          console.log(`🔊 AUDIO DEBUG: Playing ${letter}${newNumber} with path: ${audioPath} using voice: ${selectedVoice}`);
          
          // Special debugging for G49 specifically
          if (newNumber === 49) {
            console.log(`🎯 G49 DEBUG: About to play G49 audio`);
            console.log(`🎯 G49 PATH: ${audioPath}`);
            console.log(`🎯 G49 VOICE: ${selectedVoice}`);
          }
          
          // Create audio element for each number
          const audio = new Audio(audioPath);
          audio.volume = 0.8;
          
          // Adjust playback rate based on speed setting for better synchronization
          if (selectedVoice === 'arada' || selectedVoice === 'real-arada') {
            // For Arada voice, adjust playback rate based on autoplay speed
            // Faster speeds = faster playback, slower speeds = normal playback
            const baseSpeed = 6; // Our reference speed in seconds
            const speedRatio = baseSpeed / autoPlaySpeed;
            audio.playbackRate = Math.min(Math.max(speedRatio, 0.7), 1.8); // Limit between 0.7x and 1.8x
            console.log(`🔊 ARADA SPEED: autoPlaySpeed=${autoPlaySpeed}s, playbackRate=${audio.playbackRate}x`);
          }
          
          setCurrentAudioRef(audio);
          
          audio.onended = () => {
            clearTimeout(audioResetTimer);
            console.log(`🔊 AUDIO: Completed playing ${letter}${newNumber} naturally`);
            // Clean up audio state immediately
            setAudioPlaying(false);
            setCurrentAudioRef(null);
            // Mark the number after audio completes
            setTimeout(() => {
              setMarkedNumbers(prev => {
                if (!prev.includes(newNumber)) {
                  return [...prev, newNumber];
                }
                return prev;
              });
            }, 50); // Even faster marking for fast speeds
          };
          
          audio.onerror = (error) => {
            console.error(`🔊 AUDIO ERROR: Failed to load audio ${audioPath}:`, error);
            clearTimeout(audioResetTimer);
            setAudioPlaying(false);
            setCurrentAudioRef(null);
            // Mark immediately if audio fails
            setMarkedNumbers(prev => {
              if (!prev.includes(newNumber)) {
                return [...prev, newNumber];
              }
              return prev;
            });
          };
          
          // Play audio after loading
          {
            audio.oncanplaythrough = () => {
              console.log(`🔊 AUDIO: Ready to play ${letter}${newNumber}`);
              
              // Special G49 debugging
              if (newNumber === 49) {
                console.log(`🎯 G49 READY: About to play G49, playbackRate=${audio.playbackRate}`);
              }
              
              audio.play().catch((error) => {
                console.error(`🔊 AUDIO PLAY ERROR: Failed to play ${audioPath} for ${letter}${newNumber}:`, error);
                
                // Special G49 error debugging
                if (newNumber === 49) {
                  console.error(`🎯 G49 PLAY ERROR: Specific error with G49:`, error);
                }
                clearTimeout(audioResetTimer);
                setAudioPlaying(false);
                setCurrentAudioRef(null);
                setMarkedNumbers(prev => {
                  if (!prev.includes(newNumber)) {
                    return [...prev, newNumber];
                  }
                  return prev;
                });
              });
            };
          audio.onerror = (error) => {
            console.error(`🔊 AUDIO ERROR: Failed to load audio ${audioPath}:`, error);
            clearTimeout(audioResetTimer);
            setAudioPlaying(false);
            setCurrentAudioRef(null);
            // Mark immediately if audio fails
            setMarkedNumbers(prev => {
              if (!prev.includes(newNumber)) {
                return [...prev, newNumber];
              }
              return prev;
            });
          };
          
            // Start loading the audio immediately
            audio.load();
          }
        } catch (error) {
          console.error(`🔊 AUDIO CATCH ERROR: Failed to create audio for ${letter}${newNumber}:`, error);
          
          // Special G49 catch debugging
          if (newNumber === 49) {
            console.error(`🎯 G49 CATCH ERROR: Exception caught for G49:`, error);
          }
          
          clearTimeout(audioResetTimer);
          setAudioPlaying(false);
          setCurrentAudioRef(null);
          // Mark immediately if audio fails
          setMarkedNumbers(prev => [...prev, newNumber]);
        }
      } else {
        // If no audio or audio already playing, mark all numbers
        setMarkedNumbers(updatedNumbers);
      }
      
      // Only set timer if game is active and not paused
      if (gameActive && !gameFinished && !gamePaused && activeGameId) {
        // Clear any existing timer first
        if (numberCallTimer.current) {
          clearTimeout(numberCallTimer.current);
        }
        
        numberCallTimer.current = setTimeout(() => {
          // Triple-check conditions before calling (pause state might have changed)
          if (gameActive && !gameFinished && !gamePaused && activeGameId) {
            callNumberMutation.mutate();
          }
        }, autoPlaySpeed * 1000);
      }
    }
  });

  // Reset game mutation - only clears data when manually starting new game
  const resetGameMutation = useMutation({
    mutationFn: async () => {
      // For reset operations, we don't need a specific game ID
      // Just clear all cartela states and reset the frontend
      const response = await fetch('/api/mongodb/cartelas/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shopId: user?.shopId })
      });
      if (!response.ok) throw new Error('Failed to reset cartelas');
      return response.json();
    },
    onSuccess: () => {
      // Stop any ongoing audio and animations immediately
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      
      // Clear any pending timers
      if (numberCallTimer.current) {
        clearTimeout(numberCallTimer.current);
        numberCallTimer.current = null;
      }
      
      // Reset all game state immediately
      setGameActive(false);
      setGameFinished(false);
      setGamePaused(false);
      setCalledNumbers([]);
      setMarkedNumbers([]);
      setBlinkingNumber(null);
      setLastCalledNumber(null);
      setActiveGameId(null);
      setBookedCartelas(new Set());
      setSelectedCartelas(new Set());
      setIsShuffling(false);
      setIsBoardShuffling(false);
      setIsHovering(false);
      setNextNumber(null);
      setAudioPlaying(false);
      setShowWinnerResult(false);
      setShowWinnerChecker(false);
      setWinnerCartelaNumber('');
      
      // Clear disqualification tracking
      setCheckedCartelas(new Set());
      setDisqualifiedCartelas(new Set());
      setShowDisqualificationPopup(false);
      setDisqualificationCartelaNumber(null);
      
      // Force immediate UI update by clearing all audio states
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      if (currentAudioRef) {
        currentAudioRef.pause();
        currentAudioRef.currentTime = 0;
        setCurrentAudioRef(null);
      }
      if (autoCallInterval) {
        clearInterval(autoCallInterval);
        setAutoCallInterval(null);
      }
      
      // Invalidate queries to force refresh and clear called numbers from cache
      queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mongodb/cartelas', user?.shopId] });
      queryClient.invalidateQueries({ queryKey: [`/api/mongodb/cartelas/${user?.shopId}`] });
      
      toast({
        title: "Reset Complete",
        description: "All cartelas and called numbers have been cleared"
      });
      
      // Force immediate refetch to ensure fresh data and visual update
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/mongodb/games/active'] });
        // Force re-render by triggering state update MULTIPLE times to ensure UI updates
        setCalledNumbers([]);
        setMarkedNumbers([]);
        setBlinkingNumber(null);
        setLastCalledNumber(null);
        
        // Force another state update after a brief delay to ensure visual reset
        setTimeout(() => {
          setCalledNumbers([]);
          setMarkedNumbers([]);
          setBlinkingNumber(null);
          setLastCalledNumber(null);
          console.log('🔄 FORCED RESET: Called numbers should be cleared now');
          
          // Additional forced clear to overcome any timing issues
          setTimeout(() => {
            setCalledNumbers([]);
            setMarkedNumbers([]);
            setBlinkingNumber(null);
            setLastCalledNumber(null);
            console.log('🔄 TRIPLE RESET: Final clear to ensure board is empty');
          }, 100);
        }, 50);
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to end game",
        variant: "destructive"
      });
    }
  });

  // Check winner function - immediately pauses game when called
  const checkWinner = async () => {
    // IMMEDIATELY PAUSE THE GAME AND STOP ALL AUDIO/TIMERS
    setGamePaused(true);
    
    // Clear any ongoing auto-call intervals
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
    
    // Clear any number call timers
    if (numberCallTimer.current) {
      clearTimeout(numberCallTimer.current);
      numberCallTimer.current = null;
    }
    
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    if (currentAudioRef) {
      currentAudioRef.pause();
      currentAudioRef.currentTime = 0;
      setCurrentAudioRef(null);
    }
    
    setAudioPlaying(false);
    setIsAutoCall(false);
    
    // Prevent checking winner if game is already finished
    if (gameFinished) {
      toast({
        title: "Game Already Finished",
        description: "This game has already ended with a winner",
        variant: "destructive"
      });
      return;
    }
    
    console.log(`🔍 CHECKING WINNER - Game immediately paused, all audio stopped`);
    
    const cartelaNum = parseInt(winnerCartelaNumber);
    
    if (!cartelaNum || cartelaNum < 1) {
      toast({
        title: "Invalid Cartela",
        description: "Please enter a valid cartela number",
        variant: "destructive"
      });
      return;
    }

    // Check if cartela is already disqualified
    if (disqualifiedCartelas.has(cartelaNum)) {
      toast({
        title: "Cartela Disqualified",
        description: `Cartela #${cartelaNum} has been disqualified and cannot be checked for winner`,
        variant: "destructive"
      });
      return;
    }

    // Check if cartela has been checked before (first warning)
    if (checkedCartelas.has(cartelaNum)) {
      // Second attempt - show disqualification popup and play audio
      setDisqualificationCartelaNumber(cartelaNum);
      setShowDisqualificationPopup(true);
      
      // Play disqualification audio immediately - user interaction is already present
      const disqualificationAudio = getGameEventAudioPath('disqualified');
      console.log('🔊 Disqualification audio path:', disqualificationAudio);
      console.log('🔊 Selected voice:', selectedVoice);
      
      if (disqualificationAudio) {
        // Create and play audio immediately using user interaction context
        const audio = new Audio(disqualificationAudio);
        audio.volume = 0.8;
        
        audio.onloadeddata = () => console.log('✅ Disqualification audio loaded successfully');
        audio.oncanplaythrough = () => console.log('✅ Disqualification audio ready to play');
        audio.onerror = (error) => console.error('❌ Disqualification audio error:', error);
        
        // Force immediate playback using user gesture context
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('✅ Disqualification audio started playing automatically');
          }).catch(error => {
            console.error('❌ Failed to play disqualification audio automatically:', error);
            
            // Fallback: Try playing with a very short delay
            setTimeout(() => {
              audio.play().then(() => {
                console.log('✅ Disqualification audio started playing (delayed)');
              }).catch(delayedError => {
                console.error('❌ Delayed audio play also failed:', delayedError);
              });
            }, 100);
          });
        }
      } else {
        console.error('❌ No disqualification audio path found for voice:', selectedVoice);
      }
      
      // Add to disqualified cartelas
      setDisqualifiedCartelas(prev => new Set([...prev, cartelaNum]));
      
      return;
    }

    // Check if cartela is selected by employee OR marked by collector
    const isCartelaInGame = selectedCartelas.has(cartelaNum) || bookedCartelas.has(cartelaNum);
    
    if (!isCartelaInGame) {
      // Show red popup for not booked cartela
      setWinnerResult({
        isWinner: false,
        cartela: cartelaNum,
        message: "This cartela was not selected for this game",
        pattern: "",
        winningCells: []
      });
      setShowWinnerResult(true);
      setShowWinnerChecker(false);
      
      // Play "not selected" audio immediately with improved error handling
      const notSelectedAudio = getGameEventAudioPath('notSelected');
      console.log('🔊 Not selected audio path:', notSelectedAudio);
      console.log('🔊 Selected voice:', selectedVoice);
      
      if (notSelectedAudio) {
        const audio = new Audio();
        audio.volume = 0.8;
        // Removed preload for better performance
        
        // Enhanced error logging
        audio.onloadstart = () => console.log('🔄 Not selected audio load started');
        audio.onloadeddata = () => console.log('✅ Not selected audio data loaded');
        audio.oncanplay = () => console.log('✅ Not selected audio can play');
        audio.oncanplaythrough = () => console.log('✅ Not selected audio ready to play through');
        
        audio.onerror = (error) => {
          console.error('❌ Not selected audio error details:', {
            error: error,
            code: audio.error?.code,
            message: audio.error?.message,
            src: audio.src,
            readyState: audio.readyState,
            networkState: audio.networkState
          });
        };
        
        // Set source and try to play
        audio.src = notSelectedAudio;
        
        // Use a timeout to ensure audio is loaded before playing
        setTimeout(() => {
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log('✅ Not selected audio started playing automatically');
            }).catch(error => {
              console.error('❌ Failed to play not selected audio:', error);
              
              // Try alternative approach - create new audio instance
              setTimeout(() => {
                try {
                  const fallbackAudio = new Audio(notSelectedAudio);
                  fallbackAudio.volume = 0.8;
                  fallbackAudio.play().then(() => {
                    console.log('✅ Fallback not selected audio played successfully');
                  }).catch(fallbackError => {
                    console.error('❌ Fallback audio also failed:', fallbackError);
                  });
                } catch (err) {
                  console.error('❌ Failed to create fallback audio:', err);
                }
              }, 200);
            });
          }
        }, 100);
      } else {
        console.error('❌ No not selected audio path found for voice:', selectedVoice);
      }
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setShowWinnerResult(false);
      }, 3000);
      return;
    }

    // Check winner using API with actual cartela data
    try {
      const response = await fetch(`/api/mongodb/games/${activeGameId}/check-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartelaNumber: cartelaNum,
          calledNumbers: calledNumbers
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check winner');
      }

      const result = await response.json();
      
      if (!result.isWinner) {
        // NOT A WINNER - Show red popup but DON'T modify game state
        setWinnerResult({
          isWinner: false,
          cartela: cartelaNum,
          message: "This Cartela Did Not Win",
          pattern: "",
          winningCells: [],
          cartelaPattern: result.cartelaPattern
        });
        
        // Track this cartela as checked (first attempt)
        setCheckedCartelas(prev => new Set([...prev, cartelaNum]));
        
        // Clear any existing timer to prevent audio overlap
        if (numberCallTimer.current) {
          clearTimeout(numberCallTimer.current);
          numberCallTimer.current = null;
        }
        
        // Play loser sound with proper state management
        if (!audioPlaying) {
          setAudioPlaying(true);
          setTimeout(() => {
            try {
              const audioPath = getGameEventAudioPath('notWinner');
              if (audioPath) {
                const audio = new Audio(audioPath);
                audio.volume = 0.8;
                audio.onended = () => setAudioPlaying(false);
                audio.onerror = () => setAudioPlaying(false);
                audio.play().catch(() => {
                  console.log('Loser sound not available');
                  setAudioPlaying(false);
                });
              } else {
                setAudioPlaying(false);
              }
            } catch (error) {
              console.log('Loser audio playback error');
              setAudioPlaying(false);
            }
          }, 500);
        }
        
        setShowWinnerResult(true);
        setShowWinnerChecker(false);
        
        // Simply close the winner result dialog - NO AUTO-RESUME
        setTimeout(() => {
          setShowWinnerResult(false);
          console.log(`❌ NOT A WINNER - Game remains in its current state`);
        }, 2000);
        
      } else {
        // IS A WINNER - Immediately pause the game and show green popup
        setGamePaused(true);
        
        // Clear any ongoing auto-call intervals to prevent more numbers
        if (autoCallInterval) {
          clearInterval(autoCallInterval);
          setAutoCallInterval(null);
        }
        if (numberCallTimer.current) {
          clearTimeout(numberCallTimer.current);
          numberCallTimer.current = null;
        }
        
        setGameActive(false);
        setGameFinished(true);
        
        setWinnerResult({
          isWinner: true,
          cartela: cartelaNum,
          message: "Congratulations! This Cartela Has Won!",
          pattern: result.winningPattern || "",
          winningCells: result.winningCells || [],
          cartelaPattern: result.cartelaPattern
        });
        
        setShowWinnerResult(true);
        setShowWinnerChecker(false);
        
        // Submit winner to backend and complete the game
        try {
          // Get actual game entry fee from active game data
          const actualEntryFee = parseFloat(gameAmount || '20');
          // Use only bookedCartelas (actual database-marked cartelas) to avoid double-counting
          // selectedCartelas is local state that can overlap with bookedCartelas during active games
          const totalPlayersCount = bookedCartelas.size;
          const { winnerAmount } = calculateAmounts(); // Use the correct calculation from our function
          
          // Employee declaring winner (removed logging for performance)
          const winnerData = {
            cartelaNumber: cartelaNum,
            totalPlayers: totalPlayersCount,
            actualEntryFee,
            winnerAmount,
            bookedCartelas: Array.from(bookedCartelas),
            selectedCartelas: Array.from(selectedCartelas),
            calledNumbers: calledNumbers.length
          };
          
          await fetch(`/api/mongodb/games/${activeGameId}/declare-winner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              winnerCartelaNumber: cartelaNum,
              totalPlayers: totalPlayersCount,
              entryFeePerPlayer: actualEntryFee,
              totalCartelas: totalPlayersCount, // Send accurate total count
              allCartelaNumbers: Array.from(bookedCartelas), // Use only database-marked cartelas
              calledNumbers: calledNumbers,
              pattern: result.winningPattern
            })
          });
          
          // Mark game as completed to save to history
          await fetch(`/api/mongodb/games/${activeGameId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              winnerId: cartelaNum,
              winnerName: `Cartela ${cartelaNum}`,
              winningCartela: cartelaNum,
              prizeAmount: (parseFloat(gameAmount) * bookedCartelas.size).toString()
            })
          });
          
          // Game completed with winner - keep game in finished state
          // Manual reset required via reset button
          
          // Invalidate all related queries to update admin dashboard
          queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
          queryClient.invalidateQueries({ queryKey: ['/api/mongodb/analytics/shop'] });
          queryClient.invalidateQueries({ queryKey: ['/api/mongodb/analytics/trends'] });
          queryClient.invalidateQueries({ queryKey: ['/api/mongodb/analytics/profit-distribution'] });
          
          // Play winner sound
          try {
            const audioPath = getGameEventAudioPath('winner');
            if (audioPath) {
              const audio = new Audio(audioPath);
              audio.volume = 0.8;
              audio.play().catch(() => {
                console.log('Winner sound not available');
              });
            }
          } catch (error) {
            console.log('Winner audio playback error');
          }
          
          toast({
            title: "Winner Confirmed!",
            description: `Cartela #${cartelaNum} wins with ${result.winningPattern}`,
            duration: 5000
          });
          
        } catch (error) {
          console.error('Failed to declare winner:', error);
          toast({
            title: "Error",
            description: "Failed to process winner. Please try again.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Failed to check winner:', error);
      
      // Show error popup similar to "not winner" popup
      setWinnerResult({
        isWinner: false,
        cartela: cartelaNum,
        message: "Error checking cartela. Please try again.",
        pattern: "",
        winningCells: []
      });
      setShowWinnerResult(true);
      setShowWinnerChecker(false);
      
      toast({
        title: "Error",
        description: "Failed to check winner. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Pause game function - instantly stops audio, animations, and number calling like pausing music
  const pauseGame = async () => {
    if (!activeGameId) return;
    
    try {
      // Call backend to pause the game
      const response = await fetch(`/api/mongodb/games/${activeGameId}/pause`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: true })
      });
      
      if (response.ok) {
        setGamePaused(true);
        
        // FIRST: Stop ALL timers and intervals to prevent new audio
        if (numberCallTimer.current) {
          clearTimeout(numberCallTimer.current);
          numberCallTimer.current = null;
        }
        
        // Stop auto-call interval immediately
        if (autoCallInterval) {
          clearInterval(autoCallInterval);
          setAutoCallInterval(null);
        }
        setIsAutoCall(false);
        
        // IMMEDIATE AGGRESSIVE AUDIO STOP - like pausing music
        console.log('🛑 CHECK WINNER CLICKED: Stopping ALL audio immediately');
        
        // Stop current audio references
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio.remove && currentAudio.remove();
          setCurrentAudio(null);
        }
        
        if (currentAudioRef) {
          currentAudioRef.pause();
          currentAudioRef.currentTime = 0;
          currentAudioRef.remove && currentAudioRef.remove();
          setCurrentAudioRef(null);
        }
        
        // Clear any audio timeouts that might restart audio
        if (audioResetTimer) {
          clearTimeout(audioResetTimer);
        }
        
        // Reset all audio states immediately
        setAudioPlaying(false);
        
        // Aggressively find and stop ALL audio elements
        const allAudioElements = document.querySelectorAll('audio');
        console.log(`🛑 Found ${allAudioElements.length} audio elements to stop`);
        
        allAudioElements.forEach((audio, index) => {
          console.log(`🛑 Stopping audio element ${index + 1}: paused=${audio.paused}, currentTime=${audio.currentTime}`);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0; // Mute it completely
          // Try to remove from DOM if possible
          try {
            audio.remove();
          } catch (e) {
            // If removal fails, just disable it
            audio.src = '';
          }
        });
        
        console.log('🛑 AUDIO STOP COMPLETE: All audio should be silent now');
        
        // Stop all animations immediately
        setIsShuffling(false);
        setIsHovering(false);
        setNextNumber(null);
        
        // Clear any auto-calling intervals
        if (autoCallInterval) {
          clearInterval(autoCallInterval);
          setAutoCallInterval(null);
        }
        setIsAutoCall(false);
        setIsPaused(false);
        
        toast({
          title: "Game Paused",
          description: "Game has been paused"
        });
      }
    } catch (error) {
      console.error('Failed to pause game:', error);
      toast({
        title: "Error",
        description: "Failed to pause game",
        variant: "destructive"
      });
    }
  };

  // Resume game function - continues number calling
  const resumeGame = async () => {
    try {
      console.log(`▶️ RESUMING GAME: activeGameId=${activeGameId}, gamePaused=${gamePaused}`);
      
      // Call backend to resume the game
      const response = await fetch(`/api/mongodb/games/${activeGameId}/pause`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: false })
      });
      
      if (response.ok) {
        console.log(`✅ RESUME API SUCCESS - Setting gamePaused=false`);
        setGamePaused(false);
        
        // Resume paused audio if it exists
        if (pausedAudio && pausedAudioTime > 0) {
          pausedAudio.currentTime = pausedAudioTime;
          pausedAudio.play().then(() => {
            setCurrentAudio(pausedAudio);
            setPausedAudio(null);
            setPausedAudioTime(0);
          }).catch((error) => {
            console.log('Failed to resume audio:', error);
            setPausedAudio(null);
            setPausedAudioTime(0);
          });
        }
        
        // Force refresh active game state to prevent state corruption
        queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
        
        toast({
          title: "Game Resumed",
          description: "Game has been resumed"
        });
        
        // Resume calling numbers if game is still active and no audio is playing
        if (gameActive && !gameFinished && activeGameId && !pausedAudio) {
          setTimeout(() => {
            callNumberMutation.mutate();
          }, 500);
        }
        
        console.log(`▶️ RESUME COMPLETE: gamePaused=${false}, gameActive=${gameActive}`);
      } else {
        console.error(`❌ RESUME API FAILED: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to resume game:', error);
      toast({
        title: "Error",
        description: "Failed to resume game",
        variant: "destructive"
      });
    }
  };

  // Check for BINGO win patterns
  function checkBingoWin(cartelaPattern: number[][], calledNumbers: number[]): { isWinner: boolean; pattern?: string; winningCells?: number[] } {
    if (cartelaPattern.length !== 5) return { isWinner: false };
    
    // Check horizontal lines
    for (let row = 0; row < 5; row++) {
      let hasAllNumbers = true;
      for (let col = 0; col < 5; col++) {
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
      }
      if (hasAllNumbers) {
        const winningCells = [];
        for (let col = 0; col < 5; col++) {
          winningCells.push(row * 5 + col);
        }
        return { isWinner: true, pattern: `Horizontal Row ${row + 1}`, winningCells };
      }
    }
    
    // Check vertical lines
    for (let col = 0; col < 5; col++) {
      let hasAllNumbers = true;
      for (let row = 0; row < 5; row++) {
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
      }
      if (hasAllNumbers) {
        const letters = ['B', 'I', 'N', 'G', 'O'];
        const winningCells = [];
        for (let row = 0; row < 5; row++) {
          winningCells.push(row * 5 + col);
        }
        return { isWinner: true, pattern: `Vertical ${letters[col]} Column`, winningCells };
      }
    }
    
    // Check diagonal (top-left to bottom-right)
    let hasAllNumbers = true;
    for (let i = 0; i < 5; i++) {
      const num = cartelaPattern[i][i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
    }
    if (hasAllNumbers) {
      const winningCells = [];
      for (let i = 0; i < 5; i++) {
        winningCells.push(i * 5 + i);
      }
      return { isWinner: true, pattern: "Diagonal (Top-Left to Bottom-Right)", winningCells };
    }
    
    // Check diagonal (top-right to bottom-left)
    hasAllNumbers = true;
    for (let i = 0; i < 5; i++) {
      const num = cartelaPattern[i][4 - i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
    }
    if (hasAllNumbers) {
      const winningCells = [];
      for (let i = 0; i < 5; i++) {
        winningCells.push(i * 5 + (4 - i));
      }
      return { isWinner: true, pattern: "Diagonal (Top-Right to Bottom-Left)", winningCells };
    }
    
    return { isWinner: false };
  }

  // Check if admin has low credit balance
  const adminCreditBalance = parseFloat((adminData as any)?.creditBalance || '0');
  const showLowCreditWarning = adminData && adminCreditBalance < 500;

  return (
    <div className={`min-h-screen ${currentTheme.secondary} overflow-y-auto`}>
      {/* Admin Low Credit Warning */}
      {showLowCreditWarning && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                <strong>⚠ Admin Low Credit Balance</strong>
                <br />
                Shop admin balance is low. Contact admin to add more credits.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`${currentTheme.cardBg} shadow-sm ${currentTheme.border} border-b p-4`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-xl font-bold ${currentTheme.text}`}>Bingo Play</h1>
            <p className={`text-sm ${currentTheme.text} opacity-75`}>
              {user?.username} - employee
            </p>
          </div>
          
          {/* Center - Winner Amount */}
          <div className="text-center">
            <div className="text-6xl font-bold text-green-600">
              Winner Gets: <span className="text-8xl">{(() => {
                const amounts = calculateAmounts();
                // Display calculation completed
                return amounts.winnerAmount.toFixed(2);
              })()} Birr</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Voice Selection */}
            <div className="flex items-center space-x-2">
              <Volume2 className="h-5 w-5 text-gray-600" />
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female1">Female Voice</SelectItem>
                  <SelectItem value="alex">Alex (Male)</SelectItem>
                  <SelectItem value="melat">Melat (Female)</SelectItem>
                  <SelectItem value="arada">Arada (Male)</SelectItem>
                  <SelectItem value="real-arada">Real Arada (Male)</SelectItem>
                  <SelectItem value="tigrigna">Tigrigna (Female)</SelectItem>
                  <SelectItem value="oromifa">Oromifa (Female)</SelectItem>
                  <SelectItem value="betty">Betty (Female)</SelectItem>
                  <SelectItem value="nati">Nati (Male)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme Selection */}
            <div className="flex items-center space-x-2">
              <Palette className="h-5 w-5 text-gray-600" />
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic Blue</SelectItem>
                  <SelectItem value="dark">Dark Pro</SelectItem>
                  <SelectItem value="green">Green Success</SelectItem>
                  <SelectItem value="purple">Purple Premium</SelectItem>
                  <SelectItem value="orange">Orange Energy</SelectItem>
                  <SelectItem value="gobingo">GoBingo Style</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white">
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="game" className="w-full">
        <div className={`${currentTheme.cardBg} ${currentTheme.border} border-b px-4`}>
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="game">Bingo Game</TabsTrigger>
            <TabsTrigger value="collectors">Collectors</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="game" className="mt-0">
          <div className="flex">
        {/* Left Panel */}
        <div className="w-80 p-4">
          {/* Current Number Display */}
          <Card className="mb-4">
            <CardContent className="p-6 text-center">
              {activeGameId ? (
                <>
                  <div className="flex justify-center items-center mb-4">
                    {/* Show next number if hovering, otherwise show last called number */}
                    {isHovering && nextNumber ? (
                      <div className={`relative w-48 h-48 bg-gradient-to-br ${getBallColor(nextNumber)} rounded-full shadow-lg transform scale-110 animate-pulse transition-all duration-300`}>
                        {/* Ball shine effect */}
                        <div className="absolute top-4 left-6 w-8 h-8 bg-white/30 rounded-full blur-sm"></div>
                        <div className="absolute top-2 left-4 w-4 h-4 bg-white/50 rounded-full"></div>
                        
                        {/* Letter */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white font-black text-2xl">
                          {getLetterForNumber(nextNumber)}
                        </div>
                        
                        {/* Inner white circle for number background */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-32 bg-white rounded-full flex items-center justify-center">
                          <span className="text-gray-900 font-black text-6xl">
                            {nextNumber}
                          </span>
                        </div>
                      </div>
                    ) : lastCalledNumber ? (
                      <div className={`relative w-48 h-48 bg-gradient-to-br ${getBallColor(lastCalledNumber)} rounded-full shadow-lg transform ${isShuffling ? 'animate-bounce scale-110' : 'hover:scale-105'} transition-all duration-300`}>
                        {/* Ball shine effect */}
                        <div className="absolute top-4 left-6 w-8 h-8 bg-white/30 rounded-full blur-sm"></div>
                        <div className="absolute top-2 left-4 w-4 h-4 bg-white/50 rounded-full"></div>
                        
                        {/* Letter */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white font-black text-2xl">
                          {getLetterForNumber(lastCalledNumber)}
                        </div>
                        
                        {/* Inner white circle for number background */}
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-32 bg-white rounded-full flex items-center justify-center">
                          <span className="text-gray-900 font-black text-6xl">
                            {lastCalledNumber}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-48 h-48 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full shadow-lg">
                        <div className="absolute top-4 left-6 w-8 h-8 bg-white/30 rounded-full blur-sm"></div>
                        <div className="absolute top-2 left-4 w-4 h-4 bg-white/50 rounded-full"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white font-black text-2xl">?</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-medium">
                    {isHovering ? "Next Number..." : isShuffling ? "CALLING..." : lastCalledNumber ? `${getLetterForNumber(lastCalledNumber)}-${lastCalledNumber}` : "Ready to Call"}
                  </p>
                </>
              ) : (
                <>
                  <div className="relative w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full shadow-lg mx-auto mb-4">
                    <div className="absolute top-2 left-3 w-4 h-4 bg-white/30 rounded-full blur-sm"></div>
                    <div className="absolute top-1 left-2 w-2 h-2 bg-white/50 rounded-full"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-black text-xs">START</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Create a Game to Begin</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Game Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Game Amount (Birr)</Label>
                  <Input
                    type="number"
                    value={gameAmount}
                    onChange={(e) => setGameAmount(e.target.value)}
                    disabled={gameActive}
                    className="mt-1"
                  />
                </div>

                {/* Speed Control */}
                <div>
                  <Label className="text-sm font-medium">Auto Play Speed</Label>
                  <div className="mt-2 space-y-2">
                    <Input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={autoPlaySpeed}
                      onChange={(e) => setAutoPlaySpeed(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Fast (1s)</span>
                      <span className="font-medium">{autoPlaySpeed}s between numbers</span>
                      <span>Slow (10s)</span>
                    </div>
                  </div>
                </div>

                {/* Available Cartelas for Game */}
                <div>
                  <Label className="text-sm font-medium">Cartelas for Game</Label>
                  <div className="flex flex-wrap gap-1 mt-2 min-h-[2rem]">
                    {/* Show collector-marked cartelas */}
                    {(cartelas || [])
                      .filter((c: any) => c.collectorId !== null && c.collectorId !== undefined)
                      .map((c: any) => {
                        const cartelaNum = c.cartelaNumber;
                        const isDisqualified = disqualifiedCartelas.has(cartelaNum);
                        const isChecked = checkedCartelas.has(cartelaNum);
                        
                        let badgeClass = "bg-green-500 text-white";
                        let badgeText = `#${cartelaNum} (Collector)`;
                        
                        if (isDisqualified) {
                          badgeClass = "bg-red-600 text-white";
                          badgeText = `#${cartelaNum} (DISQUALIFIED)`;
                        } else if (isChecked) {
                          badgeClass = "bg-yellow-600 text-white";
                          badgeText = `#${cartelaNum} (⚠️ Checked)`;
                        }
                        
                        return (
                          <Badge key={cartelaNum} className={badgeClass}>
                            {badgeText}
                          </Badge>
                        );
                      })}
                    {/* Show employee-selected cartelas */}
                    {(cartelas || [])
                      .filter((c: any) => c.bookedBy === user?.id)
                      .map((c: any) => {
                        const cartelaNum = c.cartelaNumber;
                        const isDisqualified = disqualifiedCartelas.has(cartelaNum);
                        const isChecked = checkedCartelas.has(cartelaNum);
                        
                        let badgeClass = "bg-blue-500 text-white";
                        let badgeText = `#${cartelaNum} (Manual)`;
                        
                        if (isDisqualified) {
                          badgeClass = "bg-red-600 text-white";
                          badgeText = `#${cartelaNum} (DISQUALIFIED)`;
                        } else if (isChecked) {
                          badgeClass = "bg-yellow-600 text-white";
                          badgeText = `#${cartelaNum} (⚠️ Checked)`;
                        }
                        
                        return (
                          <Badge key={cartelaNum} className={badgeClass}>
                            {badgeText}
                          </Badge>
                        );
                      })}
                    {bookedCartelas.size === 0 && selectedCartelas.size === 0 && (
                      <span className="text-xs text-gray-500 italic">
                        No cartelas ready - collectors can mark cartelas or you can select manually
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Total cartelas: {(cartelas || []).filter((c: any) => 
                      (c.collectorId !== null && c.collectorId !== undefined) || 
                      c.bookedBy === user?.id
                    ).length}
                  </div>
                  {/* Legend for cartela status colors */}
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span>Collector cartelas</span>
                      <div className="w-3 h-3 bg-blue-500 rounded ml-2"></div>
                      <span>Manual cartelas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                      <span>⚠️ Checked once (next attempt = disqualified)</span>
                      <div className="w-3 h-3 bg-red-600 rounded ml-2"></div>
                      <span>Disqualified</span>
                    </div>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => setShowCartelaSelector(true)}
                    disabled={gameActive || resetGameMutation.isPending}
                    className={`${currentTheme.primary} text-white`}
                  >
                    Add More
                  </Button>
                  <Button 
                    onClick={() => {
                      console.log('🔄 RESET CLICKED - Current state:', {
                        activeGameId,
                        gameFinished,
                        selectedCartelasSize: selectedCartelas.size,
                        bookedCartelasSize: bookedCartelas.size,
                        resetPending: resetGameMutation.isPending
                      });
                      
                      if (!resetGameMutation.isPending) {
                        // Always use reset mutation for consistency
                        console.log('🔄 Using reset mutation');
                        resetGameMutation.mutate();
                      }
                    }}
                    disabled={resetGameMutation.isPending}
                    variant="outline"
                  >
                    {resetGameMutation.isPending ? "Resetting..." : "Reset"}
                  </Button>
                  
                  {!activeGameId ? (
                    <Button 
                      onClick={() => createGameMutation.mutate()}
                      disabled={(selectedCartelas.size === 0 && bookedCartelas.size === 0) || createGameMutation.isPending}
                      className={`${currentTheme.gameButton} text-white`}
                    >
                      {createGameMutation.isPending ? "Starting..." : "Start Game"}
                    </Button>
                  ) : !gameActive && !gameFinished ? (
                    <Button 
                      onClick={() => startGameMutation.mutate()}
                      disabled={startGameMutation.isPending}
                      className={`${currentTheme.gameButton} text-white`}
                    >
                      {startGameMutation.isPending ? "Starting..." : "Start Game"}
                    </Button>
                  ) : gameFinished ? (
                    <Button 
                      onClick={() => {
                        // Manually reset all state for new game
                        setGameActive(false);
                        setGameFinished(false);
                        setCalledNumbers([]);
                        setMarkedNumbers([]);
                        setLastCalledNumber(null);
                        setActiveGameId(null);
                        setBookedCartelas(new Set());
                        setSelectedCartelas(new Set());
                        setWinnerResult({ isWinner: false, cartela: 0, message: "", pattern: "", winningCells: [], cartelaPattern: undefined });
                        setShowWinnerResult(false);
                        setGamePaused(false);
                        
                        // Clear any auto-calling states
                        if (autoCallInterval) {
                          clearInterval(autoCallInterval);
                          setAutoCallInterval(null);
                        }
                        if (currentAudio) {
                          currentAudio.pause();
                          currentAudio.currentTime = 0;
                          setCurrentAudio(null);
                        }
                        // Clear current audio reference
                        if (currentAudioRef) {
                          currentAudioRef.pause();
                          currentAudioRef.currentTime = 0;
                          setCurrentAudioRef(null);
                        }
                        setAudioPlaying(false);
                        setIsAutoCall(false);
                        setIsPaused(false);
                        setIsShuffling(false);
                        setIsHovering(false);
                        setNextNumber(null);
                        
                        queryClient.invalidateQueries({ queryKey: ['/api/mongodb/games/active'] });
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      New Game
                    </Button>
                  ) : gameActive ? (
                    <Button 
                      onClick={() => {
                        // Button clicked - pause/resume toggle
                        if (gamePaused) {
                          console.log(`▶️ Calling resumeGame()`);
                          resumeGame();
                        } else {
                          console.log(`⏸️ Calling enhancedPauseGame()`);
                          enhancedPauseGame();
                        }
                      }}
                      className={gamePaused ? "bg-green-500 hover:bg-green-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}
                    >
                      {(() => {
                        const buttonText = gamePaused ? "Resume Game" : "Pause Game";
                        // Button render state updated
                        return buttonText;
                      })()}
                    </Button>
                  ) : null}
                  
                  {gameActive ? (
                    <Button 
                      onClick={() => resetGameMutation.mutate()}
                      disabled={resetGameMutation.isPending}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      {resetGameMutation.isPending ? "Ending..." : "End Game"}
                    </Button>
                  ) : (
                    <Button 
                      onClick={restartGame}
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      Restart
                    </Button>
                  )}
                </div>


              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - BINGO Board */}
        <div className="flex-1 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Called Numbers Board</CardTitle>
              <p className="text-center text-sm text-gray-600">
                Numbers Called: {calledNumbers.length}
              </p>
            </CardHeader>
            <CardContent>
              {/* Horizontal BINGO Board */}
              <div className="space-y-2">
                {/* B Row */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center font-bold text-sm">
                    B
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1">
                    {Array.from({length: 15}, (_, i) => i + 1).map((num, index) => {
                      const shuffledNum = isBoardShuffling && shuffledPositions.length > 0 ? shuffledPositions[index] : num;
                      return (
                        <div 
                          key={num} 
                          className={`h-16 w-16 rounded flex items-center justify-center text-2xl font-black transition-all duration-200 ${
                            isBoardShuffling 
                              ? 'animate-pulse bg-yellow-200 text-black transform scale-110' 
                              : blinkingNumber === num
                                ? 'bg-red-500 text-white slow-blink' 
                              : markedNumbers.includes(num) 
                                ? 'bg-red-500 text-white' 
                                : 'bg-gray-100 text-black border'
                          }`}
                        >
                          {shuffledNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* I Row */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded flex items-center justify-center font-bold text-sm">
                    I
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1">
                    {Array.from({length: 15}, (_, i) => i + 16).map((num, index) => {
                      const shuffledNum = isBoardShuffling && shuffledPositions.length > 0 ? shuffledPositions[index + 15] : num;
                      return (
                        <div 
                          key={num} 
                          className={`h-16 w-16 rounded flex items-center justify-center text-2xl font-black transition-all duration-200 ${
                            isBoardShuffling 
                              ? 'animate-pulse bg-yellow-200 text-black transform scale-110' 
                              : blinkingNumber === num
                                ? 'bg-blue-500 text-white slow-blink' 
                              : markedNumbers.includes(num) 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 text-black border'
                          }`}
                        >
                          {shuffledNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* N Row */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 text-white rounded flex items-center justify-center font-bold text-sm">
                    N
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1">
                    {Array.from({length: 15}, (_, i) => i + 31).map((num, index) => {
                      const shuffledNum = isBoardShuffling && shuffledPositions.length > 0 ? shuffledPositions[index + 30] : num;
                      return (
                        <div 
                          key={num} 
                          className={`h-16 w-16 rounded flex items-center justify-center text-2xl font-black transition-all duration-200 ${
                            isBoardShuffling 
                              ? 'animate-pulse bg-yellow-200 text-black transform scale-110' 
                              : blinkingNumber === num
                                ? 'bg-green-500 text-white slow-blink' 
                              : markedNumbers.includes(num) 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-100 text-black border'
                          }`}
                        >
                          {shuffledNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* G Row */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-500 text-white rounded flex items-center justify-center font-bold text-sm">
                    G
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1">
                    {Array.from({length: 15}, (_, i) => i + 46).map((num, index) => {
                      const shuffledNum = isBoardShuffling && shuffledPositions.length > 0 ? shuffledPositions[index + 45] : num;
                      return (
                        <div 
                          key={num} 
                          className={`h-16 w-16 rounded flex items-center justify-center text-2xl font-black transition-all duration-200 ${
                            isBoardShuffling 
                              ? 'animate-pulse bg-yellow-200 text-black transform scale-110' 
                              : blinkingNumber === num
                                ? 'bg-yellow-500 text-white slow-blink' 
                              : markedNumbers.includes(num) 
                                ? 'bg-yellow-500 text-white' 
                                : 'bg-gray-100 text-black border'
                          }`}
                        >
                          {shuffledNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* O Row */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded flex items-center justify-center font-bold text-sm">
                    O
                  </div>
                  <div className="grid grid-cols-15 gap-1 flex-1">
                    {Array.from({length: 15}, (_, i) => i + 61).map((num, index) => {
                      const shuffledNum = isBoardShuffling && shuffledPositions.length > 0 ? shuffledPositions[index + 60] : num;
                      return (
                        <div 
                          key={num} 
                          className={`h-16 w-16 rounded flex items-center justify-center text-2xl font-black transition-all duration-200 ${
                            isBoardShuffling 
                              ? 'animate-pulse bg-yellow-200 text-black transform scale-110' 
                              : blinkingNumber === num
                                ? 'bg-purple-500 text-white slow-blink' 
                              : markedNumbers.includes(num) 
                                ? 'bg-purple-500 text-white' 
                                : 'bg-gray-100 text-black border'
                          }`}
                        >
                          {shuffledNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-4 justify-center">
                <Button 
                  onClick={() => {
                    // IMMEDIATE AUDIO STOP - before any other processing
                    console.log('🛑 CHECK WINNER BUTTON: Immediate audio kill');
                    
                    // Kill all audio elements immediately and aggressively
                    const allAudioElements = document.querySelectorAll('audio');
                    allAudioElements.forEach((audio, index) => {
                      if (!audio.paused) {
                        console.log(`🛑 KILLING audio ${index + 1} mid-playback`);
                        audio.pause();
                        audio.currentTime = 0;
                        audio.volume = 0;
                        audio.src = '';
                      }
                    });
                    
                    // Stop all timers and intervals FIRST
                    if (autoCallInterval) {
                      clearInterval(autoCallInterval);
                      setAutoCallInterval(null);
                    }
                    if (numberCallTimer.current) {
                      clearTimeout(numberCallTimer.current);
                      numberCallTimer.current = null;
                    }
                    setIsAutoCall(false);
                    setAudioPlaying(false);
                    
                    // THEN pause the game formally
                    pauseGame();
                    setShowWinnerChecker(true);
                  }}
                  disabled={!activeGameId}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-8"
                >
                  Check Winner
                </Button>
                <Button 
                  onClick={shuffleBingoBoard}
                  disabled={isBoardShuffling}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8"
                >
                  {isBoardShuffling ? "Shuffling..." : "🎲 Shuffle Board"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cartela Selector Dialog */}
      <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Additional Manual Cartela Selection (Optional)</DialogTitle>
            <DialogDescription>
              You can manually select additional cartelas if needed. Selected: {selectedCartelas.size} cartelas | Collector-marked: {bookedCartelas.size} cartelas
              <br />
              <span className="text-sm text-blue-600 font-medium">
                • White cartelas: Available for manual selection
                • Gray cartelas: Already marked by collectors  
                • Red cartelas: Your manual selections
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-10 gap-4 p-6">
            {(cartelas || []).map((cartela: any) => (
              <div key={cartela.cartelaNumber} className="text-center">
                <div
                  className={`p-4 border rounded cursor-pointer text-center mb-2 text-2xl font-bold ${
                    selectedCartelas.has(cartela.cartelaNumber)
                      ? 'bg-red-400 text-white border-red-500'
                      : bookedCartelas.has(cartela.cartelaNumber)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => {
                    if (!bookedCartelas.has(cartela.cartelaNumber)) {
                      if (selectedCartelas.has(cartela.cartelaNumber)) {
                        // Unmark cartela in database and local state
                        unmarkCartelaByEmployeeMutation.mutate(cartela.cartelaNumber);
                        const newSelected = new Set(selectedCartelas);
                        newSelected.delete(cartela.cartelaNumber);
                        setSelectedCartelas(newSelected);
                      } else {
                        // Mark cartela in database and local state
                        markCartelaByEmployeeMutation.mutate(cartela.cartelaNumber);
                        const newSelected = new Set(selectedCartelas);
                        newSelected.add(cartela.cartelaNumber);
                        setSelectedCartelas(newSelected);
                      }
                    }
                  }}
                >
                  {cartela.cartelaNumber}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-2 py-1 h-5"
                  onClick={() => {
                    setPreviewCartela(cartela.cartelaNumber);
                    setShowCartelaPreview(true);
                  }}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center p-4 border-t">
            <span>Selected: {selectedCartelas.size} cartelas</span>
            <Button onClick={() => setShowCartelaSelector(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cartela Preview Dialog */}
      <Dialog open={showCartelaPreview} onOpenChange={setShowCartelaPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const cartela = (cartelas || []).find((c: any) => c.cartelaNumber === previewCartela);
                return cartela ? `${cartela.name} (#${previewCartela})` : `Cartela #${previewCartela} Preview`;
              })()}
            </DialogTitle>
            <DialogDescription>
              Real-time updated cartela pattern
            </DialogDescription>
          </DialogHeader>
          {previewCartela && (
            <div className="space-y-4">
              {/* BINGO Headers */}
              <div className="grid grid-cols-5 gap-1">
                {['B', 'I', 'N', 'G', 'O'].map((letter, index) => {
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                  return (
                    <div key={letter} className={`h-8 ${colors[index]} text-white rounded flex items-center justify-center font-bold text-sm`}>
                      {letter}
                    </div>
                  );
                })}
              </div>
              
              {/* Cartela Grid */}
              <div className="grid grid-cols-5 gap-1">
                {(() => {
                  const cartela = (cartelas || []).find((c: any) => c.cartelaNumber === previewCartela);
                  if (!cartela) return null;
                  
                  const grid = [];
                  for (let row = 0; row < 5; row++) {
                    for (let col = 0; col < 5; col++) {
                      const value = cartela.pattern[row][col];
                      
                      grid.push(
                        <div key={`${row}-${col}`} className="h-8 bg-gray-100 border rounded flex items-center justify-center text-sm font-medium">
                          {value === 0 ? "★" : value}
                        </div>
                      );
                    }
                  }
                  return grid;
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Winner Checker Dialog */}
      <Dialog open={showWinnerChecker} onOpenChange={setShowWinnerChecker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Winner</DialogTitle>
            <DialogDescription>
              Enter the cartela number to verify if it's a winner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cartelaNumber">Cartela Number</Label>
              <Input
                id="cartelaNumber"
                type="number"
                value={winnerCartelaNumber}
                onChange={(e) => setWinnerCartelaNumber(e.target.value)}
                placeholder="Enter cartela number"
                min="1"
              />
            </div>
            <Button onClick={checkWinner} className="w-full">
              Check Winner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Winner Result Dialog - Horizontal Layout */}
      <Dialog open={showWinnerResult} onOpenChange={setShowWinnerResult}>
        <DialogContent className={`max-w-4xl w-full ${winnerResult.isWinner ? "border-green-500" : "border-red-500"}`}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className={`text-xl ${winnerResult.isWinner ? "text-green-600" : "text-red-600"}`}>
              {winnerResult.isWinner ? "🎉 WINNER FOUND!" : "❌ NOT A WINNER"}
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowWinnerResult(false)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              ✕
            </Button>
          </DialogHeader>
          
          {winnerResult.isWinner ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Left side - Winner info and amount */}
              <div className="space-y-4 bg-green-50 p-6 rounded-lg">
                <div className="text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-xl font-bold text-green-600 mb-2">
                    Congratulations! This Cartela Has Won!
                  </div>
                  <div className="text-lg font-bold text-green-700 mb-2">
                    Cartela #{winnerResult.cartela}
                  </div>
                  <div className="text-md text-green-600 mb-4">
                    Winning Pattern: {winnerResult.pattern}
                  </div>
                </div>
                
                {/* Winner Amount Display */}
                <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-800 mb-2">💰 Winner Amount:</div>
                    <div className="text-2xl font-bold text-green-700">
                      {calculateAmounts().winnerAmount.toFixed(2)} Birr
                    </div>

                  </div>
                </div>
              </div>

              {/* Right side - Cartela grid */}
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center mb-4">
                  <div className="text-md font-medium text-green-700 mb-2">Cartela Grid:</div>
                  <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                    {/* Header */}
                    <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">B</div>
                    <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">I</div>
                    <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">N</div>
                    <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">G</div>
                    <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">O</div>
                    
                    {/* Cartela pattern */}
                    {(winnerResult.cartelaPattern || getFixedCartelaPattern(winnerResult.cartela)).flat().map((num, index) => {
                      const isWinningCell = winnerResult.winningCells?.includes(index);
                      const isCalled = num !== 0 && calledNumbers.includes(num);
                      const isFree = index === 12;
                      
                      return (
                        <div key={index} className={`text-center text-sm p-2 border-2 rounded ${
                          isWinningCell 
                            ? 'winner-cell-animation' 
                            : isFree
                              ? 'bg-yellow-200 border-yellow-300 font-medium' 
                              : isCalled
                                ? 'bg-green-200 border-green-400'
                                : 'bg-gray-50 border-gray-200'
                        }`}>
                          {isFree ? 'FREE' : num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="space-y-4 bg-red-50 p-6 rounded-lg max-w-md mx-auto">
                <div className="text-4xl mb-4">❌</div>
                <div className="text-xl font-bold text-red-600">
                  This Cartela Did Not Win
                </div>
                <div className="text-lg font-bold text-red-700">
                  Cartela #{winnerResult.cartela}
                </div>
                <div className="text-md text-red-600">
                  {winnerResult.message}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-center gap-4">
            <Button 
              onClick={() => {
                setShowWinnerResult(false);
                setAudioPlaying(false); // Reset audio state
                // Reset and resume game immediately if not a winner
                if (!winnerResult.isWinner && gamePaused) {
                  setGamePaused(false);
                  // Resume calling numbers immediately
                  setTimeout(() => {
                    if (activeGameId && gameActive && !gameFinished) {
                      callNumberMutation.mutate();
                    }
                  }, 100); // Minimal delay to ensure state is updated
                }
              }}
              className={`px-8 py-2 ${winnerResult.isWinner ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} text-white`}
            >
              {winnerResult.isWinner ? "Close & Complete Game" : "Continue Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disqualification Warning Popup */}
      <Dialog open={showDisqualificationPopup} onOpenChange={setShowDisqualificationPopup}>
        <DialogContent className="max-w-md bg-red-50 border-red-200">
          <DialogHeader className="text-center">
            <DialogTitle className="text-red-700 text-xl font-bold">
              ⚠️ Cartela Disqualified
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="text-lg font-semibold text-red-800 mb-4">
              Cartela #{disqualificationCartelaNumber} has been DISQUALIFIED
            </div>
            <div className="text-red-700 mb-4">
              This cartela was already checked once and found not to be a winner. 
              According to the rules, it cannot be checked again and is now disqualified from this game.
            </div>
            <div className="text-sm text-red-600 font-medium">
              This cartela cannot be used to declare winner for the rest of this game.
            </div>
          </div>
          <DialogFooter className="flex justify-center">
            <Button
              onClick={() => {
                setShowDisqualificationPopup(false);
                setDisqualificationCartelaNumber(null);
                setWinnerCartelaNumber('');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-8"
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="collectors" className="mt-0">
          <div className="p-6">
            <EmployeeCollectorManagement user={user as any} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}