const Product = require("../models/Product");
const { DEFAULT_PRODUCT_SEED } = require("../utils/defaultCatalog");

async function seedCatalogIfEmpty() {
  const productCount = await Product.countDocuments({});
  if (productCount > 0) return;

  const docs = DEFAULT_PRODUCT_SEED.map((product) => {
    const categories = Array.isArray(product.categories) && product.categories.length
      ? product.categories.map((value) => String(value || "").trim()).filter(Boolean)
      : ["general"];

    return {
      ...product,
      category: categories[0],
      categories,
    };
  });

  if (!docs.length) return;

  await Product.insertMany(docs);
  console.log(`Seeded ${docs.length} default products into MongoDB.`);
}

module.exports = { seedCatalogIfEmpty };
