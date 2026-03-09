import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function verifyEngagement() {
  console.log('🔍 Verifying "Business of Fitness" event creator...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get all events
    const events = await mightyClient.getAllEvents();

    // Find the Business of Fitness event
    const businessFitnessEvent = events.find(e =>
      e.title && e.title.toLowerCase().includes('business of fitness')
    );

    if (businessFitnessEvent) {
      console.log('Event found!');
      console.log('Title:', businessFitnessEvent.title);
      console.log('Starts:', businessFitnessEvent.starts_at);
      console.log('Type:', businessFitnessEvent.event_type);
      console.log('RSVP Enabled:', businessFitnessEvent.rsvp_enabled);
      console.log('\nCreator info:');
      console.log('  Name:', businessFitnessEvent.creator?.name);
      console.log('  Email:', businessFitnessEvent.creator?.email);
      console.log('  ID:', businessFitnessEvent.creator?.id);
      console.log('\nPermalink:', businessFitnessEvent.permalink);

      // Also check what Jermaine Carter's email is
      console.log('\n---\n');
      console.log('Expected contact email: jcarterp2@gmail.com');
      console.log('Actual creator email:', businessFitnessEvent.creator?.email);
      console.log('\nMatch:', businessFitnessEvent.creator?.email === 'jcarterp2@gmail.com' ? '✅ YES' : '❌ NO');
    } else {
      console.log('Event not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyEngagement();
