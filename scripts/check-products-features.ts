import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecommerce-backend';

async function checkProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db!;
    const products = await db.collection('products').find({}).toArray();

    console.log(`Found ${products.length} products`);
    products.forEach(p => {
      console.log(`Product: ${p.name}, Slug: ${p.slug}`);
      console.log(`Features:`, p.features);
      console.log('---');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProducts();
