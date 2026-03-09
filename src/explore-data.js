import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function exploreData() {
  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get one post to see its structure
    console.log('=== Sample Post Structure ===');
    const postsResponse = await mightyClient.getPosts(1);
    if (postsResponse.items && postsResponse.items.length > 0) {
      console.log(JSON.stringify(postsResponse.items[0], null, 2));
    }

    console.log('\n=== Sample Event Structure ===');
    const eventsResponse = await mightyClient.getEvents(1);
    if (eventsResponse.items && eventsResponse.items.length > 0) {
      console.log(JSON.stringify(eventsResponse.items[0], null, 2));
    }

    console.log('\n=== Sample Member Structure ===');
    const membersResponse = await mightyClient.getNetworkMembers(1);
    if (membersResponse.items && membersResponse.items.length > 0) {
      console.log(JSON.stringify(membersResponse.items[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

exploreData();
