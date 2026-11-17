// Holes. Units are meters, top-down, x to the right and y down.
// outline: the fairway edge, clockwise. Walls are built along it.
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export const COURSES = [
  {
    id: 'garden',
    thumb: 4,
    name: 'Garden Green',
    theme: 'garden',
    blurb: 'banks, bumpers, sand, water, a windmill',
    holes: [
      {
        name: 'First Putt', par: 2,
        outline: rect(0, 3, 18, 9), tee: [2.5, 6], cup: [15.5, 6],
        tip: 'Drag back from the ball, then let go to putt. A longer pull hits harder.',
      },
      {
        name: 'Dogleg', par: 3,
        outline: [[9, 0], [14, 0], [14, 12], [0, 12], [0, 7], [9, 7]], tee: [2, 9.5], cup: [11.5, 2.5],
        tip: 'Bounce off a wall to get around the corner.',
      },
      {
        name: 'Bumper Bounce', par: 3,
        outline: rect(0, 1, 20, 11), tee: [2, 6], cup: [18, 6],
        bumpers: [[8, 4, 0.7], [8, 8, 0.7], [11.5, 6, 0.8], [15, 3.4, 0.6], [15, 8.6, 0.6]],
        tip: 'Jelly bumpers kick the ball away. Use them!',
      },
      {
        name: 'Sand Trap', par: 3,
        outline: rect(0, 0, 20, 11), tee: [2, 5.5], cup: [17.5, 5.5],
        sand: [rect(7, 1.8, 13, 9.2)],
        tip: 'Sand slows the ball down a lot. Go around it.',
      },
      {
        name: 'Windmill', par: 3,
        outline: rect(0, 0, 20, 10), tee: [2.5, 7.5], cup: [17.5, 2.5],
        walls: [[0, 5, 8.9, 5], [11.1, 5, 20, 5]],
        blocks: [[8.9, 3.4, 9.5, 6.6], [10.5, 3.4, 11.1, 6.6]],
        movers: [{ type: 'windmill', x: 10, face: 6.6, hubZ: 2.1, len: 2.0, arms: 4, speed: 1.1, width: 0.75, house: [8.9, 3.4, 11.1, 6.6], tunnel: [9.5, 10.5] }],
        tip: 'Putt through the windmill when the sails are up.',
      },
      {
        name: 'Splash', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [17, 9],
        water: [rect(6.5, 0, 13.5, 5), rect(6.5, 7, 13.5, 12)],
        tip: 'Water costs one stroke. Stay on the bridge!',
      },
      {
        name: 'Slippery Slope', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 9.5], cup: [17.5, 2.6],
        slopes: [{ poly: rect(6, 0, 14, 12), dir: [0, 1], k: 2.4 }],
        ice: [rect(14, 0, 20, 5)],
        tip: 'The hill pulls the ball down. Aim high!',
      },
      {
        name: 'Zig Zag', par: 4,
        outline: rect(0, 0, 20, 12), tee: [3, 3], cup: [17.5, 9.5],
        walls: [[6.5, 0, 6.5, 8.2], [13.5, 12, 13.5, 3.8]],
      },
      {
        name: 'The Gauntlet', par: 4,
        outline: rect(0, 0, 22, 12), tee: [2, 6], cup: [20, 6],
        movers: [{ type: 'slider', x: 7, y: 6, w: 0.5, h: 3.2, ax: 0, ay: 1, amp: 3.4, period: 3.4 }],
        bumpers: [[11.5, 3.5, 0.6], [11.5, 8.5, 0.6], [13, 6, 0.7]],
        water: [rect(15.5, 0, 17.5, 4.6), rect(15.5, 7.4, 17.5, 12)],
        tip: 'The last hole! Watch the moving wall.',
      },
    ],
  },
  {
    id: 'beach',
    thumb: 8,
    name: 'Sunny Beach',
    theme: 'beach',
    blurb: 'sand, sea, beach balls, boost pads',
    holes: [
      {
        name: 'Sandy Start', par: 2,
        outline: rect(0, 3, 18, 9), tee: [2.5, 6], cup: [15.5, 6],
        sand: [rect(7, 3, 11, 4.6), rect(7, 7.4, 11, 9)],
        tip: 'Welcome to the beach! Sand slows the ball down.',
      },
      {
        name: 'Boost Lane', par: 2,
        outline: [[0, 7], [14, 7], [14, 0], [20, 0], [20, 12], [0, 12]], tee: [2.5, 9.5], cup: [17, 2.5],
        boosts: [[17, 9.5, -90]],
        tip: 'Boost pads shoot the ball the way the arrows point.',
      },
      {
        name: 'Dune Ridge', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [18, 6],
        slopes: [{ poly: rect(6, 0, 10, 12), dir: [0, 1], k: 2.0 }, { poly: rect(10, 0, 14, 12), dir: [0, -1], k: 2.0 }],
        sand: [rect(15.5, 0, 20, 2.5), rect(15.5, 9.5, 20, 12)],
      },
      {
        name: 'Beach Ball Bash', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [18.5, 6],
        bumpers: [[7, 3.5, 0.75], [7, 8.5, 0.75], [10.5, 6, 0.9], [14, 3, 0.7], [14, 9, 0.7], [16.3, 6, 0.6]],
      },
      {
        name: 'Tide Pools', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [18, 6],
        water: [rect(5, 0, 9, 4.5), rect(5, 7.5, 9, 12), rect(12, 3, 15.5, 9)],
        boosts: [[10.6, 1.5, 0], [10.6, 10.5, 0]],
      },
      {
        name: 'Sandcastle', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [15.5, 6],
        blocks: [[12, 3, 12.6, 5.2], [12, 6.8, 12.6, 9], [12.6, 3, 18, 3.6], [12.6, 8.4, 18, 9], [17.4, 3.6, 18, 8.4]],
        bumpers: [[8, 6, 0.6]],
        tip: 'Find the castle gate.',
      },
      {
        name: "Surf's Up", par: 3,
        outline: rect(0, 0, 22, 12), tee: [2, 6], cup: [19, 6],
        walls: [[11, 0, 11, 4.5], [11, 7.5, 11, 12]],
        movers: [{ type: 'slider', x: 11, y: 6, w: 0.5, h: 2.2, ax: 0, ay: 1, amp: 3, period: 3 }],
        sand: [rect(16, 0, 22, 2.6), rect(16, 9.4, 22, 12)],
      },
      {
        name: 'Boardwalk', par: 4,
        outline: [[0, 0], [12, 0], [20, 6], [20, 12], [8, 12], [0, 6]], tee: [2.5, 2.5], cup: [17, 9.5],
        walls: [[5, 0, 5, 7.5], [13, 12, 13, 4.5]],
        boosts: [[9, 7, -90]],
      },
      {
        name: 'Lighthouse', par: 4,
        outline: rect(0, 0, 22, 12), tee: [2, 6], cup: [19.5, 6],
        posts: [[11, 6, 1.1]],
        bumpers: [[7.5, 2.6, 0.6], [7.5, 9.4, 0.6], [14.5, 2.6, 0.6], [14.5, 9.4, 0.6]],
        water: [rect(17, 0, 22, 3.4), rect(17, 8.6, 22, 12)],
        tip: 'The last beach hole. Go round the lighthouse!',
      },
    ],
  },
  {
    id: 'candy',
    thumb: 4,
    name: 'Candy Factory',
    theme: 'candy',
    blurb: 'conveyor belts, portals, spinners, chocolate',
    holes: [
      {
        name: 'Sweet Start', par: 2,
        outline: rect(0, 3, 18, 9), tee: [2.5, 6], cup: [15.5, 6],
        belts: [{ poly: rect(7, 3, 10, 9), dir: [0, 1], speed: 1.6 }],
        tip: 'Conveyor belts carry the ball along.',
      },
      {
        name: 'Belt Bend', par: 3,
        outline: [[0, 0], [6, 0], [6, 7], [20, 7], [20, 12], [0, 12]], tee: [3, 2.5], cup: [17.5, 9.5],
        belts: [{ poly: rect(0, 3.5, 6, 8.5), dir: [0, 1], speed: 2.2 }, { poly: rect(8, 7, 15, 12), dir: [1, 0], speed: 2.2 }],
      },
      {
        name: 'Gumdrop Drop', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [17.5, 6],
        bumpers: [[8, 6, 0.7], [10.2, 3.8, 0.7], [10.2, 8.2, 0.7], [12.4, 1.8, 0.6], [12.4, 6, 0.7], [12.4, 10.2, 0.6]],
      },
      {
        name: 'Warp Wrapper', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [17, 8.5],
        walls: [[10, 0, 10, 12]],
        portals: [[6, 6, 14, 3.5]],
        tip: 'Roll into a portal to pop out of its twin, going the same way.',
      },
      {
        name: 'Choco River', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [17, 9],
        water: [rect(8, 0, 11, 12)],
        belts: [{ poly: rect(7.5, 5, 11.5, 7), dir: [1, 0], speed: 2.0 }],
        tip: 'Ride the belt bridge over the chocolate.',
      },
      {
        name: 'Lollipop Spinner', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [17.5, 6],
        movers: [{ type: 'spinner', x: 10, y: 6, len: 4.2, speed: 1.3 }],
        posts: [[5, 2.5, 0.25], [5, 9.5, 0.25], [15, 2.5, 0.25], [15, 9.5, 0.25]],
        tip: 'Time your putt past the spinner.',
      },
      {
        name: 'Sprinkle Maze', par: 4,
        outline: rect(0, 0, 20, 12), tee: [2.5, 2.5], cup: [17.5, 2.5],
        walls: [[5, 0, 5, 8], [10, 4, 10, 12], [15, 0, 15, 8]],
        portals: [[2.5, 10, 17.5, 10]],
      },
      {
        name: 'Taffy Twister', par: 3,
        outline: rect(0, 0, 22, 12), tee: [2, 6], cup: [19.5, 6],
        movers: [{ type: 'spinner', x: 8, y: 6, len: 4, speed: 1.2 }, { type: 'spinner', x: 14, y: 6, len: 4, speed: -1.4, phase: 0.8 }],
        belts: [{ poly: rect(6, 0, 16, 2.6), dir: [-1, 0], speed: 1.5 }],
      },
      {
        name: 'The Factory', par: 4,
        outline: rect(0, 0, 22, 12), tee: [2, 9.5], cup: [19.5, 2.5],
        water: [rect(8, 0, 14, 7)],
        belts: [{ poly: rect(5, 8, 16, 12), dir: [1, 0], speed: 2.2 }],
        movers: [{ type: 'spinner', x: 18, y: 7.5, len: 3.6, speed: 1.4 }],
        tip: 'The last candy hole. Watch out for the chocolate lake!',
      },
    ],
  },
  {
    id: 'frost',
    thumb: 8,
    name: 'Frosty Peak',
    theme: 'frost',
    blurb: 'ice, snow drifts, snowmen, the summit',
    holes: [
      {
        name: 'First Frost', par: 2,
        outline: rect(0, 3, 18, 9), tee: [2.5, 6], cup: [15.5, 6],
        ice: [rect(6, 3, 12, 9)],
        tip: 'Ice is slippery: the ball slides a long way.',
      },
      {
        name: 'Ice Rink', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [18, 6],
        ice: [rect(4, 0, 16, 12)],
        bumpers: [[7, 3, 0.6], [7, 9, 0.6], [13, 6, 0.7]],
      },
      {
        name: 'Snow Drift', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 10], cup: [18, 2],
        sand: [rect(6, 0, 8.5, 8), rect(11.5, 4, 14, 12)],
        tip: 'Deep snow slows the ball, like sand.',
      },
      {
        name: 'Slalom', par: 3,
        outline: rect(0, 0, 22, 10), tee: [2, 5], cup: [19.5, 5],
        posts: [[6, 3, 0.45], [9.5, 7, 0.45], [13, 3, 0.45], [16.5, 7, 0.45]],
        ice: [rect(4, 0, 18, 10)],
      },
      {
        name: 'Avalanche', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 9.5], cup: [18, 2.5],
        slopes: [{ poly: rect(5, 0, 15, 12), dir: [0, 1], k: 2.8 }],
        water: [rect(6, 10.2, 14, 12)],
      },
      {
        name: 'Ice Cave', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 2.5], cup: [17.5, 2.5],
        blocks: [[9, 0, 11, 9]],
        portals: [[5.5, 4, 14.5, 9.5]],
      },
      {
        name: 'Frozen Pond', par: 3,
        outline: rect(0, 0, 20, 12), tee: [2, 6], cup: [18, 6],
        water: [rect(7.5, 3.5, 12.5, 8.5)],
        ice: [rect(5, 1, 15, 11)],
      },
      {
        name: 'Snowplow', par: 4,
        outline: rect(0, 0, 22, 12), tee: [2, 6], cup: [19.5, 6],
        movers: [{ type: 'slider', x: 8, y: 6, w: 0.6, h: 4, ax: 0, ay: 1, amp: 6, period: 4 }, { type: 'spinner', x: 15, y: 6, len: 4, speed: 1.2 }],
        sand: [rect(10, 0, 12, 3), rect(10, 9, 12, 12)],
      },
      {
        name: 'The Summit', par: 4,
        outline: [[0, 4], [6, 0], [16, 0], [22, 4], [22, 12], [0, 12]], tee: [2, 10], cup: [11, 2.5],
        slopes: [{ poly: rect(4, 5, 18, 9), dir: [0, 1], k: 2.2 }],
        boosts: [[11, 10.2, -90]],
        bumpers: [[5, 7, 0.6], [17, 7, 0.6]],
        tip: 'The very last hole. Climb to the summit!',
      },
    ],
  },
];

export function bounds(hole) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of hole.outline) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
