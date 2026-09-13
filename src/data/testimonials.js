/**
 * Client reviews used by the testimonial wall.
 *
 * All three verticals Helm sells into are represented: weddings, corporate
 * summits and political rallies. Names and organisations are illustrative
 * demo content, not real registered clients.
 *
 * Schema: clientName, company, eventType, venue, city, date (ISO), rating 1-5,
 * guestCount, budgetBracket, review, imageUrl, verified.
 */

export const TESTIMONIALS = [
  /* ------------------------------------------------------------- weddings */
  {
    id: 't1', clientName: 'Aditi & Rahul Deshmukh', company: '', eventType: 'wedding',
    venue: 'Taj Falaknuma Palace', city: 'Hyderabad', date: '2025-12-15',
    rating: 5, guestCount: 500, budgetBracket: '₹50L+',
    review: 'We signed off the mandap and the throne seating straight from the 360 preview — no site visit. On the day it matched the screen almost exactly, right down to the marigold wall behind the pheras.',
    imageUrl: '/images/india_function_360.jpg', verified: true
  },
  {
    id: 't2', clientName: 'Sneha & Karthik Iyer', company: '', eventType: 'wedding',
    venue: 'Leela Palace Lawns', city: 'Bengaluru', date: '2025-09-05',
    rating: 5, guestCount: 300, budgetBracket: '₹25L–₹50L',
    review: 'The gold chiavari chairs and the shimmer backdrop in the banquet hall were exactly the look we had argued about for weeks. Seeing both options side by side ended the argument in ten minutes.',
    imageUrl: '/images/zone_banquet_360.jpg', verified: true
  },
  {
    id: 't3', clientName: 'Priya & Rajat Malhotra', company: '', eventType: 'wedding',
    venue: 'Umaid Bhawan Gardens', city: 'Jodhpur', date: '2025-08-18',
    rating: 5, guestCount: 450, budgetBracket: '₹25L–₹50L',
    review: 'The entrance arch and red carpet set the tone for the whole evening. My only note is that the fairy canopy needed one more run of lights than the preview suggested — the team added it on site without a fuss.',
    imageUrl: '/images/zone_entrance_360.jpg', verified: true
  },
  {
    id: 't4', clientName: 'Meghana & Arun Reddy', company: '', eventType: 'wedding',
    venue: 'Novotel Convention Lawns', city: 'Visakhapatnam', date: '2026-01-28',
    rating: 4, guestCount: 650, budgetBracket: '₹50L+',
    review: 'Planning three functions across two days from one tool saved our families a lot of arguing. Costs tracked accurately through to the final invoice; the only surprise was a monsoon tenting line we added late.',
    imageUrl: '/images/india_function_360.jpg', verified: true
  },
  {
    id: 't5', clientName: 'Fatima & Zaid Ansari', company: '', eventType: 'wedding',
    venue: 'ITC Grand Central Ballroom', city: 'Mumbai', date: '2025-11-08',
    rating: 4, guestCount: 220, budgetBracket: '₹10L–₹25L',
    review: 'Good tool, honest pricing. We wanted a smaller nikah setup and were not upsold. The walkthrough video we could share with relatives abroad was the part everyone talked about.',
    imageUrl: '/images/zone_lounge_360.jpg', verified: true
  },

  /* ---------------------------------------------------- corporate summits */
  {
    id: 't6', clientName: 'Vandana Krishnan', company: 'Aurora Systems India', eventType: 'corporate',
    venue: 'HICC Novotel Hall 2', city: 'Hyderabad', date: '2025-10-10',
    rating: 5, guestCount: 800, budgetBracket: '₹25L–₹50L',
    review: 'Our APAC leadership summit ran across two halls. Being able to show the board the seamless LED backdrop and the exact podium position before signing the PO removed a whole approval cycle.',
    imageUrl: '/images/india_meeting_360.jpg', verified: true
  },
  {
    id: 't7', clientName: 'Deepak Raghavan', company: 'Meridian Capital Advisors', eventType: 'corporate',
    venue: 'Trident BKC Grand Ballroom', city: 'Mumbai', date: '2026-02-06',
    rating: 5, guestCount: 350, budgetBracket: '₹25L–₹50L',
    review: 'Investor day. The VVIP executive seating layout and sightlines were planned in the tool and matched on site. Our comms team reused the 360 stills in the post-event deck.',
    imageUrl: '/images/india_meeting_360.jpg', verified: true
  },
  {
    id: 't8', clientName: 'Shalini Mathew', company: 'Kerala Tech Forum', eventType: 'corporate',
    venue: 'Grand Hyatt Bolgatty', city: 'Kochi', date: '2025-07-22',
    rating: 4, guestCount: 500, budgetBracket: '₹10L–₹25L',
    review: 'Solid for stage and AV planning. Vendor coordination still happened over WhatsApp on our side, but the shared visual reference cut the back-and-forth roughly in half.',
    imageUrl: '/images/zone_stage_360.jpg', verified: true
  },
  {
    id: 't9', clientName: 'Rohit Bhargava', company: 'Northline Logistics', eventType: 'corporate',
    venue: 'Le Méridien Convention Centre', city: 'New Delhi', date: '2025-12-02',
    rating: 4, guestCount: 400, budgetBracket: '₹10L–₹25L',
    review: 'Annual awards night. The award-reveal lighting and the run-sheet export were genuinely useful for briefing the DJ and the anchor. Would like a printable seating chart next.',
    imageUrl: '/images/reception_crystal_gala_360.jpg', verified: false
  },

  /* --------------------------------------------------- political rallies */
  {
    id: 't10', clientName: 'K. Srinivas Rao', company: 'Rao Campaign Committee', eventType: 'rally',
    venue: 'Parade Ground', city: 'Warangal', date: '2026-02-20',
    rating: 5, guestCount: 18000, budgetBracket: '₹50L+',
    review: 'Crowd of eighteen thousand. We planned the barricade lines, high-mast lighting and the horn speaker array in the tool and walked the security team through it the night before. No bottlenecks at either gate.',
    imageUrl: '/images/india_election_360.jpg', verified: true
  },
  {
    id: 't11', clientName: 'Sunita Barve', company: 'Vidarbha Regional Front', eventType: 'rally',
    venue: 'Kasturchand Park', city: 'Nagpur', date: '2025-11-30',
    rating: 4, guestCount: 9000, budgetBracket: '₹25L–₹50L',
    review: 'The bulletproof podium and flag backdrop were spec-ed correctly the first time. Generator backup was under-budgeted in our original plan and the tool flagged it — that saved the broadcast feed.',
    imageUrl: '/images/political_presidential_rally_360.jpg', verified: true
  },
  {
    id: 't12', clientName: 'Anwar Sheikh', company: 'Marathwada Kisan Manch', eventType: 'rally',
    venue: 'District Grounds', city: 'Aurangabad', date: '2026-01-11',
    rating: 5, guestCount: 25000, budgetBracket: '₹50L+',
    review: 'Largest gathering we have run. Seeing the stage height against the crowd depth before build-out changed our riser spec. Media risers and the press pen were placed off the same plan.',
    imageUrl: '/images/india_election_360.jpg', verified: true
  },
  {
    id: 't13', clientName: 'G. Murugan', company: 'Coimbatore District Unit', eventType: 'rally',
    venue: 'Codissia Grounds', city: 'Coimbatore', date: '2025-10-27',
    rating: 4, guestCount: 12000, budgetBracket: '₹25L–₹50L',
    review: 'Fast to put a plan in front of the district team. The costing was close to final — about eight per cent under, mostly labour. Useful, not magic.',
    imageUrl: '/images/political_presidential_rally_360.jpg', verified: false
  },

  /* ------------------------------------------------------ galas / social */
  {
    id: 't14', clientName: 'Ritu Sanghvi', company: 'Sanghvi Foundation', eventType: 'gala',
    venue: 'Fountain Plaza, The Westin', city: 'Pune', date: '2025-11-22',
    rating: 5, guestCount: 150, budgetBracket: '₹10L–₹25L',
    review: 'Fundraiser cocktail hour around the fountain. Elegant, and the donor wall lighting was exactly as previewed. We raised more than the previous year in the same venue.',
    imageUrl: '/images/zone_fountain_360.jpg', verified: true
  }
];

/** Distinct event types present in the data — use this to build filters. */
export const TESTIMONIAL_EVENT_TYPES = [...new Set(TESTIMONIALS.map(t => t.eventType))];
