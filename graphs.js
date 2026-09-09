/* ============================================================
   PhysDeck — sketch graphs shown on the revealed side of a card
   ------------------------------------------------------------
   Each entry is { svg, caption }:
     svg      a self-contained inline <svg> — axes, labels and
              ticks in currentColor so they sit on the card's own
              ink; the meaningful mark (curve, shaded area) takes
              the topic accent through var(--accent).
     caption  the sentence, rendered as an HTML <figcaption> so it
              wraps — SVG text cannot.
   Classes are styled from style.css; nothing is styled inline and
   the SVG carries no <style>, <script> or external reference.

   A card opts in with  graph: "<key>"  in data.js.
   ============================================================ */

/* Shared plot frame. Drawing area runs x 36 → 224, y 116 (zero) → 22. */
const AXES =
  '<g class="gax">' +
    '<line x1="36" y1="22" x2="36" y2="116" />' +
    '<line x1="36" y1="116" x2="224" y2="116" />' +
    '<polygon points="32,28 36,19 40,28" />' +
    '<polygon points="218,112 227,116 218,120" />' +
  '</g>';

/* Axis names are normally single symbols and sit at the arrow tip; a longer
   name (an LDR's "light intensity") is centred under the axis instead. */
function plot(aria, yLabel, xLabel, body, caption) {
  const xText = xLabel.length <= 2
    ? '<text class="glbl" x="232" y="120" text-anchor="start">' + xLabel + '</text>'
    : '<text class="glbl" x="130" y="136" text-anchor="middle">' + xLabel + '</text>';
  return {
    svg: '<svg viewBox="0 0 244 142" role="img" aria-label="' + aria + '">' +
      AXES +
      '<text class="glbl" x="36" y="13" text-anchor="middle">' + yLabel + '</text>' +
      xText + body +
    '</svg>',
    caption: caption
  };
}

const GRAPHS = {

  /* ---------- I-V and resistance characteristics ---------- */

  'iv-ohmic': plot(
    'Current against potential difference: a straight line through the origin.',
    'I', 'V',
    '<line class="gcurve" x1="36" y1="116" x2="206" y2="34" />',
    'Straight line through the origin — the gradient is 1/R, so resistance is constant.'),

  'iv-lamp': plot(
    'Current against potential difference for a filament lamp: the curve bends towards the voltage axis.',
    'I', 'V',
    '<path class="gcurve" d="M36,116 Q118,54 206,38" />',
    'Bends towards the V axis: as the filament heats, its resistance rises.'),

  'iv-diode': {
    svg: '<svg viewBox="0 0 244 142" role="img" ' +
      'aria-label="Current against potential difference for a diode: almost no current in reverse bias, then a steep rise past about 0.6 volts.">' +
      '<g class="gax">' +
        '<line x1="104" y1="22" x2="104" y2="120" />' +
        '<line x1="20" y1="76" x2="228" y2="76" />' +
        '<polygon points="100,28 104,19 108,28" />' +
        '<polygon points="222,72 231,76 222,80" />' +
      '</g>' +
      '<text class="glbl" x="104" y="14" text-anchor="middle">I</text>' +
      '<text class="glbl" x="234" y="80" text-anchor="start">V</text>' +
      '<path class="gcurve" d="M26,76 L150,76 C166,76 173,50 179,20" />' +
      '<line class="gguide" x1="150" y1="76" x2="150" y2="94" />' +
      '<text class="gtick" x="150" y="106" text-anchor="middle">≈ 0.6 V</text>' +
      '<text class="gtick" x="26" y="68" text-anchor="start">reverse bias</text>' +
    '</svg>',
    caption: 'Almost no current until the forward threshold, then a steep rise. Reverse bias: very high resistance.'
  },

  'r-temp': plot(
    'Resistance against temperature for a thermistor: a falling curve.',
    'R', 'T',
    '<path class="gcurve" d="M46,32 Q92,112 218,104" />',
    'Resistance falls sharply as the temperature rises.'),

  'r-light': plot(
    'Resistance against light intensity for an LDR: a falling curve.',
    'R', 'light intensity',
    '<path class="gcurve" d="M46,32 Q92,112 218,104" />',
    'Resistance falls as the light gets brighter.'),

  /* ---------- motion graphs ---------- */

  'st-gradient': plot(
    'Displacement against time: the gradient of the line is the velocity.',
    's', 't',
    '<line class="gcurve" x1="36" y1="110" x2="212" y2="32" />' +
    '<path class="gguide" d="M110,77 L180,77 L180,46" />' +
    '<text class="gtick" x="145" y="89" text-anchor="middle">Δt</text>' +
    '<text class="gtick" x="186" y="65" text-anchor="start">Δs</text>',
    'Gradient = Δs / Δt = velocity. On a curve, take the tangent at that instant.'),

  'vt-gradient': plot(
    'Velocity against time: the gradient of the line is the acceleration.',
    'v', 't',
    '<line class="gcurve" x1="36" y1="110" x2="212" y2="32" />' +
    '<path class="gguide" d="M110,77 L180,77 L180,46" />' +
    '<text class="gtick" x="145" y="89" text-anchor="middle">Δt</text>' +
    '<text class="gtick" x="186" y="65" text-anchor="start">Δv</text>',
    'Gradient = Δv / Δt = acceleration. A negative gradient means deceleration.'),

  'vt-area': plot(
    'Velocity against time: the area under the line is the displacement.',
    'v', 't',
    '<polygon class="gfill" points="36,116 36,96 212,40 212,116" />' +
    '<line class="gcurve" x1="36" y1="96" x2="212" y2="40" />' +
    '<text class="gin" x="120" y="100" text-anchor="middle">area = s</text>',
    'Area under the graph = displacement. Area below the time axis counts as negative.'),

  'at-area': plot(
    'Acceleration against time: the area under the line is the change in velocity.',
    'a', 't',
    '<rect class="gfill" x="36" y="58" width="140" height="58" />' +
    '<line class="gcurve" x1="36" y1="58" x2="176" y2="58" />' +
    '<text class="gin" x="106" y="94" text-anchor="middle">area = Δv</text>',
    'Area under the graph = change in velocity, since Δv = a × Δt.'),

  'vt-terminal': plot(
    'Velocity against time for a falling object: the curve levels off at the terminal velocity.',
    'v', 't',
    '<line class="gguide" x1="36" y1="42" x2="214" y2="42" />' +
    '<path class="gcurve" d="M36,116 C74,58 116,44 214,42" />' +
    '<text class="gtick" x="214" y="35" text-anchor="end">terminal velocity</text>',
    'The gradient falls to zero as drag grows to equal the weight.'),

  /* ---------- areas that mean something ---------- */

  'ft-area': plot(
    'Force against time during a collision: the area under the curve is the impulse.',
    'F', 't',
    '<path class="gfill" d="M36,116 C76,26 148,26 190,116 Z" />' +
    '<path class="gcurve" d="M36,116 C76,26 148,26 190,116" />' +
    '<text class="gin" x="113" y="98" text-anchor="middle">area = impulse</text>',
    'Area under the graph = impulse = change in momentum, even when the force varies.'),

  'fx-work': plot(
    'Force against distance: the area under the line is the work done.',
    'F', 'x',
    '<polygon class="gfill" points="36,116 36,40 200,96 200,116" />' +
    '<line class="gcurve" x1="36" y1="40" x2="200" y2="96" />' +
    '<text class="gin" x="112" y="104" text-anchor="middle">area = W</text>',
    'Area under the graph = work done, which is how a varying force is handled.'),

  'pv-work': plot(
    'Pressure against volume at constant pressure: the shaded rectangle is the work done.',
    'p', 'V',
    '<rect class="gfill" x="76" y="54" width="110" height="62" />' +
    '<line class="gcurve" x1="76" y1="54" x2="186" y2="54" />' +
    '<line class="gguide" x1="76" y1="54" x2="76" y2="116" />' +
    '<line class="gguide" x1="186" y1="54" x2="186" y2="116" />' +
    '<text class="gtick" x="76" y="128" text-anchor="middle">V₁</text>' +
    '<text class="gtick" x="186" y="128" text-anchor="middle">V₂</text>' +
    '<text class="gin" x="131" y="92" text-anchor="middle">W = pΔV</text>',
    'Area under the graph = work done by the gas as it expands at constant pressure.'),

  /* ---------- deformation ---------- */

  'hooke': plot(
    'Force against extension: a straight line through the origin.',
    'F', 'x',
    '<line class="gcurve" x1="36" y1="116" x2="200" y2="36" />',
    'F ∝ x, so the gradient is the force constant k.'),

  'fx-limit': plot(
    'Force against extension: the line is straight up to the limit of proportionality, then curves away.',
    'F', 'x',
    '<path class="gcurve" d="M36,116 L140,62 Q176,44 210,40" />' +
    '<line class="gguide" x1="140" y1="62" x2="140" y2="116" />' +
    '<circle class="gdot" cx="140" cy="62" r="3.4" />' +
    '<text class="gtick" x="131" y="55" text-anchor="end">P</text>',
    'P is the limit of proportionality — past it the graph is no longer a straight line.'),

  'fx-strain-energy': plot(
    'Force against extension: the triangle under the line is the elastic potential energy stored.',
    'F', 'x',
    '<polygon class="gfill" points="36,116 190,42 190,116" />' +
    '<line class="gcurve" x1="36" y1="116" x2="190" y2="42" />' +
    '<text class="gin" x="141" y="102" text-anchor="middle">½Fx</text>',
    'Area under the graph = work done stretching = elastic potential energy stored.'),

  'stress-strain': plot(
    'Stress against strain: a straight line whose gradient is the Young modulus.',
    'σ', 'ε',
    '<line class="gcurve" x1="36" y1="116" x2="200" y2="36" />',
    'The gradient of the straight portion is the Young modulus E.'),

  'stress-uts': plot(
    'Stress against strain: the curve rises to a peak, the ultimate tensile stress, then the material breaks.',
    'σ', 'ε',
    '<line class="gguide" x1="36" y1="35" x2="150" y2="35" />' +
    '<path class="gcurve" d="M36,116 L120,52 Q150,26 176,36 L194,56" />' +
    '<path class="gbreak" d="M189,51 L199,61 M199,51 L189,61" />' +
    '<text class="gtick" x="40" y="30" text-anchor="start">UTS</text>',
    'The peak of the curve is the ultimate tensile stress; the cross marks the break.'),

  /* ---------- stationary waves (pictures, not plots) ---------- */

  'stationary-wave': {
    svg: '<svg viewBox="0 0 244 134" role="img" ' +
      'aria-label="A stationary wave showing fixed nodes of zero amplitude and antinodes of maximum amplitude, with adjacent nodes half a wavelength apart.">' +
      '<line class="gguide" x1="30" y1="74" x2="210" y2="74" />' +
      '<path class="gcurve" d="M30,74 q22.5,-36 45,0 q22.5,36 45,0 q22.5,-36 45,0 q22.5,36 45,0" />' +
      '<path class="gmirror" d="M30,74 q22.5,36 45,0 q22.5,-36 45,0 q22.5,36 45,0 q22.5,-36 45,0" />' +
      '<circle class="gdot" cx="30" cy="74" r="3.2" /><circle class="gdot" cx="75" cy="74" r="3.2" />' +
      '<circle class="gdot" cx="120" cy="74" r="3.2" /><circle class="gdot" cx="165" cy="74" r="3.2" />' +
      '<circle class="gdot" cx="210" cy="74" r="3.2" />' +
      '<text class="gtick" x="30" y="128" text-anchor="middle">N</text>' +
      '<text class="gtick" x="75" y="128" text-anchor="middle">N</text>' +
      '<text class="gtick" x="120" y="128" text-anchor="middle">N</text>' +
      '<text class="gtick" x="165" y="128" text-anchor="middle">N</text>' +
      '<text class="gtick" x="210" y="128" text-anchor="middle">N</text>' +
      '<text class="gin" x="52" y="30" text-anchor="middle">A</text>' +
      '<text class="gin" x="97" y="30" text-anchor="middle">A</text>' +
      '<text class="gin" x="142" y="30" text-anchor="middle">A</text>' +
      '<text class="gin" x="187" y="30" text-anchor="middle">A</text>' +
      '<g class="gdim"><line x1="30" y1="112" x2="75" y2="112" />' +
        '<polygon points="30,112 37,109 37,115" /><polygon points="75,112 68,109 68,115" /></g>' +
      '<text class="gin" x="52" y="106" text-anchor="middle">λ/2</text>' +
    '</svg>',
    caption: 'N = node, always zero. A = antinode, maximum amplitude. Adjacent nodes are λ/2 apart.'
  },

  'string-fundamental': {
    svg: '<svg viewBox="0 0 244 146" role="img" ' +
      'aria-label="The fundamental mode on a string fixed at both ends: a node at each end and one antinode in the middle, so the length is half a wavelength.">' +
      '<line class="gend" x1="44" y1="34" x2="44" y2="106" />' +
      '<line class="gend" x1="204" y1="34" x2="204" y2="106" />' +
      '<line class="gguide" x1="44" y1="70" x2="204" y2="70" />' +
      '<path class="gcurve" d="M44,70 q80,-42 160,0" />' +
      '<path class="gmirror" d="M44,70 q80,42 160,0" />' +
      '<circle class="gdot" cx="44" cy="70" r="3.2" /><circle class="gdot" cx="204" cy="70" r="3.2" />' +
      '<text class="gtick" x="36" y="74" text-anchor="end">N</text>' +
      '<text class="gtick" x="212" y="74" text-anchor="start">N</text>' +
      '<text class="gin" x="124" y="24" text-anchor="middle">A</text>' +
      '<g class="gdim"><line x1="44" y1="124" x2="204" y2="124" />' +
        '<polygon points="44,124 51,121 51,127" /><polygon points="204,124 197,121 197,127" /></g>' +
      '<text class="gtick" x="124" y="140" text-anchor="middle">L</text>' +
    '</svg>',
    caption: 'Node at each fixed end, one antinode in the middle: L = λ/2, so λ = 2L.'
  },

  'pipe-closed': {
    svg: '<svg viewBox="0 0 244 138" role="img" ' +
      'aria-label="The fundamental mode in a pipe closed at one end: a node at the closed end and an antinode at the open end, so the length is a quarter of a wavelength.">' +
      '<g class="gwall"><line x1="44" y1="30" x2="210" y2="30" /><line x1="44" y1="110" x2="210" y2="110" /></g>' +
      '<line class="gend" x1="44" y1="30" x2="44" y2="110" />' +
      '<line class="gguide" x1="44" y1="70" x2="206" y2="70" />' +
      '<path class="gcurve" d="M44,70 C110,68 168,60 206,38" />' +
      '<path class="gmirror" d="M44,70 C110,72 168,80 206,102" />' +
      '<circle class="gdot" cx="44" cy="70" r="3.2" />' +
      '<text class="gtick" x="36" y="74" text-anchor="end">N</text>' +
      '<text class="gin" x="216" y="74" text-anchor="start">A</text>' +
      '<text class="gtick" x="48" y="126" text-anchor="start">closed</text>' +
      '<text class="gtick" x="206" y="126" text-anchor="end">open</text>' +
    '</svg>',
    caption: 'Node at the closed end, antinode at the open end: L = λ/4, so λ = 4L. Odd harmonics only.'
  },

  /* ---------- circuits ---------- */

  'emf-internal': plot(
    'Terminal potential difference against current: a falling straight line whose intercept is the e.m.f. and whose gradient is minus the internal resistance.',
    'V', 'I',
    '<line class="gcurve" x1="36" y1="40" x2="204" y2="98" />' +
    '<circle class="gdot" cx="36" cy="40" r="3.4" />' +
    '<text class="gtick" x="44" y="36" text-anchor="start">E</text>',
    'Intercept on the V axis = e.m.f. Gradient = −r, the internal resistance.')
};
