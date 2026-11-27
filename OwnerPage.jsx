import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./css/OwnerPage.css";
import { API_BASE_URL } from "./api.js";

function OwnerPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [selections, setSelections] = useState([]);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [savingId, setSavingId] = useState(null);
  const navigate = useNavigate();

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadSelections = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleAuthFailure();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/selections`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        handleAuthFailure();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to load orders");
      }
      setSelections(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus({ message: `Selections error: ${err.message}`, type: "error" });
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/menu`)
      .then((res) => res.json())
      .then((data) => setMenuItems(Array.isArray(data) ? data : []))
      .catch((err) =>
        setStatus({ message: `Menu error: ${err.message}`, type: "error" })
      );

    loadSelections();
  }, [loadSelections]);

  function handlePriceChange(id, newPrice) {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, basePrice: newPrice } : item
      )
    );
  }

  async function handleSave(item) {
    const token = localStorage.getItem("token");
    if (!token) {
      handleAuthFailure();
      return;
    }

    const parsedPrice = Number(item.basePrice);
    if (item.basePrice === "" || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setStatus({
        message: "Please enter a valid price of ₱0.00 or higher.",
        type: "error",
      });
      return;
    }

    setSavingId(item.id);
    setStatus({ message: "", type: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/api/menu/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: item.name,
          category: item.category,
          basePrice: parsedPrice,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update");
      }

      setMenuItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? data : entry))
      );
      setStatus({
        message: `Updated "${data.name}" to ₱${Number(data.basePrice).toFixed(2)}`,
        type: "success",
      });
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleClearSelections() {
    const token = localStorage.getItem("token");
    if (!token) {
      handleAuthFailure();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/selections`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthFailure();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to clear selections"
        );
      }
      setSelections([]);
      setStatus({ message: "All order transactions cleared.", type: "success" });
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: "error" });
    }
  }

  const completedOrders = selections.filter((s) => s.completed).length;

  return (
    <div className="owner-dashboard">
      <header className="owner-header">
        <div>
          <h2>Owner & Manager Portal</h2>
          <p className="owner-subtitle">
            Manage menu pricing and monitor live store transactions
          </p>
        </div>

        <Link to="/staff" className="btn-staff-link">
          Open Staff Kitchen View →
        </Link>
      </header>

      {status.message && (
        <div
          className={`owner-toast ${
            status.type === "error" ? "toast-error" : "toast-success"
          }`}
          role="status"
        >
          <span>{status.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setStatus({ message: "", type: "" })}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Menu Items</span>
          <span className="metric-value">{menuItems.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Orders</span>
          <span className="metric-value">{selections.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Completed Orders</span>
          <span className="metric-value">{completedOrders}</span>
        </div>
      </section>

      <section className="owner-card">
        <div className="card-header">
          <div>
            <h3>Menu Pricing</h3>
            <p className="card-desc">
              Adjust base prices and save changes directly to the live menu.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="menu-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Base Price</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-table-cell">
                    No menu items found.
                  </td>
                </tr>
              ) : (
                menuItems.map((item) => (
                  <tr key={item.id}>
                    <td className="item-name-cell">{item.name}</td>
                    <td>
                      <span className="category-pill">
                        {item.category || "Uncategorized"}
                      </span>
                    </td>
                    <td>
                      <div className="price-input-group">
                        <span className="currency-prefix">₱</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="price-input"
                          value={item.basePrice}
                          onChange={(e) =>
                            handlePriceChange(item.id, e.target.value)
                          }
                        />
                      </div>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-save"
                        disabled={savingId === item.id}
                        onClick={() => handleSave(item)}
                      >
                        {savingId === item.id ? "Saving..." : "Save Changes"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="owner-card">
        <div className="card-header card-header-flex">
          <div>
            <h3>Orders & Transactions</h3>
            <p className="card-desc">
              Currently tracking {selections.length} order record(s) in the
              system.
            </p>
          </div>

          <div className="transaction-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={loadSelections}
            >
              ↻ Refresh Orders
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleClearSelections}
              disabled={selections.length === 0}
            >
              Clear All Orders
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OwnerPage;
