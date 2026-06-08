export const categories = [
  "All",
  "Coffee",
  "Pantry",
  "Cookware",
  "Textiles",
  "Subscriptions",
];

export const products = [
  {
    id: "copper-kettle",
    name: "Mori Copper Kettle",
    category: "Cookware",
    price: 168,
    rating: 4.9,
    stock: 18,
    badge: "Heirloom",
    color: "#b87333",
    description:
      "A hand-finished pour-over kettle with a counterweighted handle and narrow gooseneck spout.",
  },
  {
    id: "stoneware-set",
    name: "Northline Stoneware Set",
    category: "Cookware",
    price: 124,
    rating: 4.8,
    stock: 31,
    badge: "New glaze",
    color: "#61746a",
    description:
      "Four dinner plates, four bowls, and four low cups in a storm-green mineral glaze.",
  },
  {
    id: "market-tote",
    name: "Waxed Market Tote",
    category: "Textiles",
    price: 78,
    rating: 4.7,
    stock: 64,
    badge: "Daily carry",
    color: "#d7b56d",
    description:
      "A structured canvas tote sized for a full farmers market run and a laptop sleeve.",
  },
  {
    id: "espresso-sampler",
    name: "Three-Roast Espresso Sampler",
    category: "Coffee",
    price: 42,
    rating: 4.9,
    stock: 42,
    badge: "Small batch",
    color: "#5a3a2e",
    description:
      "A rotating trio of washed, natural, and honey-process beans roasted for syrupy shots.",
  },
  {
    id: "preserved-citrus",
    name: "Preserved Citrus Pantry Jar",
    category: "Pantry",
    price: 24,
    rating: 4.6,
    stock: 75,
    badge: "Chef pick",
    color: "#e0a72e",
    description:
      "Salt-cured citrus wedges for grain bowls, slow braises, vinaigrettes, and cocktails.",
  },
  {
    id: "linen-runner",
    name: "Washed Linen Table Runner",
    category: "Textiles",
    price: 54,
    rating: 4.8,
    stock: 28,
    badge: "Low impact",
    color: "#a8b1a0",
    description:
      "Stonewashed flax linen with a soft crumple, finished with narrow selvedge edges.",
  },
  {
    id: "breakfast-club",
    name: "Breakfast Club Subscription",
    category: "Subscriptions",
    price: 36,
    rating: 4.7,
    stock: 999,
    badge: "Monthly",
    color: "#db6b42",
    description:
      "Coffee, jam, and a pantry surprise shipped the first Monday of every month.",
  },
  {
    id: "maple-granola",
    name: "Maple Buckwheat Granola",
    category: "Pantry",
    price: 18,
    rating: 4.5,
    stock: 53,
    badge: "Refillable",
    color: "#b8803d",
    description:
      "Toasty buckwheat clusters with maple, pepitas, sesame, and tart dried cherries.",
  },
];

export const orders = [
  {
    id: "ORD-1048",
    date: "May 14",
    status: "Out for delivery",
    total: 232,
    items: ["Mori Copper Kettle", "Preserved Citrus Pantry Jar"],
  },
  {
    id: "ORD-1031",
    date: "April 28",
    status: "Delivered",
    total: 96,
    items: ["Breakfast Club Subscription", "Maple Buckwheat Granola"],
  },
  {
    id: "ORD-0997",
    date: "March 19",
    status: "Delivered",
    total: 178,
    items: ["Northline Stoneware Set", "Washed Linen Table Runner"],
  },
];

export function findProduct(id) {
  return products.find((product) => product.id === id) ?? products[0];
}

export function featuredProducts() {
  return products.filter((product) => product.rating >= 4.8).slice(0, 4);
}

export function productsByCategory(category) {
  if (!category || category === "All") {
    return products;
  }
  return products.filter((product) => product.category === category);
}
