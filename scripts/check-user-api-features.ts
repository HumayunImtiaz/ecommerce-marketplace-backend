import axios from 'axios';

const NEXT_SERVER_URL = 'http://localhost:3000'; // User App URL

async function checkUserApi() {
  try {
    console.log('Fetching macbook from user api proxy...');
    const res = await axios.get(`${NEXT_SERVER_URL}/api/products/macbook`);
    
    console.log('Response Success:', res.data.success);
    const product = res.data.data?.product;
    
    if (product) {
      console.log('Product Found:', product.name);
      console.log('Product Features:', product.features);
    } else {
      console.log('Product not found in response');
    }
  } catch (error: any) {
    console.error('Error fetching from user api:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

checkUserApi();
