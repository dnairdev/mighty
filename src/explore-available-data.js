import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function exploreAvailableData() {
  console.log('🔍 Exploring all available Mighty Networks data...\\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get sample member data
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 MEMBER DATA FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const membersResponse = await mightyClient.getNetworkMembers(1);
    if (membersResponse.items && membersResponse.items.length > 0) {
      const sampleMember = membersResponse.items[0];
      console.log('Sample member object fields:');
      console.log(JSON.stringify(sampleMember, null, 2));
      console.log('\\n✓ Member fields available:', Object.keys(sampleMember).join(', '));
    }

    // Get sample post data
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 POST DATA FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const postsResponse = await mightyClient.getPosts(1);
    if (postsResponse.items && postsResponse.items.length > 0) {
      const samplePost = postsResponse.items[0];
      console.log('Sample post object fields:');
      console.log(JSON.stringify(samplePost, null, 2));
      console.log('\\n✓ Post fields available:', Object.keys(samplePost).join(', '));
    }

    // Get sample event data
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 EVENT DATA FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const eventsResponse = await mightyClient.getEvents(1);
    if (eventsResponse.items && eventsResponse.items.length > 0) {
      const sampleEvent = eventsResponse.items[0];
      console.log('Sample event object fields:');
      console.log(JSON.stringify(sampleEvent, null, 2));
      console.log('\\n✓ Event fields available:', Object.keys(sampleEvent).join(', '));

      // Check if we can get RSVPs
      console.log('\\n📊 Checking event RSVPs...');
      try {
        const rsvps = await mightyClient.getEventRSVPs(sampleEvent.id);
        console.log('✓ RSVP data available!');
        if (rsvps.items && rsvps.items.length > 0) {
          console.log('Sample RSVP:', JSON.stringify(rsvps.items[0], null, 2));
        }
      } catch (error) {
        console.log('✗ RSVPs not accessible or no RSVPs:', error.message);
      }
    }

    // Get space data
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗺️  SPACE DATA FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const spacesResponse = await mightyClient.getSpaces();
    if (spacesResponse.items && spacesResponse.items.length > 0) {
      const sampleSpace = spacesResponse.items[0];
      console.log('Sample space object fields:');
      console.log(JSON.stringify(sampleSpace, null, 2));
      console.log('\\n✓ Space fields available:', Object.keys(sampleSpace).join(', '));
    }

    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ EXPLORATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

  } catch (error) {
    console.error('❌ Exploration failed:', error.message);
    console.error(error.stack);
  }
}

exploreAvailableData();
