import "./css/Card.css";
import "./css/MilkTeas.css";

function ProductCard({ item, onOrder }) {
  return (
    <div className="card">
      <img
        className="product-photo"
        width={200}
        height={200}
        src={item.image}
        alt={item.name}
      />
      <h3 className="product-name">
        {item.name}{" "}
        <span className="product-price">₱{item.basePrice ?? item.price}</span>
      </h3>
      {item.desc && <p className="product-desc">{item.desc}</p>}
      <button
        type="button"
        className="add-button"
        onClick={() => onOrder(item)}
      >
        <span className="button-buy">Buy</span>
      </button>
    </div>
  );
}

export default ProductCard;
