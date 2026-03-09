import dotenv from 'dotenv';
import { StripeClient } from './clients/stripeClient.js';

dotenv.config();

async function testStripe() {
  console.log('Testing Stripe integration...\n');

  const stripeClient = new StripeClient(process.env.STRIPE_SECRET_KEY);

  try {
    // Test connection
    console.log('Testing connection...');
    const isConnected = await stripeClient.testConnection();

    if (!isConnected) {
      console.error('Failed to connect to Stripe');
      return;
    }

    console.log('✓ Connected to Stripe successfully\n');

    // Get summary data
    console.log('Fetching Stripe data overview...\n');

    const customers = await stripeClient.getAllCustomers();
    const subscriptions = await stripeClient.getAllSubscriptions();
    const products = await stripeClient.getAllProducts();

    console.log('\n=== STRIPE DATA SUMMARY ===\n');
    console.log(`Total Customers: ${customers.length}`);
    console.log(`Total Subscriptions: ${subscriptions.length}`);
    console.log(`Total Products: ${products.length}`);

    // Subscription breakdown
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const canceledSubscriptions = subscriptions.filter(s => s.status === 'canceled');
    const trialingSubscriptions = subscriptions.filter(s => s.status === 'trialing');

    console.log('\n=== SUBSCRIPTION STATUS BREAKDOWN ===');
    console.log(`Active: ${activeSubscriptions.length}`);
    console.log(`Canceled: ${canceledSubscriptions.length}`);
    console.log(`Trialing: ${trialingSubscriptions.length}`);
    console.log(`Other: ${subscriptions.length - activeSubscriptions.length - canceledSubscriptions.length - trialingSubscriptions.length}`);

    // Show sample customer
    if (customers.length > 0) {
      console.log('\n=== SAMPLE CUSTOMER ===');
      const sample = customers[0];
      console.log(JSON.stringify({
        id: sample.id,
        email: sample.email,
        name: sample.name,
        created: new Date(sample.created * 1000).toISOString(),
        metadata: sample.metadata
      }, null, 2));
    }

    // Show sample subscription
    if (subscriptions.length > 0) {
      console.log('\n=== SAMPLE SUBSCRIPTION ===');
      const sample = subscriptions[0];
      console.log(JSON.stringify({
        id: sample.id,
        customer: sample.customer,
        status: sample.status,
        current_period_start: sample.current_period_start ? new Date(sample.current_period_start * 1000).toISOString() : null,
        current_period_end: sample.current_period_end ? new Date(sample.current_period_end * 1000).toISOString() : null,
        created: sample.created ? new Date(sample.created * 1000).toISOString() : null,
        trial_end: sample.trial_end ? new Date(sample.trial_end * 1000).toISOString() : null,
        items: sample.items.data.map(item => ({
          price_id: item.price.id,
          product: item.price.product,
          amount: item.price.unit_amount,
          currency: item.price.currency,
          interval: item.price.recurring?.interval
        }))
      }, null, 2));
    }

    // Show products
    if (products.length > 0) {
      console.log('\n=== PRODUCTS ===');
      products.forEach(product => {
        console.log(`  - ${product.name} (${product.id})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testStripe();
