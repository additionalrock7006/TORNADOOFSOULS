require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { requireAuth, requireRole, SECRET } = require("./views/middlewares/auth.js");

const app = express();
const PORT = process.env.PORT || 7001;

const allowedOrigins = [
  "http://localhost:5173",
  "https://creativitea-hiqatxds0-rivera-s-creativi-tea-website.vercel.app",
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim().replace(/\/+$/, ""))
    : []),
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

const MENU_FILE = path.join(__dirname, "menu.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

const users = [
  {
    username: process.env.OWNER_USERNAME || "owner",
    passwordHash: bcrypt.hashSync(process.env.OWNER_PASSWORD || "owner6767", 10),
    role: "owner",
  },
  {
    username: process.env.STAFF_USERNAME || "staff",
    passwordHash: bcrypt.hashSync(process.env.STAFF_PASSWORD || "staff6767", 10),
    role: "staff",
  },
];

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf-8");
    return fallbackValue;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return raw.trim() ? JSON.parse(raw) : fallbackValue;
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Cafe API is running" });
});

// Login (owner and staff)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username: user.username, role: user.role }, SECRET, {
    expiresIn: "8h",
  });
  res.json({ token, role: user.role, username: user.username });
});

// Public: Get all menu items
app.get("/api/menu", (req, res) => {
  try {
    const menu = readJsonFile(MENU_FILE, []);
    res.json(menu);
  } catch (err) {
    console.error("Failed to read menu.json:", err);
    res.status(500).json({ message: "Failed to load menu" });
  }
});

// Owner only: Update menu item & price
app.put("/api/menu/:id", requireAuth, requireRole("owner"), (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, basePrice, optionGroups } = req.body || {};

    if (basePrice !== undefined) {
      const parsedPrice = Number(basePrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: "Invalid basePrice value" });
      }
    }

    const menu = readJsonFile(MENU_FILE, []);
    const itemIndex = menu.findIndex((item) => String(item.id) === String(id));

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const updatedItem = {
      ...menu[itemIndex],
      ...(name !== undefined ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
      ...(Array.isArray(optionGroups) ? { optionGroups } : {}),
    };

    menu[itemIndex] = updatedItem;
    writeJsonFile(MENU_FILE, menu);

    res.json(updatedItem);
  } catch (err) {
    console.error("Failed to update menu item:", err);
    res.status(500).json({ message: "Failed to update menu item" });
  }
});

// Public: Customer submits an order
app.post("/api/selections", (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Invalid order payload" });
    }

    const order = {
      ...req.body,
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      completed: false,
    };

    const orders = readJsonFile(ORDERS_FILE, []);
    orders.push(order);
    writeJsonFile(ORDERS_FILE, orders);

    console.log("New order received:", order);
    res.status(201).json({ message: "Order received", order });
  } catch (err) {
    console.error("Failed to save order:", err);
    res.status(500).json({ message: "Failed to save order" });
  }
});

// Staff & Owner: View incoming orders / transactions
app.get("/api/selections", requireAuth, requireRole("owner", "staff"), (req, res) => {
  try {
    const orders = readJsonFile(ORDERS_FILE, []);
    let needsSave = false;

    const normalizedOrders = orders.map((order, idx) => {
      if (!order.id) {
        needsSave = true;
        return { ...order, id: `ord_legacy_${Date.now()}_${idx}` };
      }
      return order;
    });

    if (needsSave) {
      writeJsonFile(ORDERS_FILE, normalizedOrders);
    }

    res.json(normalizedOrders);
  } catch (err) {
    console.error("Failed to read orders.json:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// Staff & Owner: Toggle or update order completion status
app.patch("/api/selections/:id", requireAuth, requireRole("owner", "staff"), (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body || {};

    const orders = readJsonFile(ORDERS_FILE, []);
    const index = orders.findIndex((order) => String(order.id) === String(id));

    if (index === -1) {
      return res.status(404).json({ message: "Order not found" });
    }

    const nextCompleted =
      completed !== undefined ? Boolean(completed) : !orders[index].completed;

    const updatedOrder = {
      ...orders[index],
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
    };

    orders[index] = updatedOrder;
    writeJsonFile(ORDERS_FILE, orders);

    res.json(updatedOrder);
  } catch (err) {
    console.error("Failed to update order:", err);
    res.status(500).json({ message: "Failed to update order" });
  }
});

// Staff & Owner: Delete a single order by ID
app.delete("/api/selections/:id", requireAuth, requireRole("owner", "staff"), (req, res) => {
  try {
    const { id } = req.params;
    const orders = readJsonFile(ORDERS_FILE, []);
    const filteredOrders = orders.filter((order) => String(order.id) !== String(id));

    if (filteredOrders.length === orders.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    writeJsonFile(ORDERS_FILE, filteredOrders);
    res.json({ message: "Order deleted", id });
  } catch (err) {
    console.error("Failed to delete order:", err);
    res.status(500).json({ message: "Failed to delete order" });
  }
});

// Owner only: Clear all orders/selections
app.delete("/api/selections", requireAuth, requireRole("owner"), (req, res) => {
  try {
    writeJsonFile(ORDERS_FILE, []);
    res.json({ message: "All selections cleared", orders: [] });
  } catch (err) {
    console.error("Failed to clear orders.json:", err);
    res.status(500).json({ message: "Failed to clear selections" });
  }
});

// Fallback JSON 404 for unmatched /api routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
