import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { registerMongoDBRoutes } from "./mongodb-routes";
import { initializeMongoDBData } from "./mongodb-setup";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
const MemoryStoreSession = MemoryStore(session);

// Add CORS headers for proper browser communication
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,OPTIONS,PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,Set-Cookie,Cookie"
  );
  res.header("Access-Control-Expose-Headers", "Set-Cookie");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Serve static audio files with proper MIME types (before other routes)
const publicPath = path.resolve(process.cwd(), "public");
app.use(
  express.static(publicPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp3")) {
        res.setHeader("Content-Type", "audio/mpeg");
      }
    },
  })
);

// Configure session middleware with memory store
app.use(
  session({
    store: new MemoryStoreSession({
      checkPeriod: 86400000,
    }),
    secret:
      process.env.SESSION_SECRET ||
      "bingo-session-secret-key-longer-for-security",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      domain: undefined,
    },
    name: "connect.sid",
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { server } = await registerRoutes(app);

  // Register MongoDB routes alongside PostgreSQL routes
  registerMongoDBRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = process.env.PORT || 5000;

  server
    .listen(port, "0.0.0.0", async () => {
      log(`serving on port ${port}`);

      try {
        await initializeMongoDBData();
      } catch (error) {
        console.log("MongoDB initialization failed (optional):", error.message);
      }

      console.log(
        "Hardcoded cartela auto-loading is disabled. Admins can add cartelas manually."
      );
    })
    .on("error", (err: any) => {
      log(`Failed to start server: ${err.message}`);
      process.exit(1);
    });
})();
