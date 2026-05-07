// Demo Component 1: ProductCard — Easy (first demo)
// Known issues: missing React.memo, missing alt text, prop drilling, dangerouslySetInnerHTML

import React, { useState } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  tags: Array<{ id: string; label: string; active: boolean }>;
}

function ProductCard({
  product,
  onAddToCart,
  onWishlist,
  onShare,
}: {
  product: Product;
  onAddToCart: (product: Product) => void;
  onWishlist: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [wishlistActive, setWishlistActive] = useState(false);

  // Missing useMemo — this runs on every render
  const activeTags = product.tags.filter((t) => t.active);
  const discountedPrice = product.price * 0.9;

  const handleWishlist = () => {
    setWishlistActive(!wishlistActive);
    onWishlist(product.id);
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px' }}>
      {/* Missing alt text */}
      <img src={product.image} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />

      <h2>{product.name}</h2>

      {/* XSS risk — unsanitized HTML from product description */}
      <p dangerouslySetInnerHTML={{ __html: product.description }} />

      <div>
        {activeTags.map((tag) => (
          <span key={tag.id} style={{ background: '#eee', padding: '2px 8px', marginRight: '4px' }}>
            {tag.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
        <span>{quantity}</span>
        <button onClick={() => setQuantity(quantity + 1)}>+</button>
      </div>

      <p>
        <s>${product.price}</s> ${discountedPrice.toFixed(2)}
      </p>

      {/* Missing useCallback — new function reference on every render */}
      <button onClick={() => onAddToCart(product)}>Add to Cart</button>

      <button onClick={handleWishlist}>{wishlistActive ? '♥ Saved' : '♡ Wishlist'}</button>

      {/* Prop drilling — onShare passed through but could use context */}
      <ShareButton productId={product.id} onShare={onShare} />
    </div>
  );
}

// Separate component receiving prop-drilled handler
function ShareButton({
  productId,
  onShare,
}: {
  productId: string;
  onShare: (id: string) => void;
}) {
  return <button onClick={() => onShare(productId)}>Share</button>;
}

export default ProductCard;
