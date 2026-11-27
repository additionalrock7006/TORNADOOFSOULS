import { useState } from "react";
import { useCart } from "./AddToCartSystem.jsx";
import { API_BASE_URL } from "./api.js";

function CartDrawer({ isOpen, onClose }) {
  const { items, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!isOpen) return null;

  async function handleCheckout(e) {
    e.preventDefault();
    if (items.length === 0) return;

    setIsCheckingOut(true);
    setFeedback("");

    try {
      for (const entry of items) {
        const payload = {
          itemId: entry.itemId,
          itemName: entry.itemName,
          category: entry.category,
          selections: entry.selections,
          unitPrice: entry.unitPrice,
          quantity: entry.quantity,
          totalPrice: entry.totalPrice,
          notes: entry.notes,
          ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        };

        const response = await fetch(`${API_BASE_URL}/api/selections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to submit "${entry.itemName}"`);
        }

        removeFromCart(entry.cartItemId);
      }

      clearCart();
      setCustomerName("");
      setFeedback("Order sent to the counter!");
    } catch (err) {
      setFeedback(`Checkout failed: ${err.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Your Cart">
      <div className="modal-box">
        <button type="button" onClick={onClose} aria-label="Close cart">
          ✕
        </button>

        <h2>Your Cart</h2>
        {feedback && <p>{feedback}</p>}

        {items.length === 0 ? (
          <p>Your cart is currently empty.</p>
        ) : (
          <form onSubmit={handleCheckout}>
            <ul>
              {items.map((entry) => {
                const optionEntries = Object.entries(entry.selections || {}).filter(
                  ([, val]) => val !== undefined && val !== null && val !== ""
                );

                return (
                  <li key={entry.cartItemId}>
                    <div>
                      <strong>{entry.itemName}</strong> — ₱{entry.totalPrice}
                    </div>

                    {optionEntries.length > 0 && (
                      <div>
                        {optionEntries.map(([k, v]) => `${k}: ${v}`).join(" • ")}
                      </div>
                    )}

                    {entry.notes && <div>Notes: {entry.notes}</div>}

                    <div>
                      <button
                        type="button"
                        onClick={() => updateQuantity(entry.cartItemId, entry.quantity - 1)}
                      >
                        -
                      </button>
                      <span> {entry.quantity} </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(entry.cartItemId, entry.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(entry.cartItemId)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <label>
              Customer Name (optional):
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
              />
            </label>

            <h3>Subtotal: ₱{subtotal}</h3>

            <button type="submit" disabled={isCheckingOut}>
              {isCheckingOut ? "Sending Order..." : "Place Order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CartDrawer;
