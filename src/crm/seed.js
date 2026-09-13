/**
 * seed.js — believable demo data for the CRM.
 *
 * Deliberately not "12 rows of Client A / Client B". This book is meant to be
 * read: it carries the three segments a Hyderabad production house actually
 * runs side by side, and it carries the shapes that break naive software —
 *
 *   · a MULTI-DAY wedding with five functions on one deal (Sharma–Mehta),
 *   · an INTER-state destination wedding in Udaipur billed IGST while the
 *     client's home state is Telangana (place of supply is the VENUE),
 *   · a corporate client in Bengaluru whose event is at HICC Hyderabad, so the
 *     supply is INTRA-state despite the client being out of state,
 *   · a corporate deal SETTLED IN FULL by a short bank credit because the
 *     client withheld TDS — the case that makes naive CRMs show a permanent
 *     phantom balance,
 *   · a genuinely overdue post-event corporate receivable sitting in the 90+
 *     ageing bucket, which is what the working-capital gap looks like in a row,
 *   · a CANCELLED booking, which is not a lost deal: the advance is already in.
 *
 * All amounts are integer rupees, ex-GST unless the field says otherwise.
 * All dates are local `YYYY-MM-DD`, generated relative to today so the demo
 * never rots into a screen full of 2024.
 */

import { todayISO, addDaysISO } from '../data/eventState.js';
import {
  makeClient, makeDeal, makeMilestone, makeReceipt, makeInvoice,
  phaseForStage, probabilityForStage, templateById, defaultTemplateFor
} from './schema.js';
import { buildMilestones, gstForPlaceOfSupply, computeTds } from './finance.js';

const T = () => todayISO();
const d = (offset) => addDaysISO(T(), offset);

/** Compact function rows for a multi-day Indian wedding. */
function functions(startOffset, list) {
  return list.map((f, i) => ({
    id: `fn_${startOffset}_${i}`,
    label: f.label,
    type: f.type,
    date: d(startOffset + (f.day || 0)),
    startTime: f.start || '18:00',
    endTime: f.end || '23:30',
    venue: f.venue || '',
    guestCount: f.guests || 0,
    // The costing unit is the FUNCTION, not the event.
    quotedValue: f.value || 0
  }));
}

const SPECS = [
  // ---------------------------------------------------------- weddings
  {
    client: {
      code: 'CL-0001', type: 'individual', name: 'Sharma Family',
      primaryContact: { name: 'Rakesh Sharma', role: 'Father of the bride', phone: '+91 98490 21144', whatsapp: '+91 98490 21144', email: 'rakesh.sharma@gmail.com' },
      altContacts: [{ name: 'Ananya Sharma', role: 'Bride', phone: '+91 99590 33210', email: 'ananya.s@gmail.com' }],
      billing: {
        legalName: 'Rakesh Sharma', pan: 'AKQPS1234M', isRegistered: false,
        tdsApplicable: false, tdsSection: null,
        address: { line1: 'Plot 44, Road 12', line2: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500034' },
        placeOfSupply: '36'
      },
      source: 'referral', sourceDetail: 'Referred by the Agarwal wedding (CL-0014)', tags: ['premium', 'multi-day']
    },
    deal: {
      code: 'EV-2026-0001', title: 'Sharma–Mehta Wedding', category: 'wedding', subType: 'wedding',
      stage: 'in_production', quotedValue: 8600000, discount: 250000, estimatedCost: 6100000,
      guestCount: 900, guestCountConfirmed: true, billingModel: 'percentage_of_budget',
      venue: { name: 'Taj Falaknuma Palace', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'hotel', contact: 'Banquets desk · +91 40 6629 8585' },
      eventDates: [{ date: d(18) }, { date: d(19) }, { date: d(20) }, { date: d(21) }, { date: d(23) }],
      functions: functions(18, [
        { label: 'Mehendi', type: 'mehendi', day: 0, start: '11:00', end: '17:00', guests: 250, value: 900000 },
        { label: 'Haldi', type: 'haldi', day: 1, start: '09:00', end: '13:00', guests: 180, value: 550000 },
        { label: 'Sangeet', type: 'sangeet', day: 2, guests: 600, value: 2400000 },
        { label: 'Wedding', type: 'wedding', day: 3, start: '19:30', end: '02:00', guests: 900, value: 3200000 },
        { label: 'Reception', type: 'reception', day: 5, guests: 850, value: 1550000 }
      ]),
      bookedAt: d(-120), createdAt: d(-155)
    },
    template: 'wedding_40_30_30',
    // Advance in, T-30 milestone in. Pre-event balance still open — and the
    // event is 18 days out, so this is the row that must be chased NOW.
    receipts: [
      { seq: 1, mode: 'rtgs', on: d(-120), ref: 'UTR 4471209981', full: true },
      { seq: 2, mode: 'neft', on: d(-26), ref: 'UTR 4482113340', full: true }
    ]
  },
  {
    client: {
      code: 'CL-0002', type: 'individual', name: 'Kapoor–Malhotra Family',
      primaryContact: { name: 'Vikram Kapoor', role: 'Groom’s father', phone: '+91 98110 76620', whatsapp: '+91 98110 76620', email: 'vikram@kapoorgroup.in' },
      billing: {
        legalName: 'Vikram Kapoor', pan: 'AFZPK8891L', isRegistered: false, tdsApplicable: false,
        address: { line1: 'Villa 9, Jubilee Enclave', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500081' },
        placeOfSupply: '08'   // destination wedding — VENUE state wins, not this address
      },
      source: 'venue_partner', sourceDetail: 'Introduced by The Leela Palace Udaipur', tags: ['destination']
    },
    deal: {
      code: 'EV-2026-0002', title: 'Kapoor–Malhotra Destination Wedding', category: 'wedding', subType: 'wedding',
      stage: 'planning', quotedValue: 14500000, discount: 0, estimatedCost: 10200000,
      guestCount: 420, isDestination: true, billingModel: 'fixed_package',
      // Venue in Rajasthan → INTER-state supply → IGST 18%, not CGST+SGST.
      venue: { name: 'The Leela Palace Udaipur', city: 'Udaipur', state: 'Rajasthan', stateCode: '08', type: 'hotel' },
      eventDates: [{ date: d(96) }, { date: d(97) }, { date: d(98) }],
      functions: functions(96, [
        { label: 'Welcome Sangeet', type: 'sangeet', day: 0, guests: 380, value: 4200000 },
        { label: 'Pheras', type: 'wedding', day: 1, start: '20:00', end: '01:00', guests: 420, value: 6300000 },
        { label: 'Reception', type: 'reception', day: 2, guests: 400, value: 4000000 }
      ]),
      bookedAt: d(-34), createdAt: d(-61)
    },
    template: 'wedding_50_25_25',
    receipts: [{ seq: 1, mode: 'rtgs', on: d(-34), ref: 'UTR 5510083321', full: true }]
  },
  {
    client: {
      code: 'CL-0003', type: 'individual', name: 'Reddy–Iyer Family',
      primaryContact: { name: 'Sujatha Reddy', role: 'Mother of the groom', phone: '+91 90003 11889', whatsapp: '+91 90003 11889', email: 'sujatha.reddy@outlook.com' },
      billing: {
        legalName: 'Sujatha Reddy', isRegistered: false, tdsApplicable: false,
        address: { line1: 'Flat 1204, My Home Bhooja', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500032' },
        placeOfSupply: '36'
      },
      source: 'instagram', sourceDetail: 'DM after the Sharma sangeet reel', tags: []
    },
    deal: {
      code: 'EV-2026-0003', title: 'Reddy–Iyer Wedding', category: 'wedding', subType: 'wedding',
      stage: 'negotiation', quotedValue: 5200000, discount: 200000, estimatedCost: 3900000,
      budgetIndicated: 4500000, guestCount: 550,
      venue: { name: 'N Convention', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'convention' },
      eventDates: [{ date: d(132) }, { date: d(133) }],
      functions: functions(132, [
        { label: 'Sangeet', type: 'sangeet', day: 0, guests: 400, value: 2000000 },
        { label: 'Wedding', type: 'wedding', day: 1, start: '05:30', end: '11:00', guests: 550, value: 3200000 }
      ]),
      createdAt: d(-22)
    },
    template: 'wedding_40_30_30', schedule: false
  },
  {
    client: {
      code: 'CL-0004', type: 'individual', name: 'Agarwal Family',
      primaryContact: { name: 'Naresh Agarwal', role: 'Host', phone: '+91 98661 20045', email: 'naresh@agarwaltextiles.in' },
      billing: {
        legalName: 'Naresh Agarwal', pan: 'ADQPA5521K', isRegistered: false, tdsApplicable: false,
        address: { line1: '8-2-293, Road 2', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500033' },
        placeOfSupply: '36'
      },
      source: 'repeat', sourceDetail: 'Third event with Helm since 2024', tags: ['repeat', 'referrer']
    },
    deal: {
      code: 'EV-2026-0004', title: 'Agarwal Silver Jubilee Reception', category: 'wedding', subType: 'reception',
      stage: 'settled', quotedValue: 2400000, discount: 0, estimatedCost: 1650000, guestCount: 380,
      venue: { name: 'Park Hyatt Hyderabad', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'hotel' },
      eventDates: [{ date: d(-47) }],
      functions: functions(-47, [{ label: 'Reception', type: 'reception', day: 0, guests: 380, value: 2400000 }]),
      bookedAt: d(-110), createdAt: d(-128)
    },
    template: 'wedding_40_30_30',
    receipts: [
      { seq: 1, mode: 'neft', on: d(-110), ref: 'UTR 3320114455', full: true },
      { seq: 2, mode: 'upi', on: d(-70), ref: 'UPI 662140099231', full: true },
      { seq: 3, mode: 'cheque', on: d(-49), ref: 'Cheque 004412 · HDFC', full: true }
    ]
  },

  // --------------------------------------------------------- corporate
  {
    client: {
      code: 'CL-0005', type: 'corporate', name: 'Infosys Limited',
      primaryContact: { name: 'Meghana Rao', role: 'Manager — Corporate Events', phone: '+91 80416 22100', email: 'meghana.rao@infosys.com' },
      altContacts: [{ name: 'Accounts Payable', role: 'Finance', email: 'ap.india@infosys.com' }],
      billing: {
        legalName: 'Infosys Limited', gstin: '29AAACI4741P1ZL', pan: 'AAACI4741P',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: 'Electronics City, Hosur Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560100' },
        // Registered in Karnataka, but the summit is at HICC Hyderabad, so the
        // place of supply is Telangana and the invoice is CGST+SGST.
        placeOfSupply: '36'
      },
      source: 'referral', sourceDetail: 'Procurement referral from the GMR pitch', tags: ['enterprise', 'tds']
    },
    deal: {
      code: 'EV-2026-0005', title: 'Infosys Leadership Summit 2026', category: 'corporate', subType: 'keynote',
      stage: 'delivered', quotedValue: 1000000, discount: 0, estimatedCost: 690000, guestCount: 320,
      poNumber: 'PO-IN-2026-44118', billingModel: 'fixed_package',
      venue: { name: 'HICC Novotel', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'convention' },
      eventDates: [{ date: d(-21) }],
      functions: functions(-21, [{ label: 'Leadership Summit', type: 'keynote', day: 0, start: '09:00', end: '18:00', guests: 320, value: 1000000 }]),
      bookedAt: d(-75), createdAt: d(-96)
    },
    template: 'corporate_50_50_net30',
    // THE WORKED EXAMPLE. ₹10,00,000 ex-GST → ₹11,80,000 gross. Infosys
    // withholds ₹20,000 under 194C @2% of the EX-GST base and transfers
    // ₹11,60,000. The deal is SETTLED IN FULL, not ₹20,000 short.
    receipts: [
      { seq: 1, mode: 'neft', on: d(-74), ref: 'UTR 7781200034', full: true, tdsSection: '194C' },
      { seq: 2, mode: 'neft', on: d(-4), ref: 'UTR 7790451122', full: true, tdsSection: '194C' }
    ],
    invoices: [{ milestoneSeq: 1, type: 'tax_invoice', issue: d(-75) }, { milestoneSeq: 2, type: 'tax_invoice', issue: d(-20) }]
  },
  {
    client: {
      code: 'CL-0006', type: 'corporate', name: 'HDFC Bank Limited',
      primaryContact: { name: 'Sandeep Nair', role: 'AVP — Brand & Events', phone: '+91 22 6652 1000', email: 'sandeep.nair@hdfcbank.com' },
      billing: {
        legalName: 'HDFC Bank Limited', gstin: '27AAACH2702H1ZK', pan: 'AAACH2702H',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: 'HDFC Bank House, Senapati Bapat Marg', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', pincode: '400013' },
        placeOfSupply: '36'
      },
      source: 'cold', sourceDetail: 'Agency empanelment 2025', tags: ['enterprise', 'ageing']
    },
    deal: {
      code: 'EV-2026-0006', title: 'HDFC South Zone Annual Awards', category: 'corporate', subType: 'gala_dinner',
      stage: 'delivered', quotedValue: 3200000, discount: 0, estimatedCost: 2250000, guestCount: 600,
      poNumber: 'PO-HDFC-25-99120',
      venue: { name: 'Trident Hyderabad', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'hotel' },
      eventDates: [{ date: d(-164) }],
      functions: functions(-164, [{ label: 'Awards night', type: 'gala_dinner', day: 0, guests: 600, value: 3200000 }]),
      bookedAt: d(-230), createdAt: d(-260)
    },
    template: 'corporate_30_70_net60',
    // Advance only. The 70% balance fell due 60 days after the event — over
    // three months ago. This is the 90+ ageing bucket in a single row, and it
    // is exactly the working-capital gap the research describes: vendors were
    // paid out before the event, the client pays after it, or doesn't.
    receipts: [{ seq: 1, mode: 'rtgs', on: d(-228), ref: 'UTR 9912004471', full: true, tdsSection: '194C' }],
    invoices: [
      { milestoneSeq: 1, type: 'tax_invoice', issue: d(-230) },
      { milestoneSeq: 2, type: 'tax_invoice', issue: d(-160) }
    ]
  },
  {
    client: {
      code: 'CL-0007', type: 'corporate', name: 'Dr. Reddy’s Laboratories Ltd',
      primaryContact: { name: 'Pallavi Kulkarni', role: 'Lead — Internal Comms', phone: '+91 40 4900 2900', email: 'pallavik@drreddys.com' },
      billing: {
        legalName: 'Dr. Reddy’s Laboratories Limited', gstin: '36AAACD7999Q1ZX', pan: 'AAACD7999Q',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: '8-2-337, Road No. 3, Banjara Hills', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500034' },
        placeOfSupply: '36'
      },
      source: 'website', sourceDetail: 'RFP through the contact form', tags: ['rfp']
    },
    deal: {
      code: 'EV-2026-0007', title: 'Dr. Reddy’s Global R&D Townhall', category: 'corporate', subType: 'townhall',
      stage: 'proposal_sent', quotedValue: 2750000, discount: 0, estimatedCost: 1980000,
      budgetIndicated: 2500000, guestCount: 450, poNumber: '',
      venue: { name: 'Hyderabad International Convention Centre', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'convention' },
      eventDates: [{ date: d(58) }],
      functions: functions(58, [{ label: 'Townhall + dinner', type: 'townhall', day: 0, guests: 450, value: 2750000 }]),
      createdAt: d(-16)
    },
    template: 'corporate_50_50_net30', schedule: false
  },
  {
    client: {
      code: 'CL-0008', type: 'corporate', name: 'GMR Group',
      primaryContact: { name: 'Arvind Menon', role: 'GM — Corporate Affairs', phone: '+91 40 6629 4000', email: 'arvind.menon@gmrgroup.in' },
      billing: {
        legalName: 'GMR Enterprises Private Limited', gstin: '36AAACG2029N1Z3', pan: 'AAACG2029N',
        isRegistered: true, tdsApplicable: true, tdsSection: '194J', tdsDeducteeType: 'company',
        address: { line1: 'Skyview 10, Hitec City', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500081' },
        placeOfSupply: '36'
      },
      source: 'referral', sourceDetail: 'Referred by RGIA terminal ops', tags: ['194J']
    },
    deal: {
      code: 'EV-2026-0008', title: 'GMR Founder’s Day Gala', category: 'corporate', subType: 'gala_dinner',
      stage: 'site_visit', quotedValue: 4100000, discount: 0, estimatedCost: 2900000,
      budgetIndicated: 4000000, guestCount: 700,
      venue: { name: 'GMR Aerocity Lawns', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'outdoor' },
      eventDates: [{ date: d(74) }],
      functions: functions(74, [{ label: 'Founder’s Day Gala', type: 'gala_dinner', day: 0, guests: 700, value: 4100000 }]),
      createdAt: d(-9)
    },
    template: 'corporate_50_50_net30', schedule: false
  },
  {
    client: {
      code: 'CL-0009', type: 'corporate', name: 'Apollo Hospitals Enterprise Ltd',
      primaryContact: { name: 'Dr. Kavitha Srinivasan', role: 'Head — Academics', phone: '+91 44 2829 3333', email: 'kavitha.s@apollohospitals.com' },
      billing: {
        legalName: 'Apollo Hospitals Enterprise Limited', gstin: '33AAACI1195H1ZB', pan: 'AAACI1195H',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: '19 Bishop Gardens, Raja Annamalaipuram', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', pincode: '600028' },
        placeOfSupply: '36'
      },
      source: 'wedmegood', sourceDetail: 'Directory listing — corporate enquiry, unusual', tags: []
    },
    deal: {
      code: 'EV-2026-0009', title: 'Apollo CME Conference', category: 'corporate', subType: 'keynote',
      stage: 'qualified', quotedValue: 1850000, discount: 0, budgetIndicated: 1800000, guestCount: 260,
      venue: { name: 'Marigold by Greenpark', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'hotel' },
      eventDates: [{ date: d(112) }],
      functions: functions(112, [{ label: 'CME day', type: 'keynote', day: 0, guests: 260, value: 1850000 }]),
      createdAt: d(-5)
    },
    template: 'corporate_50_50_net30', schedule: false
  },
  {
    client: {
      code: 'CL-0010', type: 'corporate', name: 'Swiggy (Bundl Technologies Pvt Ltd)',
      primaryContact: { name: 'Rhea D’Souza', role: 'Employer Brand', phone: '+91 80 6817 6666', email: 'rhea.dsouza@swiggy.in' },
      billing: {
        legalName: 'Bundl Technologies Private Limited', gstin: '29AAFCB7707D1Z0', pan: 'AAFCB7707D',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: 'Embassy Tech Village, Devarabeesanahalli', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560103' },
        placeOfSupply: '29'   // Bengaluru venue → INTER-state from Telangana → IGST
      },
      source: 'instagram', sourceDetail: 'Reached out after the HDFC awards recap', tags: ['new']
    },
    deal: {
      code: 'EV-2026-0010', title: 'Swiggy Annual Offsite', category: 'corporate', subType: 'townhall',
      stage: 'enquiry', quotedValue: 0, budgetIndicated: 3000000, guestCount: 500,
      venue: { name: 'Taj Yeshwantpur', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', type: 'hotel' },
      eventDates: [{ date: d(151) }, { date: d(152) }],
      functions: functions(151, [
        { label: 'Offsite day 1', type: 'townhall', day: 0, guests: 500, value: 0 },
        { label: 'Awards dinner', type: 'gala_dinner', day: 1, guests: 500, value: 0 }
      ]),
      createdAt: d(-1)
    },
    template: 'corporate_50_50_net30', schedule: false
  },

  // --------------------------------------------------------- political
  {
    client: {
      code: 'CL-0011', type: 'political', name: 'Jana Shakti Party — Telangana Unit',
      primaryContact: { name: 'Srinivas Goud', role: 'State Convenor', phone: '+91 94900 55512', whatsapp: '+91 94900 55512', email: 'office.tg@janashakti.org' },
      billing: {
        legalName: 'Jana Shakti Party (Telangana State Committee)', pan: 'AABTJ9910C',
        isRegistered: false, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: 'Party Office, Somajiguda', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500082' },
        placeOfSupply: '36'
      },
      source: 'referral', sourceDetail: 'Introduced by the district unit', tags: ['short-lead', 'advance-heavy']
    },
    deal: {
      code: 'EV-2026-0011', title: 'Warangal Public Meeting', category: 'political', subType: 'rally',
      stage: 'live', quotedValue: 4800000, discount: 0, estimatedCost: 3600000, guestCount: 45000,
      venue: { name: 'Arts College Ground, Warangal', city: 'Warangal', state: 'Telangana', stateCode: '36', type: 'outdoor' },
      eventDates: [{ date: T() }],
      functions: functions(0, [{ label: 'Public meeting', type: 'rally', day: 0, start: '15:00', end: '21:00', guests: 45000, value: 4800000 }]),
      bookedAt: d(-11), createdAt: d(-14)
    },
    template: 'political_70_30',
    // 70% up front and nine days of lead time. The advance IS the credit control.
    receipts: [{ seq: 1, mode: 'rtgs', on: d(-10), ref: 'UTR 2214009988', full: true, tdsSection: '194C' }]
  },
  {
    client: {
      code: 'CL-0012', type: 'political', name: 'Bharath Yuva Morcha',
      primaryContact: { name: 'Praveen Kumar', role: 'Campaign Manager', phone: '+91 99120 44771', email: 'praveen@bymorcha.in' },
      billing: {
        legalName: 'Bharath Yuva Morcha', isRegistered: false, tdsApplicable: false,
        address: { line1: 'Ameerpet', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500016' },
        placeOfSupply: '36'
      },
      source: 'cold', sourceDetail: 'Cold call from the campaign office', tags: ['cancelled']
    },
    deal: {
      code: 'EV-2026-0012', title: 'Nizamabad Roadshow', category: 'political', subType: 'roadshow',
      // CANCELLED, not lost. The advance is already banked, the LED walls were
      // already booked, and someone has to decide what is retained. A lost deal
      // has no such decision — that is why the two stages stay separate.
      stage: 'cancelled', lostReason: 'postponed',
      quotedValue: 1600000, discount: 0, estimatedCost: 1150000, guestCount: 8000,
      venue: { name: 'Town Hall Road, Nizamabad', city: 'Nizamabad', state: 'Telangana', stateCode: '36', type: 'outdoor' },
      eventDates: [{ date: d(-6) }],
      functions: functions(-6, [{ label: 'Roadshow', type: 'roadshow', day: 0, guests: 8000, value: 1600000 }]),
      bookedAt: d(-25), createdAt: d(-30)
    },
    template: 'political_70_30',
    receipts: [{ seq: 1, mode: 'cash', on: d(-24), ref: 'Counter receipt 0091', amount: 800000 }]
  },

  // ------------------------------------------------------- exhibition / lost
  {
    client: {
      code: 'CL-0013', type: 'agency', name: 'Vasavi Group',
      primaryContact: { name: 'Harish Vasavi', role: 'Marketing Head', phone: '+91 40 2355 1100', email: 'harish@vasavigroup.in' },
      billing: {
        legalName: 'Vasavi Infra Projects Pvt Ltd', gstin: '36AABCV5512Q1ZR', pan: 'AABCV5512Q',
        isRegistered: true, tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company',
        address: { line1: 'Vasavi MPM Grand, Ameerpet', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500016' },
        placeOfSupply: '36'
      },
      source: 'venue_partner', sourceDetail: 'HITEX exhibitor list', tags: []
    },
    deal: {
      code: 'EV-2026-0013', title: 'Vasavi Pavilion — Hyderabad Property Show', category: 'exhibition', subType: 'other',
      stage: 'in_production', quotedValue: 2200000, discount: 50000, estimatedCost: 1550000, guestCount: 0,
      venue: { name: 'HITEX Exhibition Centre', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'convention' },
      eventDates: [{ date: d(12) }, { date: d(13) }, { date: d(14) }],
      functions: functions(12, [
        { label: 'Show day 1', type: 'other', day: 0, start: '10:00', end: '20:00', value: 900000 },
        { label: 'Show day 2', type: 'other', day: 1, start: '10:00', end: '20:00', value: 700000 },
        { label: 'Show day 3', type: 'other', day: 2, start: '10:00', end: '20:00', value: 600000 }
      ]),
      bookedAt: d(-88), createdAt: d(-105)
    },
    template: 'exhibition_25_40_35',
    receipts: [
      { seq: 1, mode: 'neft', on: d(-88), ref: 'UTR 6612003311', full: true, tdsSection: '194C' },
      { seq: 2, mode: 'neft', on: d(-52), ref: 'UTR 6620114477', full: true, tdsSection: '194C' }
    ]
  },
  {
    client: {
      code: 'CL-0014', type: 'individual', name: 'Nandini & Aditya',
      primaryContact: { name: 'Aditya Varma', role: 'Host', phone: '+91 97010 88123', email: 'aditya.varma@gmail.com' },
      billing: {
        legalName: 'Aditya Varma', isRegistered: false, tdsApplicable: false,
        address: { line1: 'Kokapet', city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500075' },
        placeOfSupply: '36'
      },
      source: 'wedmegood', sourceDetail: 'Directory lead — priced out at first call', tags: ['price-sensitive']
    },
    deal: {
      code: 'EV-2026-0014', title: 'Varma Anniversary Dinner', category: 'private', subType: 'other',
      stage: 'lost', lostReason: 'budget',
      quotedValue: 900000, discount: 0, budgetIndicated: 450000, guestCount: 120,
      venue: { name: 'Olive Bistro, Durgam Cheruvu', city: 'Hyderabad', state: 'Telangana', stateCode: '36', type: 'outdoor' },
      eventDates: [{ date: d(40) }],
      functions: functions(40, [{ label: 'Anniversary dinner', type: 'other', day: 0, guests: 120, value: 900000 }]),
      createdAt: d(-19)
    },
    template: 'wedding_40_30_30', schedule: false
  }
];

/**
 * Build the whole store from the specs above: clients, deals, milestones from
 * the segment templates, receipts allocated against those milestones with TDS
 * where the client deducts it, and an activity trail that reads like a log
 * somebody actually kept.
 */
export function seedCrm() {
  const clients = [];
  const deals = [];
  const milestones = [];
  const receipts = [];
  const invoices = [];
  const activity = [];
  let receiptNo = 0;
  let invoiceNo = 0;
  let activityNo = 0;

  const push = (entry) => {
    activityNo += 1;
    activity.push({ id: `ac_seed_${activityNo}`, clientId: '', dealId: '', type: 'note', text: '', ...entry });
  };

  SPECS.forEach((spec, idx) => {
    const client = makeClient({ ...spec.client, id: `cl_seed_${idx + 1}` });
    client.createdAt = spec.deal.createdAt || d(-30);
    client.updatedAt = todayISO();
    clients.push(client);
    push({ clientId: client.id, at: client.createdAt, type: 'client_created', text: `Enquiry logged — source: ${client.source}${client.sourceDetail ? ` (${client.sourceDetail})` : ''}` });

    const deal = makeDeal({ ...spec.deal, id: `dl_seed_${idx + 1}`, clientId: client.id });
    deal.phase = phaseForStage(deal.stage);
    deal.probability = probabilityForStage(deal.stage);
    deal.bookedAt = spec.deal.bookedAt || '';
    deal.updatedAt = todayISO();
    const template = templateById(spec.template) || defaultTemplateFor(deal.category);
    deal.milestoneTemplateId = template.id;
    deal.stageHistory = [{ stage: 'enquiry', at: deal.createdAt, note: 'Enquiry received' }];
    if (deal.bookedAt) deal.stageHistory.push({ stage: 'booked', at: deal.bookedAt, note: 'Advance received, date blocked' });
    if (deal.stage !== 'enquiry') deal.stageHistory.push({ stage: deal.stage, at: deal.stageChangedAt || todayISO(), note: '' });
    deals.push(deal);

    const net = Math.max(0, deal.quotedValue - deal.discount);
    const pos = deal.venue.stateCode || client.billing.placeOfSupply || '36';

    // A deal still in the sales phase has no payment schedule yet — you do not
    // schedule money you have not been promised.
    const wantsSchedule = spec.schedule !== false && net > 0;
    const dealMilestones = wantsSchedule
      ? buildMilestones(template, deal, net).map((row, i) =>
          makeMilestone({ ...row, id: `ms_seed_${idx + 1}_${i + 1}`, dealId: deal.id }))
      : [];
    milestones.push(...dealMilestones);

    (spec.invoices || []).forEach(spec2 => {
      const ms = dealMilestones.find(m => m.sequence === spec2.milestoneSeq);
      if (!ms) return;
      invoiceNo += 1;
      invoices.push(makeInvoice({
        id: `in_seed_${invoiceNo}`,
        invoiceNo: `HLM/26-27/${String(invoiceNo).padStart(4, '0')}`,
        dealId: deal.id, clientId: client.id, milestoneId: ms.id,
        type: spec2.type, issueDate: spec2.issue, dueDate: ms.dueDate,
        placeOfSupply: pos, poNumber: deal.poNumber,
        lineItems: [{ description: `${deal.title} — ${ms.label}`, sac: '9983', qty: 1, rate: ms.amountDue, gstRate: 18 }],
        status: 'issued'
      }));
    });

    (spec.receipts || []).forEach(r => {
      const ms = dealMilestones.find(m => m.sequence === r.seq);
      if (!ms) return;
      const gst = gstForPlaceOfSupply(ms.amountDue, pos);
      const gross = ms.amountDue + gst.total;
      const section = client.billing.tdsApplicable ? (r.tdsSection || client.billing.tdsSection) : null;
      const tds = section ? computeTds(ms.amountDue, section, client.billing.tdsDeducteeType) : 0;
      // `full: true` means the client cleared the milestone. If they withheld
      // TDS, the BANK CREDIT is short by exactly that much and the milestone is
      // still fully settled.
      const amount = r.amount != null ? r.amount : gross - tds;
      const tdsOnThis = r.amount != null ? 0 : tds;
      receiptNo += 1;
      receipts.push(makeReceipt({
        id: `rc_seed_${receiptNo}`,
        receiptNo: `RCP-26-27-${String(receiptNo).padStart(4, '0')}`,
        dealId: deal.id, clientId: client.id,
        allocations: [{ milestoneId: ms.id, amount, tds: tdsOnThis }],
        amount, tdsDeducted: tdsOnThis, tdsSection: tdsOnThis ? section : null,
        receivedOn: r.on, mode: r.mode, reference: r.ref, recordedBy: 'Meera (Accounts)'
      }));
      push({
        clientId: client.id, dealId: deal.id, at: r.on, type: 'receipt',
        text: `${ms.label} — ${r.mode.toUpperCase()} ${r.ref}${tdsOnThis ? ` · TDS ${section} withheld` : ''}`,
        amount
      });
    });

    if (deal.stage === 'lost') {
      push({ clientId: client.id, dealId: deal.id, at: todayISO(), type: 'stage_changed', text: `Lost — ${deal.lostReason}` });
    }
    if (deal.stage === 'cancelled') {
      push({ clientId: client.id, dealId: deal.id, at: d(-6), type: 'stage_changed', text: 'Cancelled after booking — advance retained against committed vendor costs' });
    }
  });

  return {
    version: 1,
    clients, deals, milestones, receipts, invoices,
    vendorPayouts: [
      { id: 'vp_seed_1', dealId: 'dl_seed_1', vendorName: 'Ferns N Petals — Décor', service: 'Floral & décor', gross: 1850000, gstRate: 18, tdsSection: '194C', deducteeType: 'company', paidOn: d(-30), status: 'paid' },
      { id: 'vp_seed_2', dealId: 'dl_seed_1', vendorName: 'Sunrise Tent House', service: 'Fabrication', gross: 940000, gstRate: 18, tdsSection: '194C', deducteeType: 'individual_huf', paidOn: d(-12), status: 'paid' },
      { id: 'vp_seed_3', dealId: 'dl_seed_5', vendorName: 'Prism AV Solutions', service: 'Sound & lighting', gross: 320000, gstRate: 18, tdsSection: '194C', deducteeType: 'company', paidOn: d(-24), status: 'paid' },
      { id: 'vp_seed_4', dealId: 'dl_seed_11', vendorName: 'Sri Balaji LED Walls', service: 'LED & staging', gross: 1100000, gstRate: 18, tdsSection: '194C', deducteeType: 'company', paidOn: d(-8), status: 'paid' }
    ],
    activity: activity.sort((a, b) => String(a.at).localeCompare(String(b.at))),
    counters: { client: clients.length, deal: deals.length, receipt: receiptNo, invoice: invoiceNo }
  };
}

export default seedCrm;
