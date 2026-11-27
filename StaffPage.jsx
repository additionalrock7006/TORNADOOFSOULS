import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./css/StaffPage.css";
import { API_BASE_URL } from "./api.js";

function formatTimestamp(createdAt) {
  if (!createdAt) return "Just now";
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? createdAt
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildMenuLookup(menuItems) {
  const byId = new Map();
  const byName = new Map();

  for (const item of menuItems) {
    if (item.id) byId.set(String(item.id), item);
    if (item.name) byName.set(String(item.name).toLowerCase(), item);
  }

  return { byId, byName };
}

function resolveMenuItem(order, lookup) {
  if (order.itemId && lookup.byId.has(String(order.itemId))) {
    return lookup.byId.get(String(order.itemId));
  }
  if (order.productId && lookup.byId.has(String(order.productId))) {
    return lookup.byId.get(String(order.productId));
  }
  if (order.id && lookup.byId.has(String(order.id))) {
    return lookup.byId.get(String(order.id));
  }

  const candidateName =
    order.itemName || order.productName || order.name || "";
  if (candidateName && lookup.byName.has(String(candidateName).toLowerCase())) {
    return lookup.byName.get(String(candidateName).toLowerCase());
  }

  return null;
}

function formatOrderDetails(order, menuItem) {
  const groupLabelMap = new Map();
  const optionPriceMap = new Map();

  if (Array.isArray(menuItem?.optionGroups)) {
    for (const group of menuItem.optionGroups) {
      const cleanLabel = (group.label || group.key || "").replace(/:$/, "");
      if (group.key) groupLabelMap.set(group.key, cleanLabel);
      if (group.label) groupLabelMap.set(group.label, cleanLabel);

      if (Array.isArray(group.options)) {
        for (const opt of group.options) {
          optionPriceMap.set(
            `${group.key}:${opt.label}`,
            Number(opt.priceChange || 0)
          );
        }
      }
    }
  }

  const rawSelections =
    order.selections ??
    order.options ??
    order.selectedOptions ??
    order.customizations ??
    null;

  const lines = [];
  let calculatedAddonTotal = 0;

  if (Array.isArray(rawSelections)) {
    for (const entry of rawSelections) {
      if (typeof entry === "object" && entry !== null) {
        const key = entry.key || entry.groupKey || entry.label || "";
        const label = groupLabelMap.get(key) || key;
        const value =
          entry.value ?? entry.selected ?? entry.option ?? entry.label ?? "";
        const delta =
          entry.priceChange !== undefined
            ? Number(entry.priceChange)
            : optionPriceMap.get(`${key}:${value}`) || 0;
        calculatedAddonTotal += delta;

        lines.push(
          label && value && label !== value
            ? `${label}: ${value}${delta > 0 ? ` (+₱${delta})` : ""}`
            : `${value || label}${delta > 0 ? ` (+₱${delta})` : ""}`
        );
      } else if (entry !== undefined && entry !== null && entry !== "") {
        lines.push(String(entry));
      }
    }
  } else if (typeof rawSelections === "object" && rawSelections !== null) {
    for (const [key, val] of Object.entries(rawSelections)) {
      if (val === undefined || val === null || val === "") continue;
      const label = groupLabelMap.get(key) || key;
      const values = Array.isArray(val) ? val : [val];

      for (const v of values) {
        const delta = optionPriceMap.get(`${key}:${v}`) || 0;
        calculatedAddonTotal += delta;
        lines.push(`${label}: ${v}${delta > 0 ? ` (+₱${delta})` : ""}`);
      }
    }
  }

  if (Array.isArray(menuItem?.optionGroups)) {
    for (const group of menuItem.optionGroups) {
      const topVal = order[group.key];
      if (topVal !== undefined && topVal !== null && topVal !== "") {
        const cleanLabel = (group.label || group.key).replace(/:$/, "");
        const values = Array.isArray(topVal) ? topVal : [topVal];
        for (const v of values) {
          const formatted = `${cleanLabel}: ${v}`;
          if (!lines.some((l) => l.startsWith(`${cleanLabel}:`))) {
            const delta = optionPriceMap.get(`${group.key}:${v}`) || 0;
            calculatedAddonTotal += delta;
            lines.push(`${formatted}${delta > 0 ? ` (+₱${delta})` : ""}`);
          }
        }
      }
    }
  }

  return { lines, calculatedAddonTotal };
}

function StaffPage() {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setIsLoading(true);
      setStatus("");

      const [menuRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/menu`),
        fetch(`${API_BASE_URL}/api/selections`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) {
        handleAuthFailure();
        return;
      }

      const menuData = menuRes.ok ? await menuRes.json() : [];
      const ordersData = await ordersRes.json();

      if (!ordersRes.ok) {
        throw new Error(
          ordersData.error || ordersData.message || "Failed to load orders"
        );
      }

      setMenuItems(Array.isArray(menuData) ? menuData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthFailure, navigate]);

  async function handleToggleComplete(order) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const nextCompleted = !Boolean(order.completed);

    try {
      setStatus("");
      const res = await fetch(`${API_BASE_URL}/api/selections/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to update order");
      }

      setOrders((prev) =>
        prev.map((entry) => (entry.id === order.id ? data : entry))
      );
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function handleDeleteOrder(id) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setStatus("");
      const res = await fetch(`${API_BASE_URL}/api/selections/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to delete order");
      }

      setOrders((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  const menuLookup = buildMenuLookup(menuItems);

  const activeCount = orders.filter((o) => !o.completed).length;
  const completedCount = orders.filter((o) => o.completed).length;

  const filteredOrders = orders.filter((order) => {
    if (filter === "active") return !order.completed;
    if (filter === "completed") return Boolean(order.completed);
    return true;
  });

  return (
    <div className="staff-dashboard">
      <header className="staff-header">
        <div className="staff-title-group">
          <h2>Incoming Orders</h2>
          <div className="staff-stats">
            <span className="stat-badge stat-pending">
              {activeCount} Pending
            </span>
            <span className="stat-badge stat-completed">
              {completedCount} Completed
            </span>
          </div>
        </div>

        <div className="staff-controls">
          <div className="filter-tabs" role="tablist">
            <button
              type="button"
              className={`filter-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({orders.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filter === "active" ? "active" : ""}`}
              onClick={() => setFilter("active")}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              className={`filter-tab ${filter === "completed" ? "active" : ""}`}
              onClick={() => setFilter("completed")}
            >
              Completed ({completedCount})
            </button>
          </div>

          <button
            type="button"
            className="btn-refresh"
            onClick={loadData}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </header>

      {status && (
        <div className="staff-alert" role="alert">
          {status}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">
            {orders.length === 0
              ? "No incoming orders yet"
              : `No ${filter} orders`}
          </p>
          <p className="empty-state-sub">
            New customer orders will appear here when refreshed.
          </p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => {
            const matchedMenu = resolveMenuItem(order, menuLookup);
            const itemName =
              matchedMenu?.name ||
              order.itemName ||
              order.productName ||
              order.name ||
              "Order Item";
            const category = matchedMenu?.category || order.category;
            const quantity = Number(order.quantity ?? order.qty ?? 1) || 1;
            const { lines: optionLines, calculatedAddonTotal } =
              formatOrderDetails(order, matchedMenu);

            const unitBase =
              order.unitPrice !== undefined
                ? Number(order.unitPrice)
                : matchedMenu?.basePrice !== undefined
                ? Number(matchedMenu.basePrice)
                : null;

            const explicitTotal =
              order.totalPrice ?? order.total ?? order.price;

            const computedTotal =
              explicitTotal !== undefined
                ? Number(explicitTotal)
                : unitBase !== null
                ? (unitBase + calculatedAddonTotal) * quantity
                : null;

            const customer = order.customerName || order.customer;
            const notes = order.notes || order.note || order.remarks;

            return (
              <article
                key={order.id}
                className={`order-card ${
                  order.completed ? "is-completed" : ""
                }`}
              >
                <div className="order-card-top">
                  <div className="order-meta">
                    <span className="order-id">#{order.id}</span>
                    <span className="order-dot">•</span>
                    <span className="order-time">
                      {formatTimestamp(order.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`status-pill ${
                      order.completed ? "done" : "pending"
                    }`}
                  >
                    {order.completed ? "Completed" : "Preparing"}
                  </span>
                </div>

                <div className="order-body">
                  <div className="order-item-row">
                    <span className="order-qty">{quantity}×</span>
                    <div className="order-item-info">
                      <h3 className="order-item-name">{itemName}</h3>
                      {category && (
                        <span className="order-category">{category}</span>
                      )}
                    </div>
                    {computedTotal !== null && !Number.isNaN(computedTotal) && (
                      <span className="order-price">
                        ₱{computedTotal.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {customer && (
                    <div className="order-customer">
                      <span className="meta-label">Customer:</span> {customer}
                    </div>
                  )}

                  {optionLines.length > 0 && (
                    <ul className="order-options">
                      {optionLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}

                  {notes && (
                    <div className="order-notes">
                      <strong>Note:</strong> {notes}
                    </div>
                  )}
                </div>

                <div className="order-actions">
                  <button
                    type="button"
                    className={`btn-action ${
                      order.completed ? "btn-undo" : "btn-complete"
                    }`}
                    onClick={() => handleToggleComplete(order)}
                  >
                    {order.completed ? "Undo Complete" : "✓ Mark Complete"}
                  </button>
                  <button
                    type="button"
                    className="btn-action btn-delete"
                    onClick={() => handleDeleteOrder(order.id)}
                    aria-label="Delete order"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StaffPage;
