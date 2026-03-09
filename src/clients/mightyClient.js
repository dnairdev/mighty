import axios from 'axios';

export class MightyNetworksClient {
  constructor(apiKey, networkId) {
    this.apiKey = apiKey;
    this.networkId = networkId;
    this.baseUrl = 'https://api.mn.co/admin/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getSpaces() {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/spaces`);
      return response.data;
    } catch (error) {
      console.error('Error fetching spaces:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSpaceMembers(spaceId) {
    try {
      const response = await this.client.get(
        `/networks/${this.networkId}/spaces/${spaceId}/members`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching space members:', error.response?.data || error.message);
      throw error;
    }
  }

  async getNetworkMembers(page = 1) {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/members?page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching network members:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllMembers() {
    try {
      // Try to get members directly from the network level
      console.log('Fetching members from network...');
      const allMembers = [];
      let page = 1;
      let hasMore = true;

      // Paginate through all members
      while (hasMore) {
        const networkMembers = await this.getNetworkMembers(page);

        if (networkMembers.items && networkMembers.items.length > 0) {
          allMembers.push(...networkMembers.items);
          console.log(`Fetched page ${page}: ${networkMembers.items.length} members`);

          // Check if there's a next page
          hasMore = networkMembers.links && networkMembers.links.next;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (allMembers.length > 0) {
        console.log(`Found ${allMembers.length} total members at network level`);
        return allMembers;
      }

      // Fallback: If no network-level members, try getting from spaces
      console.log('No network-level members found, checking spaces...');
      const spaces = await this.getSpaces();

      if (!spaces.items || spaces.items.length === 0) {
        console.log('No spaces found in the network');
        return [];
      }

      // Get members from each space
      const spaceMemberMap = new Map();

      for (const space of spaces.items) {
        const members = await this.getSpaceMembers(space.id);

        // Use Map to deduplicate members by ID
        for (const member of members.items || []) {
          if (!spaceMemberMap.has(member.user_id)) {
            spaceMemberMap.set(member.user_id, {
              ...member,
              spaces: [{ id: space.id, name: space.name }]
            });
          } else {
            // Add space to existing member
            const existingMember = spaceMemberMap.get(member.user_id);
            existingMember.spaces.push({ id: space.id, name: space.name });
          }
        }
      }

      return Array.from(spaceMemberMap.values());
    } catch (error) {
      console.error('Error fetching all members:', error.message);
      throw error;
    }
  }

  async getMemberActivities(userId, spaceId) {
    try {
      // Note: This endpoint may vary based on actual API documentation
      // Adjust once we verify the correct endpoint for activities
      const response = await this.client.get(
        `/networks/${this.networkId}/spaces/${spaceId}/members/${userId}/activities`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching member activities:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPosts(page = 1) {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/posts?page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching posts:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllPosts() {
    try {
      console.log('Fetching posts from network...');
      const allPosts = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const posts = await this.getPosts(page);

        if (posts.items && posts.items.length > 0) {
          allPosts.push(...posts.items);
          console.log(`Fetched page ${page}: ${posts.items.length} posts`);

          hasMore = posts.links && posts.links.next;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`Found ${allPosts.length} total posts`);
      return allPosts;
    } catch (error) {
      console.error('Error fetching all posts:', error.message);
      throw error;
    }
  }

  async getEvents(page = 1) {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/events?page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllEvents() {
    try {
      console.log('Fetching events from network...');
      const allEvents = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const events = await this.getEvents(page);

        if (events.items && events.items.length > 0) {
          allEvents.push(...events.items);
          console.log(`Fetched page ${page}: ${events.items.length} events`);

          hasMore = events.links && events.links.next;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`Found ${allEvents.length} total events`);
      return allEvents;
    } catch (error) {
      console.error('Error fetching all events:', error.message);
      throw error;
    }
  }

  async getEventRSVPs(eventId, page = 1) {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/events/${eventId}/rsvps?page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching RSVPs:', error.response?.data || error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.getSpaces();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getSubscriptions(page = 1) {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/subscriptions?page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscriptions:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllSubscriptions() {
    try {
      console.log('Fetching subscriptions from network...');
      const allSubscriptions = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const subscriptions = await this.getSubscriptions(page);

        if (subscriptions.items && subscriptions.items.length > 0) {
          allSubscriptions.push(...subscriptions.items);
          console.log(`Fetched page ${page}: ${subscriptions.items.length} subscriptions`);

          hasMore = subscriptions.links && subscriptions.links.next;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`Found ${allSubscriptions.length} total subscriptions`);
      return allSubscriptions;
    } catch (error) {
      console.error('Error fetching all subscriptions:', error.message);
      throw error;
    }
  }

  async getPlans() {
    try {
      const response = await this.client.get(`/networks/${this.networkId}/plans`);
      return response.data;
    } catch (error) {
      console.error('Error fetching plans:', error.response?.data || error.message);
      throw error;
    }
  }

  // Returns all unique plan names from the subscriptions endpoint
  async getAllPlanNames() {
    const subscriptions = await this.getAllSubscriptions();
    const planMap = new Map();

    for (const member of subscriptions) {
      const plan = member.plan;
      if (!plan) continue;
      const key = plan.name || 'Unknown';
      if (!planMap.has(key)) {
        planMap.set(key, {
          name: plan.name || 'Unknown',
          type: plan.type || 'unknown',
          amount: plan.amount || 0,
          interval: plan.interval || null,
          currency: plan.currency || 'usd',
          price: plan.amount > 0
            ? `$${(plan.amount / 100).toFixed(0)}/${plan.interval}`
            : 'Free'
        });
      }
    }

    return Array.from(planMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}
