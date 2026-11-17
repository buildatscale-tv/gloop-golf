// Colors and styles for each course theme.
// rail/block/slider/spin: [top light, top dark, side]. *Deco: how a solid is decorated.
export const THEMES = {
  garden: {
    bg: ['#5cae3f', '#3f8a2c'], felt: ['#86e05c', '#76d24d'], edge: 'rgba(20,70,10,0.28)',
    rail: ['#ffe2b3', '#e6a865', '#9a6234'], railDeco: 'wood',
    block: ['#fff1d8', '#f2c88f', '#b9824a'], blockDeco: null,
    roof: ['#ff7466', '#d8443a'], base: ['#8a5a32', '#5e3a1e'],
    bumper: ['#ffd0ea', '#ff63b4', '#b0186a'], bumperStyle: 'jelly',
    slider: ['#fff4b0', '#ffc21a', '#b07a00'], spin: ['#fff4b0', '#ffc21a', '#b07a00'], spinDeco: 'stripes',
    post: 'stone', tee: '#3f9a3a',
    water: ['#6fd2ff', '#2a7fd0'], pads: 'lily',
    sand: { fill: '#f6e0a2', dots: ['rgba(170,120,50,0.35)', 'rgba(255,255,255,0.5)'], rake: 'rgba(190,150,80,0.35)', edge: '#ddb96a' },
    bush: ['#4fae3a', '#2f7d24'], flowers: ['#ffffff', '#ffe36b', '#ff8ac8', '#9fd8ff'],
    decor: 'garden',
  },
  beach: {
    bg: ['#f8e4b4', '#ecca86'], felt: ['#4fd8b8', '#45cbab'], edge: 'rgba(10,80,70,0.28)',
    rail: ['#fbf3e4', '#e3d2b2', '#9c8565'], railDeco: 'drift',
    block: ['#fbe3a8', '#efc977', '#c99a4a'], blockDeco: 'castle',
    roof: ['#ff7466', '#d8443a'], base: ['#c9a670', '#a07d48'],
    bumper: ['#ffffff', '#ff4d4d', '#c22a2a'], bumperStyle: 'beachball',
    slider: ['#ffffff', '#4fc3ff', '#1d7fc0'], spin: ['#ffffff', '#4fc3ff', '#1d7fc0'], spinDeco: 'stripes',
    post: 'lighthouse', tee: '#2fb39a',
    water: ['#6fe0ff', '#1d8fd6'], pads: 'foam',
    sand: { fill: '#f9e3a8', dots: ['rgba(170,120,50,0.35)', 'rgba(255,255,255,0.6)'], rake: 'rgba(200,160,90,0.35)', edge: '#e2be72' },
    decor: 'beach',
  },
  candy: {
    bg: ['#ffd3ea', '#f6a8d3'], felt: ['#a6f0d3', '#96e6c5'], edge: 'rgba(30,110,80,0.25)',
    rail: ['#ffffff', '#ffe8ee', '#e9b7c4'], railDeco: 'cane',
    block: ['#8a5230', '#6e3d20', '#4a2410'], blockDeco: 'choc',
    roof: ['#ff7466', '#d8443a'], base: ['#ef78b3', '#c84b8d'],
    bumper: ['#ffe0ee', '#ff5c8a', '#c22d5e'], bumperStyle: 'gumdrop',
    gumdrops: [['#ffc2d6', '#ff5c8a', '#c22d5e'], ['#fff1a8', '#ffcf24', '#c99400'], ['#c8ffe4', '#3fd99a', '#1d9a66'], ['#ddd6ff', '#8a7dff', '#5243c9'], ['#ffe0c2', '#ff9a3c', '#c86412']],
    slider: ['#fff4b0', '#ff7ac0', '#b0186a'], spin: ['#ffffff', '#ffe8ee', '#e9b7c4'], spinDeco: 'cane',
    post: 'lollipop', tee: '#ff9ccc',
    water: ['#a8683a', '#5e3215'], pads: 'marsh',
    sand: { fill: '#fff2f8', dots: ['rgba(255,110,170,0.6)', 'rgba(90,190,255,0.6)', 'rgba(255,210,60,0.7)'], rake: 'rgba(240,170,200,0.35)', edge: '#f5c0da' },
    decor: 'candy',
  },
  frost: {
    bg: ['#f4faff', '#d4e7f6'], felt: ['#4fb3d9', '#46a8cf'], edge: 'rgba(10,60,100,0.28)',
    rail: ['#ffffff', '#e6f2ff', '#7a5636'], railDeco: 'snow',
    block: ['#effbff', '#c4ebff', '#8ccbee'], blockDeco: 'ice',
    roof: ['#ff7466', '#d8443a'], base: ['#6d4a2e', '#4f3420'],
    bumper: ['#ffffff', '#e2f0ff', '#9cc4e8'], bumperStyle: 'snowball',
    slider: ['#ffe36b', '#ffb31a', '#a86a00'], spin: ['#ffffff', '#e6f2ff', '#7a5636'], spinDeco: 'snow',
    post: 'snowman', tee: '#3d8fb8',
    water: ['#5fb8e8', '#1f6fb0'], pads: 'floe',
    sand: { fill: '#ffffff', dots: ['rgba(120,170,220,0.4)', 'rgba(200,230,255,0.9)'], rake: 'rgba(150,190,230,0.45)', edge: '#cfe5f7' },
    decor: 'frost',
  },
};

// Portal pair colors.
export const PORTAL_COLORS = [['#dcc0ff', '#8a4dff'], ['#b8f6ff', '#1fb6e8'], ['#ffc4ee', '#e83cb0']];
