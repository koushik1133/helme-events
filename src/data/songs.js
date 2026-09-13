/**
 * Cue library for Indian event run-sheets.
 *
 * This is a PLANNING library, not a media library — Helm does not stream or
 * host audio. Each entry is a cue an agency hands to the DJ or the anchor:
 * what plays, who recorded it, which language, and the moment it belongs to.
 *
 * `moment` is the authoritative grouping used by PlaylistBuilder lanes.
 */

/** Run-sheet moments, in the order a wedding/event day actually runs. */
export const MOMENTS = [
  { id: 'devotional', label: 'Invocation', note: 'Ganesh vandana / temple opening before guests are seated' },
  { id: 'mehendi', label: 'Mehendi', note: 'Daytime courtyard, folk and light Punjabi' },
  { id: 'sangeet', label: 'Sangeet', note: 'Choreographed performances and the family dance-off' },
  { id: 'baraat', label: 'Baraat', note: 'Dhol-led procession — highest energy of the day' },
  { id: 'bridal-entry', label: 'Bridal Entry', note: 'Phoolon ki chaadar walk, slow and cinematic' },
  { id: 'varmala', label: 'Varmala', note: 'Garland exchange — builds then drops to applause' },
  { id: 'pheras', label: 'Pheras', note: 'Live shehnai / soft instrumental under the priest' },
  { id: 'vidaai', label: 'Vidaai', note: 'Farewell — restrained, never upbeat' },
  { id: 'reception', label: 'Reception', note: 'Couple entry, first dance, dinner beds' },
  { id: 'cocktail', label: 'Cocktail Lounge', note: 'Low-BPM instrumental while guests mingle' },
  { id: 'after-party', label: 'After Party', note: 'Late-night floor, club tempo' },
  { id: 'corporate-walkin', label: 'Summit Walk-in', note: 'Delegate arrival and registration beds' },
  { id: 'corporate-award', label: 'Awards & Keynote', note: 'Stings, walk-ups and applause beds' },
  { id: 'rally', label: 'Political Rally', note: 'Slogan beds, anthem and crowd warm-up' }
];

export const SONG_LIBRARY = [
  /* ---------------------------------------------------------- Invocation */
  { id: 's1', title: 'Ganesh Vandana (Vakratunda Mahakaya)', artist: 'Traditional', composer: 'Traditional Sanskrit shloka', language: 'Sanskrit', genre: 'devotional', moment: 'devotional', duration: '3:10', bpm: 72 },
  { id: 's2', title: 'Gayatri Mantra', artist: 'Anuradha Paudwal', composer: 'Traditional', language: 'Sanskrit', genre: 'devotional', moment: 'devotional', duration: '4:05', bpm: 58 },
  { id: 's3', title: 'Om Jai Jagdish Hare', artist: 'Traditional aarti', composer: 'Shraddha Ram Phillauri', language: 'Hindi', genre: 'devotional', moment: 'devotional', duration: '5:20', bpm: 64 },
  { id: 's4', title: 'Shehnai Mangalam (live)', artist: 'Resident shehnai ensemble', composer: 'Traditional raga Bhairavi', language: 'Instrumental', genre: 'classical', moment: 'devotional', duration: '6:00', bpm: 60 },
  { id: 's5', title: 'Venkateswara Suprabhatam', artist: 'M. S. Subbulakshmi', composer: 'Prativadi Bhayankara Annan', language: 'Sanskrit', genre: 'devotional', moment: 'devotional', duration: '8:40', bpm: 54 },

  /* ------------------------------------------------------------- Mehendi */
  { id: 's6', title: 'Mehendi Laga Ke Rakhna', artist: 'Lata Mangeshkar, Udit Narayan', composer: 'Jatin–Lalit', film: 'Dilwale Dulhania Le Jayenge', language: 'Hindi', genre: 'bollywood', moment: 'mehendi', duration: '5:14', bpm: 108 },
  { id: 's7', title: 'Navrai Majhi', artist: 'Shalmali Kholgade, Vishal Dadlani', composer: 'Amit Trivedi', film: 'English Vinglish', language: 'Marathi/Hindi', genre: 'folk-fusion', moment: 'mehendi', duration: '4:22', bpm: 122 },
  { id: 's8', title: 'Banno', artist: 'Brijesh Shandaliya, Swati Sharma', composer: 'Vishal–Shekhar', film: 'Tanu Weds Manu Returns', language: 'Hindi', genre: 'bollywood', moment: 'mehendi', duration: '3:35', bpm: 130 },
  { id: 's9', title: 'Genda Phool', artist: 'Badshah, Payal Dev', composer: 'Badshah', language: 'Hindi/Bengali', genre: 'hip-hop', moment: 'mehendi', duration: '2:48', bpm: 96 },
  { id: 's10', title: 'Sadi Gali', artist: 'Lehmber Hussainpuri', composer: 'RDB', film: 'Tanu Weds Manu', language: 'Punjabi', genre: 'bhangra', moment: 'mehendi', duration: '3:58', bpm: 132 },

  /* ------------------------------------------------------------- Sangeet */
  { id: 's11', title: 'Gallan Goodiyaan', artist: 'Yashita Sharma, Manish Kumar Tipu, Farhan Akhtar', composer: 'Shankar–Ehsaan–Loy', film: 'Dil Dhadakne Do', language: 'Hindi', genre: 'bollywood', moment: 'sangeet', duration: '4:59', bpm: 124 },
  { id: 's12', title: 'Dholida', artist: 'Udit Narayan, Neha Kakkar', composer: 'Pritam', film: 'Loveyatri', language: 'Gujarati/Hindi', genre: 'garba', moment: 'sangeet', duration: '3:15', bpm: 140 },
  { id: 's13', title: 'Nagada Sang Dhol', artist: 'Shreya Ghoshal, Osman Mir', composer: 'Sanjay Leela Bhansali', film: 'Goliyon Ki Raasleela Ram-Leela', language: 'Gujarati/Hindi', genre: 'garba', moment: 'sangeet', duration: '4:10', bpm: 138 },
  { id: 's14', title: 'Saami Saami', artist: 'Mounika Yadav', composer: 'Devi Sri Prasad', film: 'Pushpa', language: 'Telugu', genre: 'tollywood', moment: 'sangeet', duration: '3:32', bpm: 118 },
  { id: 's15', title: 'Chogada', artist: 'Darshan Raval, Asees Kaur', composer: 'Lijo George–DJ Chetas', film: 'Loveyatri', language: 'Gujarati/Hindi', genre: 'garba', moment: 'sangeet', duration: '3:22', bpm: 136 },
  { id: 's16', title: 'Aankh Marey', artist: 'Mika Singh, Neha Kakkar, Kumar Sanu', composer: 'Tanishk Bagchi', film: 'Simmba', language: 'Hindi', genre: 'bollywood', moment: 'sangeet', duration: '2:55', bpm: 128 },
  { id: 's17', title: 'What Jhumka?', artist: 'Arijit Singh, Jonita Gandhi', composer: 'Pritam', film: 'Rocky Aur Rani Kii Prem Kahaani', language: 'Hindi', genre: 'bollywood', moment: 'sangeet', duration: '3:20', bpm: 126 },

  /* -------------------------------------------------------------- Baraat */
  { id: 's18', title: 'Kala Chashma', artist: 'Amar Arshi, Badshah, Neha Kakkar', composer: 'Prem & Hardeep, Badshah', film: 'Baar Baar Dekho', language: 'Punjabi/Hindi', genre: 'bhangra', moment: 'baraat', duration: '3:37', bpm: 136 },
  { id: 's19', title: 'London Thumakda', artist: 'Labh Janjua, Sonu Kakkar, Neha Kakkar', composer: 'Sneha Khanwalkar', film: 'Queen', language: 'Hindi/Punjabi', genre: 'bhangra', moment: 'baraat', duration: '3:31', bpm: 130 },
  { id: 's20', title: 'Morni Banke', artist: 'Guru Randhawa, Neha Kakkar', composer: 'Tanishk Bagchi', film: 'Badhaai Ho', language: 'Punjabi', genre: 'bhangra', moment: 'baraat', duration: '3:12', bpm: 128 },
  { id: 's21', title: 'Nachde Ne Saare', artist: 'Jasleen Royal', composer: 'Vishal–Shekhar', film: 'Baar Baar Dekho', language: 'Punjabi/Hindi', genre: 'bhangra', moment: 'baraat', duration: '3:24', bpm: 134 },
  { id: 's22', title: 'Dhol Baaje (live dhol squad)', artist: 'Resident dhol ensemble', composer: 'Traditional Punjabi taal', language: 'Instrumental', genre: 'percussion', moment: 'baraat', duration: '6:00', bpm: 142 },
  { id: 's23', title: 'Bom Diggy Diggy', artist: 'Zack Knight, Jasmin Walia', composer: 'Zack Knight', film: 'Sonu Ke Titu Ki Sweety', language: 'Hindi/English', genre: 'dance', moment: 'baraat', duration: '2:46', bpm: 120 },

  /* -------------------------------------------------------- Bridal entry */
  { id: 's24', title: 'Din Shagna Da', artist: 'Jasleen Royal', composer: 'Jasleen Royal', film: 'Phillauri', language: 'Punjabi', genre: 'acoustic', moment: 'bridal-entry', duration: '3:08', bpm: 72 },
  { id: 's25', title: 'Ranjha', artist: 'B Praak, Jasleen Royal', composer: 'Jasleen Royal', film: 'Shershaah', language: 'Punjabi/Hindi', genre: 'ballad', moment: 'bridal-entry', duration: '4:09', bpm: 76 },
  { id: 's26', title: 'Ghar More Pardesiya', artist: 'Shreya Ghoshal, Vaishali Mhade', composer: 'Sanjay Leela Bhansali', film: 'Kalank', language: 'Hindi', genre: 'semi-classical', moment: 'bridal-entry', duration: '5:24', bpm: 80 },
  { id: 's27', title: 'Mere Yaaraa', artist: 'Arijit Singh, Neeti Mohan', composer: 'Tanishk Bagchi', film: 'Sooryavanshi', language: 'Hindi', genre: 'ballad', moment: 'bridal-entry', duration: '3:52', bpm: 74 },
  { id: 's28', title: 'Vaathi Coming (string cover)', artist: 'Instrumental quartet arrangement', composer: 'Anirudh Ravichander (orig.)', language: 'Instrumental', genre: 'strings', moment: 'bridal-entry', duration: '3:40', bpm: 88 },

  /* ------------------------------------------------------------- Varmala */
  { id: 's29', title: 'Tum Se Hi', artist: 'Mohit Chauhan', composer: 'Pritam', film: 'Jab We Met', language: 'Hindi', genre: 'ballad', moment: 'varmala', duration: '5:20', bpm: 82 },
  { id: 's30', title: 'Kabira (Encore)', artist: 'Arijit Singh, Harshdeep Kaur', composer: 'Pritam', film: 'Yeh Jawaani Hai Deewani', language: 'Hindi', genre: 'ballad', moment: 'varmala', duration: '3:43', bpm: 90 },
  { id: 's31', title: 'Sanu Ek Pal Chain', artist: 'Rahat Fateh Ali Khan', composer: 'Nusrat Fateh Ali Khan (orig.)', film: 'Raid', language: 'Punjabi/Urdu', genre: 'sufi', moment: 'varmala', duration: '4:34', bpm: 86 },
  { id: 's32', title: 'Bol Do Na Zara', artist: 'Armaan Malik', composer: 'Amaal Mallik', film: 'Azhar', language: 'Hindi', genre: 'ballad', moment: 'varmala', duration: '4:03', bpm: 78 },

  /* -------------------------------------------------------------- Pheras */
  { id: 's33', title: 'Mangalyam Tantunanena', artist: 'Traditional vivaha mantra', composer: 'Traditional Sanskrit', language: 'Sanskrit', genre: 'devotional', moment: 'pheras', duration: '3:45', bpm: 60 },
  { id: 's34', title: 'Raga Yaman — alap (live sitar)', artist: 'Resident sitar soloist', composer: 'Traditional', language: 'Instrumental', genre: 'classical', moment: 'pheras', duration: '9:00', bpm: 52 },
  { id: 's35', title: 'Bansuri Vivah Bed (live flute)', artist: 'Resident bansuri soloist', composer: 'Traditional raga Desh', language: 'Instrumental', genre: 'classical', moment: 'pheras', duration: '7:30', bpm: 56 },
  { id: 's36', title: 'Sri Rama Chandra Kripalu', artist: 'Traditional bhajan', composer: 'Tulsidas', language: 'Awadhi', genre: 'devotional', moment: 'pheras', duration: '4:50', bpm: 62 },

  /* -------------------------------------------------------------- Vidaai */
  { id: 's37', title: 'Babul Ka Yeh Ghar', artist: 'Sonu Nigam', composer: 'Nadeem–Shravan', film: 'Dulhan Banoo Main Teri', language: 'Hindi', genre: 'ballad', moment: 'vidaai', duration: '5:02', bpm: 68 },
  { id: 's38', title: 'Maiyya Yashoda (vidaai cut)', artist: 'Alka Yagnik, Anuradha Paudwal', composer: 'Anand–Milind', film: 'Hum Saath-Saath Hain', language: 'Hindi', genre: 'bollywood', moment: 'vidaai', duration: '4:40', bpm: 74 },
  { id: 's39', title: 'Chal Chaiyya (piano reduction)', artist: 'Solo piano arrangement', composer: 'A. R. Rahman (orig.)', language: 'Instrumental', genre: 'piano', moment: 'vidaai', duration: '3:30', bpm: 64 },

  /* ----------------------------------------------------------- Reception */
  { id: 's40', title: 'Raabta', artist: 'Arijit Singh', composer: 'Pritam', film: 'Agent Vinod', language: 'Hindi', genre: 'ballad', moment: 'reception', duration: '4:12', bpm: 94 },
  { id: 's41', title: 'Ilahi', artist: 'Arijit Singh', composer: 'Pritam', film: 'Yeh Jawaani Hai Deewani', language: 'Hindi', genre: 'pop', moment: 'reception', duration: '3:47', bpm: 100 },
  { id: 's42', title: 'Butta Bomma', artist: 'Armaan Malik', composer: 'Thaman S', film: 'Ala Vaikunthapurramuloo', language: 'Telugu', genre: 'tollywood', moment: 'reception', duration: '3:38', bpm: 112 },
  { id: 's43', title: 'Rowdy Baby', artist: 'Dhanush, Dhee', composer: 'Yuvan Shankar Raja', film: 'Maari 2', language: 'Tamil', genre: 'kollywood', moment: 'reception', duration: '4:03', bpm: 128 },
  { id: 's44', title: 'Tum Hi Ho', artist: 'Arijit Singh', composer: 'Mithoon', film: 'Aashiqui 2', language: 'Hindi', genre: 'ballad', moment: 'reception', duration: '4:22', bpm: 70 },
  { id: 's45', title: 'Jhoome Jo Pathaan', artist: 'Arijit Singh, Sukriti Kakar', composer: 'Vishal–Shekhar', film: 'Pathaan', language: 'Hindi', genre: 'dance', moment: 'reception', duration: '3:03', bpm: 124 },

  /* ------------------------------------------------------------ Cocktail */
  { id: 's46', title: 'Sitar Lounge Bed No. 1', artist: 'Resident sitar + pads duo', composer: 'Original house arrangement', language: 'Instrumental', genre: 'lounge-fusion', moment: 'cocktail', duration: '6:20', bpm: 82 },
  { id: 's47', title: 'Sandalwood Sax Set', artist: 'Resident saxophonist', composer: 'Standards medley', language: 'Instrumental', genre: 'jazz', moment: 'cocktail', duration: '8:00', bpm: 76 },
  { id: 's48', title: 'Tabla Electronica Bed', artist: 'Resident tabla + live electronics', composer: 'Original house arrangement', language: 'Instrumental', genre: 'electronica', moment: 'cocktail', duration: '7:10', bpm: 98 },
  { id: 's49', title: 'Piya Tose (lounge rework)', artist: 'Resident vocalist + trio', composer: 'S. D. Burman (orig.)', language: 'Hindi', genre: 'lounge-fusion', moment: 'cocktail', duration: '5:30', bpm: 84 },

  /* --------------------------------------------------------- After party */
  { id: 's50', title: 'Kar Gayi Chull', artist: 'Badshah, Fazilpuria, Neha Kakkar', composer: 'Badshah', film: 'Kapoor & Sons', language: 'Hindi/Punjabi', genre: 'dance', moment: 'after-party', duration: '2:45', bpm: 130 },
  { id: 's51', title: 'Naach Meri Rani', artist: 'Guru Randhawa, Nikhita Gandhi', composer: 'Tanishk Bagchi', language: 'Hindi/Punjabi', genre: 'dance', moment: 'after-party', duration: '3:21', bpm: 132 },
  { id: 's52', title: 'Illegal Weapon 2.0', artist: 'Jasmine Sandlas, Garry Sandhu', composer: 'Tanishk Bagchi', film: 'Street Dancer 3D', language: 'Punjabi', genre: 'dance', moment: 'after-party', duration: '3:04', bpm: 128 },
  { id: 's53', title: 'Late-Night Desi House Set', artist: 'Resident DJ', composer: 'Live mix', language: 'Instrumental', genre: 'house', moment: 'after-party', duration: '30:00', bpm: 124 },

  /* ------------------------------------------------------- Summit / corp */
  { id: 's54', title: 'Delegate Walk-in Bed (sitar fusion)', artist: 'Resident fusion trio', composer: 'Original house arrangement', language: 'Instrumental', genre: 'lounge-fusion', moment: 'corporate-walkin', duration: '12:00', bpm: 88 },
  { id: 's55', title: 'Registration Ambience (pads + tanpura)', artist: 'Resident ambient set', composer: 'Original house arrangement', language: 'Instrumental', genre: 'ambient', moment: 'corporate-walkin', duration: '15:00', bpm: 64 },
  { id: 's56', title: 'Keynote Walk-up Sting', artist: 'Resident production team', composer: 'Original house arrangement', language: 'Instrumental', genre: 'sting', moment: 'corporate-award', duration: '0:12', bpm: 120 },
  { id: 's57', title: 'Award Reveal Bed', artist: 'Resident production team', composer: 'Original house arrangement', language: 'Instrumental', genre: 'orchestral', moment: 'corporate-award', duration: '1:30', bpm: 104 },
  { id: 's58', title: 'Applause Loop & Play-off', artist: 'Resident production team', composer: 'Original house arrangement', language: 'Instrumental', genre: 'sting', moment: 'corporate-award', duration: '0:30', bpm: 112 },

  /* ---------------------------------------------------------------- Rally */
  { id: 's59', title: 'Vande Mataram', artist: 'Traditional / Lata Mangeshkar rendition', composer: 'Bankim Chandra Chattopadhyay', language: 'Sanskrit/Bengali', genre: 'patriotic', moment: 'rally', duration: '3:30', bpm: 72 },
  { id: 's60', title: 'Maa Tujhe Salaam', artist: 'A. R. Rahman', composer: 'A. R. Rahman', language: 'Hindi', genre: 'patriotic', moment: 'rally', duration: '7:12', bpm: 92 },
  { id: 's61', title: 'Campaign Slogan Bed (custom)', artist: 'Produced per client', composer: 'Custom — briefed by campaign team', language: 'Regional', genre: 'slogan-bed', moment: 'rally', duration: '2:00', bpm: 100 },
  { id: 's62', title: 'Crowd Warm-up Dhol Loop', artist: 'Resident dhol ensemble', composer: 'Traditional taal', language: 'Instrumental', genre: 'percussion', moment: 'rally', duration: '10:00', bpm: 138 },
  { id: 's63', title: 'Jana Gana Mana (national anthem)', artist: 'Standard 52-second rendition', composer: 'Rabindranath Tagore', language: 'Bengali/Sanskrit', genre: 'patriotic', moment: 'rally', duration: '0:52', bpm: 60 }
];

/** All songs cued to a given moment id. */
export function songsForMoment(momentId) {
  return SONG_LIBRARY.filter(s => s.moment === momentId);
}

/** Parse a "m:ss" duration into whole seconds. */
export function durationToSeconds(duration) {
  const parts = String(duration || '').split(':').map(Number);
  if (parts.length !== 2 || parts.some(n => !Number.isFinite(n))) return 0;
  return parts[0] * 60 + parts[1];
}
