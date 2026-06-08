export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function shippingWindow(product) {
  if (product.stock > 50) {
    return "Ships tomorrow";
  }
  if (product.stock > 20) {
    return "Ships in 2-3 days";
  }
  return "Limited run, ships next week";
}
