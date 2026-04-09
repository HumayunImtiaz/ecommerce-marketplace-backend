import mongoose from "mongoose";
import Product from "./modules/product/models/product.model";
import Category from "./modules/product/models/category.model";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function debugFilter() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  const allProducts = await Product.find({});
  console.log("Total Products in DB:", allProducts.length);

  const categoryName = "sports";
  const foundCat = await Category.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${categoryName}$`, "i") } },
      { slug: { $regex: new RegExp(`^${categoryName}$`, "i") } },
    ],
  });
  
  if (foundCat) {
    console.log("Found Category 'sports':", foundCat._id);
    const filter = { categoryId: foundCat._id };
    console.log("Applying filter:", JSON.stringify(filter));
    const count = await Product.countDocuments(filter);
    const filtered = await Product.find(filter);
    console.log("Count with countDocuments:", count);
    console.log("Length of returned find array:", filtered.length);
    if (filtered.length > 0) {
      console.log("First product in filtered results name:", filtered[0].name);
    }
  } else {
    console.log("Category 'sports' NOT FOUND");
  }

  await mongoose.disconnect();
}

debugFilter();
