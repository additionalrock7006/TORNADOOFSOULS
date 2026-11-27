import { useState, useEffect, forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";
import "./css/Book.css";
import OrderModal from "./Modal.jsx";
import MenuPage from "./MenuPage.jsx";
import CartDrawer from "./CartDrawer.jsx";
import { useCart } from "./AddToCartSystem.jsx";
import { API_BASE_URL } from "./api.js";

const Page = forwardRef((props, ref) => {
  return (
    <div className={`demoPage ${props.pageClass || ""}`} ref={ref}>
      <div className="page-content">
        {props.title && <h2>{props.title}</h2>}
        {props.children}
      </div>
      {props.number && <span className="page-footer">Page {props.number}</span>}
    </div>
  );
});

Page.displayName = "Page";

function getBookDimensions(viewportWidth, viewportHeight) {
  const isMobile = viewportWidth < 768;
  const horizontalPadding = isMobile ? 24 : 96;
  const verticalPadding = isMobile ? 96 : 80;

  const availableWidth = Math.max(250, viewportWidth - horizontalPadding);
  const availableHeight = Math.max(350, viewportHeight - verticalPadding);

  if (isMobile) {
    const width = Math.min(availableWidth, 400);
    const height = Math.min(Math.round(width * 1.35), availableHeight);
    return { isMobile: true, width, height };
  }

  const spreadPageWidth = Math.floor(availableWidth / 2);
  const width = Math.max(320, Math.min(spreadPageWidth, 500));
  const height = Math.min(Math.round(width * 1.35), availableHeight);
  return { isMobile: false, width, height };
}

function Book() {
  const [products, setProducts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [bookSize, setBookSize] = useState(() =>
    getBookDimensions(
      typeof window !== "undefined" ? window.innerWidth : 1200,
      typeof window !== "undefined" ? window.innerHeight : 800
    )
  );

  const { totalCount } = useCart();

  useEffect(() => {
    const handleResize = () => {
      setBookSize(getBookDimensions(window.innerWidth, window.innerHeight));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/menu`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load menu:", err));
  }, []);

  const byCategory = (category) =>
    products.filter((item) => item.category === category);

  return (
    <div className="book-container">
      <button
        type="button"
        className="cart-toggle-btn"
        onClick={() => setIsCartOpen(true)}
        aria-label="Open shopping cart"
      >
        <img src="/shopping-cart.webp" alt="" width={40} height={40} />
        {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
      </button>

      <HTMLFlipBook
        key={`${bookSize.isMobile ? "m" : "d"}-${bookSize.width}-${bookSize.height}`}
        width={bookSize.width}
        height={bookSize.height}
        size="stretch"
        minWidth={250}
        maxWidth={bookSize.width}
        minHeight={350}
        maxHeight={bookSize.height}
        usePortrait={bookSize.isMobile}
        showCover={true}
        mobileScrollSupport={true}
        className="creativitea-flipbook"
      >
        <Page pageClass="frontpage-cover">
          <h1 className="welcome-message">Welcome to</h1>
          <h2 className="cafe-title">CREATIVITEA</h2>
          <img
            src="/placeholder.png"
            alt="CREATIVITEA logo"
            className="logo-or-mascot"
          />
          <h3 className="cafe-tagline">"Hand-crafted sweets with passion"</h3>
        </Page>

        <Page pageClass="milktea-page">
          <h1 className="products-title">MILKTEAS</h1>
          <MenuPage
            items={byCategory("milktea")}
            onSelectItem={setSelectedItem}
          />
        </Page>

        <Page pageClass="coffee-page">
          <h1 className="products-title">COFFEE</h1>
          <MenuPage
            items={byCategory("coffee")}
            onSelectItem={setSelectedItem}
          />
        </Page>

        <Page pageClass="pastries-page">
          <h1 className="products-title">PASTRIES</h1>
          <MenuPage
            items={byCategory("pastry")}
            onSelectItem={setSelectedItem}
          />
        </Page>

        <Page pageClass="backpage-cover">
          <h2 className="gratitude">Thank you for choosing</h2>
          <h2 className="cafe-name">CREATIVITEA!</h2>
        </Page>
      </HTMLFlipBook>

      <OrderModal
        key={selectedItem?.id ?? "closed"}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}

export default Book;
