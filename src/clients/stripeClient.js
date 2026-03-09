import Stripe from 'stripe';

export class StripeClient {
  constructor(apiKey) {
    this.stripe = new Stripe(apiKey);
  }

  // Get all customers with pagination
  async getAllCustomers() {
    try {
      console.log('Fetching all Stripe customers...');
      const allCustomers = [];
      let hasMore = true;
      let startingAfter = null;

      while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const customers = await this.stripe.customers.list(params);
        allCustomers.push(...customers.data);

        hasMore = customers.has_more;
        if (hasMore && customers.data.length > 0) {
          startingAfter = customers.data[customers.data.length - 1].id;
        }

        console.log(`Fetched ${allCustomers.length} customers so far...`);
      }

      console.log(`Total customers: ${allCustomers.length}`);
      return allCustomers;
    } catch (error) {
      console.error('Error fetching customers:', error.message);
      throw error;
    }
  }

  // Get all subscriptions with pagination
  async getAllSubscriptions() {
    try {
      console.log('Fetching all Stripe subscriptions...');
      const allSubscriptions = [];
      let hasMore = true;
      let startingAfter = null;

      while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const subscriptions = await this.stripe.subscriptions.list(params);
        allSubscriptions.push(...subscriptions.data);

        hasMore = subscriptions.has_more;
        if (hasMore && subscriptions.data.length > 0) {
          startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
        }

        console.log(`Fetched ${allSubscriptions.length} subscriptions so far...`);
      }

      console.log(`Total subscriptions: ${allSubscriptions.length}`);
      return allSubscriptions;
    } catch (error) {
      console.error('Error fetching subscriptions:', error.message);
      throw error;
    }
  }

  // Get customer by ID
  async getCustomer(customerId) {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error(`Error fetching customer ${customerId}:`, error.message);
      throw error;
    }
  }

  // Get subscription by ID
  async getSubscription(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error(`Error fetching subscription ${subscriptionId}:`, error.message);
      throw error;
    }
  }

  // Search customers by email
  async searchCustomersByEmail(email) {
    try {
      const customers = await this.stripe.customers.search({
        query: `email:'${email}'`,
      });
      return customers.data;
    } catch (error) {
      console.error(`Error searching for customer ${email}:`, error.message);
      throw error;
    }
  }

  // Get all charges (payments)
  async getAllCharges() {
    try {
      console.log('Fetching all Stripe charges...');
      const allCharges = [];
      let hasMore = true;
      let startingAfter = null;

      while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const charges = await this.stripe.charges.list(params);
        allCharges.push(...charges.data);

        hasMore = charges.has_more;
        if (hasMore && charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }

        console.log(`Fetched ${allCharges.length} charges so far...`);
      }

      console.log(`Total charges: ${allCharges.length}`);
      return allCharges;
    } catch (error) {
      console.error('Error fetching charges:', error.message);
      throw error;
    }
  }

  // Get all products
  async getAllProducts() {
    try {
      console.log('Fetching all Stripe products...');
      const allProducts = [];
      let hasMore = true;
      let startingAfter = null;

      while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const products = await this.stripe.products.list(params);
        allProducts.push(...products.data);

        hasMore = products.has_more;
        if (hasMore && products.data.length > 0) {
          startingAfter = products.data[products.data.length - 1].id;
        }

        console.log(`Fetched ${allProducts.length} products so far...`);
      }

      console.log(`Total products: ${allProducts.length}`);
      return allProducts;
    } catch (error) {
      console.error('Error fetching products:', error.message);
      throw error;
    }
  }

  // Get all prices
  async getAllPrices() {
    try {
      console.log('Fetching all Stripe prices...');
      const allPrices = [];
      let hasMore = true;
      let startingAfter = null;

      while (hasMore) {
        const params = { limit: 100 };
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const prices = await this.stripe.prices.list(params);
        allPrices.push(...prices.data);

        hasMore = prices.has_more;
        if (hasMore && prices.data.length > 0) {
          startingAfter = prices.data[prices.data.length - 1].id;
        }

        console.log(`Fetched ${allPrices.length} prices so far...`);
      }

      console.log(`Total prices: ${allPrices.length}`);
      return allPrices;
    } catch (error) {
      console.error('Error fetching prices:', error.message);
      throw error;
    }
  }

  // Test connection
  async testConnection() {
    try {
      await this.stripe.customers.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Stripe connection test failed:', error.message);
      return false;
    }
  }
}
