import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function exploreEngagementData() {
  console.log('🔍 Exploring additional engagement metrics...\\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // 1. Check POST data for comments/reactions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 POST ENGAGEMENT DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const postsResponse = await mightyClient.getPosts(1);
    if (postsResponse.items && postsResponse.items.length > 0) {
      const samplePost = postsResponse.items[0];
      console.log('Full post object:');
      console.log(JSON.stringify(samplePost, null, 2));

      // Check for engagement fields
      console.log('\\nLooking for engagement metrics in post:');
      console.log('- comments_count:', samplePost.comments_count || 'NOT FOUND');
      console.log('- likes_count:', samplePost.likes_count || 'NOT FOUND');
      console.log('- reactions_count:', samplePost.reactions_count || 'NOT FOUND');
      console.log('- reactions:', samplePost.reactions ? 'FOUND' : 'NOT FOUND');
      console.log('- comments:', samplePost.comments ? 'FOUND' : 'NOT FOUND');

      // Try to get comments endpoint
      console.log('\\n🔍 Testing comments endpoint...');
      try {
        const commentsResponse = await mightyClient.client.get(
          `/networks/${mightyClient.networkId}/posts/${samplePost.id}/comments`
        );
        console.log('✅ Comments endpoint accessible!');
        console.log('Sample comment data:', JSON.stringify(commentsResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Comments endpoint not accessible:', error.response?.status, error.message);
      }
    }

    // 2. Check EVENT RSVP data
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 EVENT RSVP DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const eventsResponse = await mightyClient.getEvents(1);
    if (eventsResponse.items && eventsResponse.items.length > 0) {
      const sampleEvent = eventsResponse.items[0];
      console.log('Sample event fields:', Object.keys(sampleEvent).join(', '));
      console.log('\\nChecking for RSVP data:');
      console.log('- rsvp_count:', sampleEvent.rsvp_count || 'NOT FOUND');
      console.log('- attendees_count:', sampleEvent.attendees_count || 'NOT FOUND');

      // Try to get RSVPs
      console.log('\\n🔍 Fetching RSVPs for event:', sampleEvent.id);
      try {
        const rsvpsResponse = await mightyClient.getEventRSVPs(sampleEvent.id);
        console.log('✅ RSVPs accessible!');
        console.log(`Found ${rsvpsResponse.items?.length || 0} RSVPs`);
        if (rsvpsResponse.items && rsvpsResponse.items.length > 0) {
          console.log('Sample RSVP object:');
          console.log(JSON.stringify(rsvpsResponse.items[0], null, 2));
        }
      } catch (error) {
        console.log('❌ RSVPs not accessible:', error.response?.status, error.message);
      }
    }

    // 3. Check for QUESTIONS/Q&A
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❓ QUESTIONS/Q&A DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    try {
      const questionsResponse = await mightyClient.client.get(
        `/networks/${mightyClient.networkId}/questions`
      );
      console.log('✅ Questions endpoint accessible!');
      console.log('Sample question data:', JSON.stringify(questionsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Questions endpoint not accessible:', error.response?.status, error.message);
    }

    // 4. Check for COURSES
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 COURSES DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    try {
      const coursesResponse = await mightyClient.client.get(
        `/networks/${mightyClient.networkId}/courses`
      );
      console.log('✅ Courses endpoint accessible!');
      console.log('Sample course data:', JSON.stringify(coursesResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Courses endpoint not accessible:', error.response?.status, error.message);
    }

    // 5. Check for ARTICLES
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📰 ARTICLES DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    try {
      const articlesResponse = await mightyClient.client.get(
        `/networks/${mightyClient.networkId}/articles`
      );
      console.log('✅ Articles endpoint accessible!');
      console.log('Sample article data:', JSON.stringify(articlesResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Articles endpoint not accessible:', error.response?.status, error.message);
    }

    // 6. Check MEMBER activity/contributions
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 MEMBER ACTIVITY DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const membersResponse = await mightyClient.getNetworkMembers(1);
    if (membersResponse.items && membersResponse.items.length > 0) {
      const sampleMember = membersResponse.items[0];
      console.log('Checking member object for activity metrics:');
      console.log('- posts_count:', sampleMember.posts_count || 'NOT FOUND');
      console.log('- comments_count:', sampleMember.comments_count || 'NOT FOUND');
      console.log('- reactions_count:', sampleMember.reactions_count || 'NOT FOUND');
      console.log('- events_count:', sampleMember.events_count || 'NOT FOUND');
      console.log('- contributions:', sampleMember.contributions ? 'FOUND' : 'NOT FOUND');

      // Try member-specific activity endpoint
      console.log('\\n🔍 Testing member activity endpoint...');
      try {
        const activityResponse = await mightyClient.client.get(
          `/networks/${mightyClient.networkId}/members/${sampleMember.id}/activities`
        );
        console.log('✅ Member activities endpoint accessible!');
        console.log('Sample activity data:', JSON.stringify(activityResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Member activities not accessible:', error.response?.status, error.message);
      }
    }

    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ EXPLORATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

  } catch (error) {
    console.error('❌ Exploration failed:', error.message);
    console.error(error.stack);
  }
}

exploreEngagementData();
