# Generating better 360° plates

The plates that ship today are wide photographs mapped onto a sphere by
`tools/pano360.py`. The geometry is correct and seamless, but the content behind the
viewer is the photograph's own edges rather than a real view of what is behind the
camera. This document is what to do when you want to fix that properly.

---

## Why "just generate the back view" is not enough

A rectilinear photograph at a realistic wide-angle field of view covers roughly 110°
horizontally and 62° vertically. Two of them — one front, one back — cover:

| | Horizontal | Vertical |
|---|---|---|
| Front plate @ 110° | 110° of 360° | 62° of 180° |
| Back plate @ 150° | 150° of 360° | 84° of 180° |
| **Combined** | **260° of 360° (72%)** | **still nothing above ~42° or below −42°** |

That leaves two ~50° wedges at the sides with no data, and the entire ceiling and floor
missing. You would need **four to six** images to close it, and every join between them
has to be blended or it shows.

`tools/pano360.py --reproject --rear back.jpg` implements this path and works, but it is
not what ships, for exactly this reason.

**The efficient answer is to generate the equirectangular projection directly** — one
image per plate, no stitching, no gaps.

---

## Option 1 — generate true equirectangular images (recommended)

Use a generator that outputs the projection natively. Blockade Labs **Skybox AI** exports
8192×4096 equirectangular and is the usual choice; any tool advertising "360 skybox" or
"equirectangular" output works.

Then, for each file:

```bash
python3 tools/pano360.py generated.jpg public/images/<name>.jpg --width 3072
npm run panorama:manifest
npm run panorama:check
```

`pano360.py` still earns its place here — it normalises to 2:1, closes the wrap seam and
resolves the poles, which generated panoramas often get subtly wrong.

### Prompts, one per zone

Each prompt is written for an equirectangular generator. The three rules that matter:
state the projection, put the horizon on the vertical centre line, and describe what is
**behind** the camera as well as in front, because a full sphere has no "off camera".

**`zone-stage` — Main Stage Lawn**
> Equirectangular 360° panorama, seamless, horizon on the centre line. Standing mid-crowd
> on a manicured lawn at blue hour. Ahead: a wide arched concert stage with truss towers,
> warm spotlights and two side LED screens. Behind: the rest of the seated lawn crowd
> receding to a treeline, string lights overhead, food stalls and a distant entry arch.
> Above: dusk sky with soft cloud. Below: trodden grass and scattered picnic blankets.

**`zone-banquet` — Royal Banquet Ballroom**
> Equirectangular 360° panorama, seamless, horizon centred. Inside an ornate gilded
> ballroom. Round banquet tables with white linen, gold Chiavari chairs and tall floral
> centrepieces fill every direction. Crystal chandeliers overhead against a painted
> coffered ceiling. Polished parquet floor below. Tall draped windows and a service
> entrance behind the viewer.

**`zone-fountain` — Garden Fountain Plaza**
> Equirectangular 360° panorama, seamless, horizon centred. Outdoor stone plaza at dusk
> around a lit tiered marble fountain. Cocktail tables and guests all around, potted
> hydrangeas, clipped hedges, festoon lights strung overhead. Villa façades on two sides,
> open garden and a balustrade with a valley view behind. Flagstone paving below.

**`zone-lounge` — VIP Lounge Terrace**
> Equirectangular 360° panorama, seamless, horizon centred. Rooftop terrace lounge at
> night. Emerald velvet sofas, low brass tables, a lit bar with stools, trailing greenery
> and warm Edison bulbs. City skyline with lit towers on one side, glass balustrade all
> around, pergola slats overhead, dark timber decking below.

**`zone-entrance` — Entrance Arch & Photo Wall**
> Equirectangular 360° panorama, seamless, horizon centred. Marble hotel foyer set for a
> wedding welcome. A dense rose-and-carnation floral arch over a red carpet ahead; behind,
> the entrance doors and a valet drop-off visible through glass. Chandeliers and a
> decorated staircase to one side, guests in formal Indian wear. Polished marble floor
> below with the carpet running through.

**`zone-india-election` — Election Rally (Jansabha)**
> Equirectangular 360° panorama, seamless, horizon centred. Standing in the crowd at a
> large Indian political rally at dusk. Ahead: a wide decorated rally stage with a Hindi
> banner, bulletproof podium, line-array speakers and LED screens. All around and behind:
> a vast crowd with tricolour and party flags stretching to steel barricades, high-mast
> floodlight towers, parked buses at the perimeter, a distant city skyline. Hazy warm sky
> above, dusty open ground below.

**`zone-india-function` — Grand Function (Royal Mandap)**
> Equirectangular 360° panorama, seamless, horizon centred. Inside a grand Indian wedding
> hall. Ahead: a carved gold mandap with red and marigold drapes and a sacred fire. All
> around: seated guests in saris and sherwanis, marigold garlands, red patterned carpet.
> Behind: the hall entrance with a decorated doorway and a buffet line. Ornate ceiling with
> chandeliers and hanging florals above.

**`zone-india-meeting` — Public Meeting / Summit**
> Equirectangular 360° panorama, seamless, horizon centred. Inside a modern ministerial
> summit auditorium. Ahead: a curved dais with a digital podium and a wide LED backdrop
> showing flags. All around: a horseshoe of delegate desks with microphones, nameplates and
> laptops, occupied by delegates. Behind: tiered press seating, cameras and a glass control
> booth. Acoustic wood ceiling with downlights above, patterned carpet below.

### If you generate the item variants too

The whole product depends on this rule: **the environment must be pixel-identical between
a zone's variants, and only the one item may change.** Generate the base plate first, then
generate each variant with the same prompt plus a single substituted clause — for example,
for `zone-india-election` replace *"bulletproof podium"* with *"carved wooden presidential
podium"* and change nothing else. If the generator drifts the background, the swap will
read as a jump cut rather than a change of item.

---

## Option 2 — shoot it

A 360 camera (Insta360, Ricoh Theta) produces equirectangular JPEGs directly and removes
every question of invented content.

**Log the tripod height at each position.** It is the single most valuable piece of capture
metadata: with camera height `h`, clicking an object's floor-contact point at pitch `φ`
gives its distance `D = h / tan(−φ)`. One click then yields a real metric position, which
is what makes accurately placed and scaled item overlays possible.

---

## Option 3 — the layered path (the real answer at scale)

Pre-rendering a plate per combination does not scale. A zone with 5 slots and 6 options per
slot has 6⁵ = **7,776** combinations; adding a 7th option to each slot takes it to 16,807.
You cannot generate your way out of that.

The way out is to stop baking items into the plate: keep **one** environment plate per zone
and composite each item as its own transparent overlay at a known `(yaw, pitch)` with a
known angular size. 5 slots × 6 options becomes **31 assets** instead of 7,776, a new SKU
costs one asset, and **every** combination works — including ones nobody thought to
pre-render, which is exactly the combination a client will ask for.

This is mathematically exact here, not an approximation: a 360 viewer's camera only ever
rotates, never translates, and parallax comes only from translation. A flat overlay at the
correct angular position projects to exactly the pixels a real object would, at every angle
and zoom.

Each item wants two layers: the colour overlay, and a soft multiply shadow on the floor.
The contact shadow is what stops it reading as a sticker.


---

## Catalogue artwork debt — 9 groups need new photography

Nine groups of catalogue items are illustrated with the **same photograph** despite
being sold at different prices. This is the single most visible asset problem left,
because a client comparing two options sees the picture, not the id — the 360 cannot
show a difference, the swap looks broken, and the higher quote is indefensible.

| Shared photo | Items sharing it | Spread |
|---|---|---|
| `backdrop_floral_wall.jpg` | Floral wall ₹25,000 · Dual LED screen ₹4,20,000 | **16.8×** |
| `fountain_glass_waterfall.jpg` | Glass waterfall ₹35,000 · Dancing jets ₹1,85,000 | 5.3× |
| `backdrop_election_flags.jpg` | Election flags ₹45,000 · Screen left ₹2,60,000 | 5.8× |
| `lighting_rally_highmast.jpg` | Horn speakers ₹12,000 · Line array ₹65,000 · High-mast ₹65,000 | 5.4× |
| `fountain_royal_marble.jpg` | Royal marble ₹65,000 · Tiered stone ₹18,000 | 3.6× |
| `backdrop_shimmer_sequin.jpg` | Shimmer sequin ₹15,000 · Screen shimmer ₹65,000 | 4.3× |
| `chair_velvet_armchair.jpg` | Velvet armchair ₹1,200 · Chesterfield ₹9,500 · Velvet lounge ₹14,000 | 11.7× |
| `chair_maharaja_throne.jpg` | Maharaja throne ₹18,000 · Royal Maharani sofa ₹22,000 | 1.2× |
| `lighting_temple_lanterns.jpg` | Temple lanterns ₹28,000 · Brass diyas ₹22,000 | 1.3× |

`test/contracts.test.mjs` holds this as `KNOWN_SHARED_ARTWORK` and enforces it in
both directions: a **new** duplicate fails the build, and a line that has been
fixed must be deleted rather than quietly granting a future duplicate a free pass.
The list can only shrink.

Shoot or generate one photograph per item, on the same dark studio sweep as the
rest of the catalogue, then run `python3 tools/make_cutouts.py` and
`python3 tools/bake_overlays.py --all`.
