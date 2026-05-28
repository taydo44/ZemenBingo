import type { Express, Request, Response } from "express";
import bcrypt from "bcrypt";
import {
  User,
  Shop,
  Game,
  Transaction,
  Cartela,
  CreditLoad,
} from "@shared/mongodb-schema";
import { connectMongoDB } from "./mongodb-db";

// Extend Express Request to include session
declare module "express-serve-static-core" {
  interface Request {
    session: any;
  }
}

export function registerMongoDBRoutes(app: Express): void {
  // Initialize MongoDB connection
  connectMongoDB().catch(console.error);

  // Authentication routes
  app.post("/api/mongodb/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      console.log(`MongoDB - Database user lookup: ${username}`);

      const user = await User.findOne({ username }).populate("shopId");

      if (!user) {
        console.log("MongoDB - Database user found: none");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(
        `MongoDB - Database user found: ${user.username} (id: ${user._id})`
      );

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Store user in session
      req.session.user = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        shopId: user.shopId?._id,
        creditBalance: user.creditBalance,
      };

      const userResponse = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
        shopId: user.shopId?._id,
        creditBalance: user.creditBalance.toString(),
        accountNumber: user.accountNumber,
        commissionRate: user.commissionRate.toString(),
        createdAt: user.createdAt,
      };

      res.json({ user: userResponse });
    } catch (error) {
      console.error("MongoDB login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mongodb/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await User.findById(req.session.user.id).populate("shopId");
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const userResponse = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
        shopId: user.shopId?._id,
        supervisorId: user.supervisorId,
        creditBalance: user.creditBalance.toString(),
        accountNumber: user.accountNumber,
        referredBy: user.referredBy,
        commissionRate: user.commissionRate.toString(),
        createdAt: user.createdAt,
      };

      res.json({ user: userResponse });
    } catch (error) {
      console.error("MongoDB auth/me error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/mongodb/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Super Admin routes
  app.get(
    "/api/mongodb/super-admin/admins",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }

        const admins = await User.find({ role: "admin" }).populate("shopId");

        const adminList = admins.map((admin) => ({
          id: admin._id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          isBlocked: admin.isBlocked,
          shopId: admin.shopId?._id,
          shopName: (admin.shopId as any)?.name,
          creditBalance: admin.creditBalance.toString(),
          accountNumber: admin.accountNumber,
          commissionRate: admin.commissionRate.toString(),
          createdAt: admin.createdAt,
        }));

        res.json(adminList);
      } catch (error) {
        console.error("MongoDB get admins error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    "/api/mongodb/super-admin/admins",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }

        const { username, password, name, email, shopName } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(400).json({ message: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const accountNumber = `BGO${Math.floor(Math.random() * 1000000000)}`;

        // Create user first with a temp shopId
        const admin = new User({
          username,
          password: hashedPassword,
          role: "admin",
          name,
          email,
          accountNumber,
          commissionRate: 25,
        });
        await admin.save();

        // Now create shop with the real adminId
        const shop = new Shop({
          name: shopName,
          adminId: admin._id,
        });
        await shop.save();

        // Link shop back to admin
        admin.shopId = shop._id as any;
        await admin.save();

        const adminResponse = {
          id: admin._id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          shopId: shop._id,
          shopName: shop.name,
          accountNumber: admin.accountNumber,
          commissionRate: admin.commissionRate.toString(),
          createdAt: admin.createdAt,
        };

        res.json(adminResponse);
      } catch (error) {
        console.error("MongoDB create admin error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
  // Shop and game routes
  app.get("/api/mongodb/shops", async (req: Request, res: Response) => {
    try {
      const shops = await Shop.find().populate(
        "adminId",
        "name username email"
      );
      res.json(shops);
    } catch (error) {
      console.error("MongoDB get shops error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mongodb/games/:shopId", async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const games = await Game.find({ shopId }).populate(
        "employeeId",
        "name username"
      );
      res.json(games);
    } catch (error) {
      console.error("MongoDB get games error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Status endpoint
  app.get("/api/mongodb/status", async (req: Request, res: Response) => {
    try {
      const userCount = await User.countDocuments();
      const shopCount = await Shop.countDocuments();
      const gameCount = await Game.countDocuments();

      res.json({
        status: "Connected to MongoDB",
        database: "bingomaster",
        collections: {
          users: userCount,
          shops: shopCount,
          games: gameCount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("MongoDB status error:", error);
      res.status(500).json({ message: "MongoDB connection error" });
    }
  });
  // ── SUPER ADMIN ROUTES ──────────────────────────────────────────

  app.get(
    "/api/mongodb/super-admin/current-eat-date",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const now = new Date();
        const eatDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        res.json({ date: eatDate.toISOString().split("T")[0] });
      } catch (error) {
        res.status(500).json({ message: "Failed to get EAT date" });
      }
    }
  );

  app.get(
    "/api/mongodb/super-admin/revenues",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { from, to, adminId } = req.query;
        const filter: any = { type: "revenue" };
        if (from || to) {
          filter.createdAt = {};
          if (from) filter.createdAt.$gte = new Date(from as string);
          if (to) filter.createdAt.$lte = new Date(to as string);
        }
        if (adminId) filter.adminId = adminId;
        const revenues = await Transaction.find(filter)
          .populate("adminId", "name username")
          .populate("shopId", "name")
          .sort({ createdAt: -1 });
        res.json(revenues);
      } catch (error) {
        res.status(500).json({ message: "Failed to get revenues" });
      }
    }
  );

  app.get(
    "/api/mongodb/super-admin/revenue-total",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { from, to } = req.query;
        const filter: any = { type: "revenue" };
        if (from || to) {
          filter.createdAt = {};
          if (from) filter.createdAt.$gte = new Date(from as string);
          if (to) filter.createdAt.$lte = new Date(to as string);
        }
        const result = await Transaction.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        res.json({ total: result[0]?.total || 0 });
      } catch (error) {
        res.status(500).json({ message: "Failed to get revenue total" });
      }
    }
  );

  app.get(
    "/api/mongodb/super-admin/daily-summaries",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { from, to } = req.query;
        const filter: any = {};
        if (from || to) {
          filter.createdAt = {};
          if (from) filter.createdAt.$gte = new Date(from as string);
          if (to) filter.createdAt.$lte = new Date(to as string);
        }
        const summaries = await Transaction.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              totalRevenue: { $sum: "$amount" },
              gameCount: { $sum: 1 },
            },
          },
          { $sort: { _id: -1 } },
        ]);
        res.json(summaries);
      } catch (error) {
        res.status(500).json({ message: "Failed to get daily summaries" });
      }
    }
  );

  app.post(
    "/api/mongodb/super-admin/daily-reset",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        res.json({ message: "Daily reset completed successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to perform daily reset" });
      }
    }
  );

  app.patch(
    "/api/mongodb/super-admin/admins/:adminId",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { adminId } = req.params;
        const updates = req.body;
        delete updates.password;
        const admin = await User.findByIdAndUpdate(adminId, updates, {
          new: true,
        }).select("-password");
        if (!admin) return res.status(404).json({ message: "Admin not found" });
        res.json(admin);
      } catch (error) {
        res.status(500).json({ message: "Failed to update admin" });
      }
    }
  );

  app.post(
    "/api/mongodb/super-admin/admins/:adminId/:action",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { adminId, action } = req.params;
        const isBlocked = action === "block";
        const admin = await User.findByIdAndUpdate(
          adminId,
          { isBlocked },
          { new: true }
        ).select("-password");
        if (!admin) return res.status(404).json({ message: "Admin not found" });
        res.json(admin);
      } catch (error) {
        res.status(500).json({ message: "Failed to update admin status" });
      }
    }
  );

  // ── CREDIT LOAD ROUTES ───────────────────────────────────────────

  app.get(
    "/api/mongodb/admin/credit-loads",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const creditLoads = await CreditLoad.find()
          .populate("adminId", "name username accountNumber")
          .populate("processedBy", "name username")
          .sort({ requestedAt: -1 });
        res.json(creditLoads);
      } catch (error) {
        res.status(500).json({ message: "Failed to get credit loads" });
      }
    }
  );

  app.post(
    "/api/mongodb/admin/credit-loads/:loadId/approve",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { loadId } = req.params;
        const creditLoad = await CreditLoad.findById(loadId);
        if (!creditLoad)
          return res.status(404).json({ message: "Credit load not found" });
        creditLoad.status = "confirmed";
        creditLoad.processedAt = new Date();
        creditLoad.processedBy = req.session.user.id;
        await creditLoad.save();
        await User.findByIdAndUpdate(creditLoad.adminId, {
          $inc: { creditBalance: creditLoad.amount },
        });
        res.json({ message: "Credit load approved", creditLoad });
      } catch (error) {
        res.status(500).json({ message: "Failed to approve credit load" });
      }
    }
  );

  app.post(
    "/api/mongodb/admin/credit-loads/:loadId/reject",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const { loadId } = req.params;
        const { notes } = req.body;
        const creditLoad = await CreditLoad.findById(loadId);
        if (!creditLoad)
          return res.status(404).json({ message: "Credit load not found" });
        creditLoad.status = "rejected";
        creditLoad.processedAt = new Date();
        creditLoad.processedBy = req.session.user.id;
        if (notes) creditLoad.notes = notes;
        await creditLoad.save();
        res.json({ message: "Credit load rejected", creditLoad });
      } catch (error) {
        res.status(500).json({ message: "Failed to reject credit load" });
      }
    }
  );

  app.get(
    "/api/mongodb/withdrawal-requests",
    async (req: Request, res: Response) => {
      try {
        if (!req.session.user || req.session.user.role !== "super_admin") {
          return res
            .status(403)
            .json({ message: "Super admin access required" });
        }
        const withdrawals = await Transaction.find({ type: "withdrawal" })
          .populate("adminId", "name username accountNumber")
          .sort({ createdAt: -1 });
        res.json(withdrawals);
      } catch (error) {
        res.status(500).json({ message: "Failed to get withdrawal requests" });
      }
    }
  );
  console.log("🍃 MongoDB routes registered successfully");
}
