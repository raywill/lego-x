import type { BrickDefinition, GeometryDefinition } from '../../types/model';

function kindOf(geometry: GeometryDefinition): GeometryDefinition['kind'] {
  return geometry.kind;
}

interface IsometricBrickArt {
  top: string;
  front: string;
  side: string;
  highlight: string;
  studs: Array<readonly [number, number]>;
}

const CORE_BLOCK_ART: Record<string, IsometricBrickArt> = {
  'mini-cube': {
    top: 'M29 29 39 23 53 30 42 37Z',
    front: 'M29 29 42 37 42 46 29 38Z',
    side: 'M42 37 53 30 53 39 42 46Z',
    highlight: 'M39 23 53 30',
    studs: [[41, 30]],
  },
  'cube-1': {
    top: 'M25 26 39 17 58 26 43 35Z',
    front: 'M25 26 43 35 43 51 25 42Z',
    side: 'M43 35 58 26 58 42 43 51Z',
    highlight: 'M39 17 58 26',
    studs: [[42, 26]],
  },
  'block-1x2': {
    top: 'M12 29 31 17 71 29 51 41Z',
    front: 'M12 29 51 41 51 54 12 42Z',
    side: 'M51 41 71 29 71 42 51 54Z',
    highlight: 'M31 17 71 29',
    studs: [[35, 25], [50, 30]],
  },
  'block-2x2': {
    top: 'M10 30 36 14 73 31 46 47Z',
    front: 'M10 30 46 47 46 57 10 40Z',
    side: 'M46 47 73 31 73 41 46 57Z',
    highlight: 'M36 14 73 31',
    studs: [[35, 23], [48, 29], [27, 31], [40, 37]],
  },
  'block-2x4': {
    top: 'M4 28 25 14 80 30 57 45Z',
    front: 'M4 28 57 45 57 57 4 40Z',
    side: 'M57 45 80 30 80 42 57 57Z',
    highlight: 'M25 14 80 30',
    studs: [[29, 21], [40, 24], [51, 27], [62, 30], [21, 28], [32, 31], [43, 34], [54, 37]],
  },
  'plate-1x1': {
    top: 'M25 27 39 18 58 27 43 36Z',
    front: 'M25 27 43 36 43 43 25 34Z',
    side: 'M43 36 58 27 58 34 43 43Z',
    highlight: 'M39 18 58 27',
    studs: [[42, 27]],
  },
  'plate-3x3': {
    top: 'M8 31 33 15 76 31 48 48Z',
    front: 'M8 31 48 48 48 56 8 39Z',
    side: 'M48 48 76 31 76 39 48 56Z',
    highlight: 'M33 15 76 31',
    studs: [[31, 24], [42, 28], [53, 32], [25, 29], [36, 33], [47, 37], [19, 34], [30, 38], [41, 42]],
  },
};

function CoreBlockGlyph({ art, color, dark }: { art: IsometricBrickArt; color: string; dark: string }) {
  return (
    <svg viewBox="0 0 84 62" aria-hidden="true">
      <path d={art.front} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      <path d={art.front} fill={dark} fillOpacity=".08" />
      <path d={art.side} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      <path d={art.side} fill={dark} fillOpacity=".15" />
      <path d={art.top} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      {art.studs.map(([cx, cy], index) => (
        <ellipse key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} rx="3.7" ry="2.15" fill="#fff" fillOpacity=".5" stroke={dark} strokeWidth="1.3" />
      ))}
      <path d={art.highlight} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function TriangleFamilyGlyph({ id, color, dark }: { id: string; color: string; dark: string }) {
  if (id === 'triangle-prism') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M12 49 24 39 49 8 37 18Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M37 18 49 8 74 39 62 49Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M37 18 49 8 74 39 62 49Z" fill={dark} fillOpacity=".12" />
        <path d="M12 49 37 18 62 49Z" fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
        <path d="M37 18 49 8" fill="none" stroke="#fff" strokeOpacity=".62" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === 'right-triangle-prism') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M13 48 23 41 72 9 62 16Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M62 16 72 9 72 41 62 48Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M62 16 72 9 72 41 62 48Z" fill={dark} fillOpacity=".14" />
        <path d="M13 48 62 16 62 48Z" fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
        <path d="M13 48 62 16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 84 62" aria-hidden="true">
      <path d="M9 48 20 39 76 21 66 29Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M66 29 76 21 76 39 66 48Z" fill={color} stroke={dark} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M66 29 76 21 76 39 66 48Z" fill={dark} fillOpacity=".14" />
      <path d="M9 48 66 29 66 48Z" fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      <path d="M9 48 66 29" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function BrickGlyph({ definition }: { definition: BrickDefinition }) {
  const kind = kindOf(definition.geometry);
  const color = definition.color;
  const dark = '#34304f';
  const isWheel = definition.id.includes('wheel');
  const isLargeWheel = definition.id === 'wheel-large';
  const isHandle = definition.id.includes('handle');

  const coreBlockArt = CORE_BLOCK_ART[definition.id];
  if (coreBlockArt) {
    return <CoreBlockGlyph art={coreBlockArt} color={color} dark={dark} />;
  }

  if (isWheel || isHandle || kind === 'torus' || kind === 'tube') {
    const outerRadius = isLargeWheel ? 28 : isWheel ? 19 : 20;
    const outerRadiusY = isLargeWheel ? 28 : isWheel ? 20 : 21;
    const hubRadius = isLargeWheel ? 10 : isWheel ? 7 : 12;
    const spokeReach = isLargeWheel ? 20 : 13;
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <ellipse cx="42" cy="31" rx={outerRadius} ry={outerRadiusY} fill={color} stroke={dark} strokeWidth={isLargeWheel ? 2.6 : 2.3} />
        <ellipse cx="42" cy="31" rx={hubRadius} ry={hubRadius} fill="#f8f9ff" stroke={dark} strokeWidth="2.3" />
        {isWheel && <>
          <path d={`M42 ${31 - spokeReach}V${31 + spokeReach}M${42 - spokeReach} 31H${42 + spokeReach}`} stroke={dark} strokeWidth={isLargeWheel ? 3.6 : 3} strokeLinecap="round" />
          <circle cx="42" cy="31" r={isLargeWheel ? 5 : 3.6} fill="#fff" stroke={dark} strokeWidth="2" />
        </>}
      </svg>
    );
  }

  if (definition.geometry.kind === 'frame') {
    const opening = definition.geometry.opening;
    const openingShape = opening === 'circle'
      ? <circle cx="42" cy="31" r="14" fill="#f8f9ff" stroke={dark} strokeWidth="2.2" />
      : opening === 'arch'
        ? <path d="M29 47V31a13 13 0 0 1 26 0v16Z" fill="#f8f9ff" stroke={dark} strokeWidth="2.2" />
        : <rect x="27" y="18" width="30" height="27" fill="#f8f9ff" stroke={dark} strokeWidth="2.2" />;
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M15 8h54v46H15Z" fill={color} stroke={dark} strokeWidth="2.5" strokeLinejoin="round" />
        {openingShape}
        <path d="M20 13h44" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'concaveArcBlock') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M13 11h58v39H45a26 26 0 0 0-26-26h-6Z" fill={color} stroke={dark} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M19 24a26 26 0 0 1 26 26" fill="none" stroke="#f8f9ff" strokeWidth="3" />
        <path d="M19 16h43" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'sphereOctantCutout') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M13 13h58v38H13Z" fill={color} stroke={dark} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M71 13v25A25 25 0 0 1 46 13Z" fill="#f8f9ff" stroke={dark} strokeWidth="2.2" />
        <path d="M48 14c11 2 18 9 22 20" fill="none" stroke="#d8dcef" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'quarterCylinder') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M13 48h55V16a32 32 0 0 0-32 32Z" fill={color} stroke={dark} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M37 43a27 27 0 0 1 26-26" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'sphere' || kind === 'hemisphere') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        {kind === 'sphere' ? <circle cx="42" cy="31" r="22" fill={color} stroke={dark} strokeWidth="2.3" /> : <path d="M18 39a24 24 0 0 1 48 0Z" fill={color} stroke={dark} strokeWidth="2.3" />}
        <path d="M31 18c5-5 13-6 19-2" fill="none" stroke="#fff" strokeOpacity=".62" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (definition.id === 'rod') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M36 8h12l3 45-9 5-9-5Z" fill={color} stroke={dark} strokeWidth="2.3" />
        <ellipse cx="42" cy="9" rx="6" ry="3" fill="#fff" fillOpacity=".5" stroke={dark} strokeWidth="1.8" />
      </svg>
    );
  }

  if (definition.id === 'axle') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="m18 45 45-30 6 8-45 30Z" fill={color} stroke={dark} strokeWidth="2.3" />
        <ellipse cx="66" cy="19" rx="5" ry="4" transform="rotate(-34 66 19)" fill="#fff" fillOpacity=".55" stroke={dark} strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === 'cone') {
    const large = definition.id === 'cone-2';
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path
          d={large ? 'M42 7 68 47H16Z' : 'M42 13 61 46H23Z'}
          fill={color}
          stroke={dark}
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <ellipse
          cx="42"
          cy={large ? 47 : 46}
          rx={large ? 26 : 19}
          ry={large ? 7 : 5.5}
          fill={color}
          stroke={dark}
          strokeWidth="2.3"
        />
        <path d={large ? 'M39 13 25 39' : 'M39 18 30 38'} fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'cylinder') {
    const thin = definition.size[1] <= 5;
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d={thin ? 'M20 27v9c0 7 44 7 44 0v-9' : 'M25 17v27c0 9 34 9 34 0V17'} fill={color} stroke={dark} strokeWidth="2.3" />
        <ellipse cx="42" cy={thin ? 27 : 17} rx={thin ? 22 : 17} ry="8" fill={color} stroke={dark} strokeWidth="2.3" />
        <path d={thin ? 'M27 24c8-4 22-4 30 0' : 'M31 15c6-3 16-3 22 0'} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'triangularPrism' || kind === 'wedge' || kind === 'doubleWedge' || kind === 'trapezoidPrism') {
    if (definition.id === 'triangle-prism' || definition.id === 'right-triangle-prism' || definition.id === 'wedge') {
      return <TriangleFamilyGlyph id={definition.id} color={color} dark={dark} />;
    }
    const mainPath = kind === 'doubleWedge'
      ? 'M14 42 40 16l29 22-25 14Z'
      : kind === 'trapezoidPrism'
        ? 'M16 42 29 19h29l12 22-28 13Z'
        : 'M15 43 58 16v27L41 54Z';
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d={mainPath} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
        <path d={kind === 'doubleWedge' ? 'm40 16 3 36' : 'm15 43 26 11 17-11'} fill="none" stroke="#fff" strokeOpacity=".48" strokeWidth="2" />
      </svg>
    );
  }

  if (kind === 'halfCylinder') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M14 42c0-19 15-29 30-20l24 14v17L41 56Z" fill={color} stroke={dark} strokeWidth="2.3" />
        <path d="M14 42 41 56V39c0-12 9-17 19-9" fill="none" stroke="#fff" strokeOpacity=".48" strokeWidth="2" />
      </svg>
    );
  }

  if (definition.id === 'hinge') {
    return (
      <svg viewBox="0 0 84 62" aria-hidden="true">
        <path d="M14 40 48 29l22 10-34 13Z" fill={color} stroke={dark} strokeWidth="2.3" />
        <path d="M36 52V34l28-12v17" fill={color} stroke={dark} strokeWidth="2.3" />
        <circle cx="63" cy="23" r="6" fill="#fff" fillOpacity=".45" stroke={dark} strokeWidth="2" />
      </svg>
    );
  }

  const aspect = definition.size[0] / Math.max(1, definition.size[2]);
  const long = aspect > 2.4;
  const wide = aspect > 1.35;
  const flat = definition.size[1] < 8;
  const studCount = definition.connectors.filter((connector) => connector.type === 'stud').length;
  const studLayouts: Record<number, Array<[number, number]>> = {
    1: [[43, 26]],
    2: [[36, 23], [51, 29]],
    4: [[33, 23], [45, 19], [46, 33], [58, 28]],
  };
  const studPositions = studLayouts[studCount] ?? (long
    ? [[22, 25], [33, 28], [44, 31], [55, 34], [66, 37]]
    : wide
      ? [[29, 23], [40, 26], [51, 29], [62, 32]]
      : [[33, 23], [45, 19], [46, 33], [58, 28]]);
  const topPath = long
    ? 'm8 31 18-11 50 14-18 12Z'
    : wide
      ? 'm10 31 21-13 44 14-20 14Z'
      : 'm13 27 25-15 33 17-25 16Z';
  const sidePath = long
    ? `m8 31v${flat ? 9 : 15}l50 13V46M76 34v${flat ? 8 : 14}L58 53`
    : wide
      ? `m10 31v${flat ? 8 : 15}l45 13V46M75 32v${flat ? 8 : 14}L55 54`
      : `m13 27v${flat ? 9 : 18}l33 16V45M71 29v${flat ? 9 : 17}L46 63`;
  return (
    <svg viewBox="0 0 84 62" aria-hidden="true">
      <path d={topPath} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      {studPositions.map(([cx, cy], index) => (
        <ellipse key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} rx="4.1" ry="2.35" fill="#fff" fillOpacity=".48" stroke={dark} strokeWidth="1.4" />
      ))}
      <path d={sidePath} fill={color} stroke={dark} strokeWidth="2.3" strokeLinejoin="round" />
      <path d={long ? 'm26 20 50 14' : 'm38 12 33 17'} stroke="#fff" strokeOpacity=".6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
