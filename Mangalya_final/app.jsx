import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const systems = [
  {id:"power", icon:"⚡", name:"Power", color:0xffd166, job:"Solar arrays and batteries provide electricity", loss:"Battery drains; instruments and radio enter safe mode.", description:"Solar arrays generate electricity in sunlight and batteries store it for eclipses, feeding every other subsystem. Without power, nothing else in the system can operate.", safeguard:"If the primary regulator faults, the spacecraft automatically switches to a backup power path, so one glitch can't cut electricity to the rest of the system."},
  {id:"comms", icon:"◒", name:"Communication", color:0x6ee7ff, job:"Sends telemetry to Earth and receives commands", loss:"Mission control cannot command or recover the spacecraft.", description:"The antenna and radio hardware relay telemetry to Earth and receive commands, forming the spacecraft's only link back into the rest of the mission system.", safeguard:"A separate low-gain antenna can still send and receive at low speed from almost any orientation, so ground control can reach the spacecraft even if the high-gain dish loses its lock on Earth."},
  {id:"thermal", icon:"◉", name:"Thermal control", color:0xff9f5a, job:"Heaters and radiators protect electronics", loss:"Components overheat or freeze and may shut down.", description:"Heaters and radiators keep every other component within its safe operating temperature. It doesn't do the mission's job directly, but every other system quietly depends on it.", safeguard:"Redundant heater lines mean a single heater failure doesn't leave critical electronics to freeze in deep space."},
  {id:"guidance", icon:"⌁", name:"Guidance", color:0xb18aff, job:"Sensors and thrusters point the craft correctly", loss:"Antenna and solar arrays lose their target direction.", description:"Star sensors and gyroscopes determine orientation, letting the solar arrays face the sun and the antenna face Earth. Lose guidance and those connected systems lose their target.", safeguard:"If attitude sensors glitch, the spacecraft autonomously holds its last known orientation instead of tumbling, buying time for onboard software or ground control to recover it."},
  {id:"propulsion", icon:"↟", name:"Propulsion", color:0xff6f91, job:"Engine changes velocity for critical manoeuvres", loss:"The craft cannot leave Earth or enter Mars orbit.", description:"The main engine and thrusters change the spacecraft's velocity for orbit-raising, course correction, and Mars orbit insertion — the one subsystem the whole 300-day plan hinges on for a few critical minutes.", safeguard:"The real mission carried a genuine backup plan: if the main 440 N engine had failed its pre-burn health check, ISRO was ready to use eight smaller 22 N thrusters together to perform Mars Orbit Insertion instead."},
  {id:"payload", icon:"◌", name:"Science payloads", color:0x7be495, job:"Five instruments observe Mars", loss:"The spacecraft survives but science observations stop.", description:"Five science instruments observe Mars — the reason the mission exists — but they depend entirely on every other subsystem to reach Mars, point correctly, and send data home.", safeguard:"The five instruments operate independently of each other and of spacecraft survival systems, so losing one instrument never threatens navigation, power, or communication — only that instrument's own science.", instruments:[
    {abbr:"MCC", name:"Mars Colour Camera", role:"Visual images of the Martian surface and moons"},
    {abbr:"TIS", name:"Thermal Infrared Imaging Spectrometer", role:"Maps surface temperature and mineral composition"},
    {abbr:"MSM", name:"Methane Sensor for Mars", role:"Searches the atmosphere for methane, a possible biosignature"},
    {abbr:"MENCA", name:"Mars Exospheric Neutral Composition Analyser", role:"Studies the composition of the upper atmosphere"},
    {abbr:"LAP", name:"Lyman Alpha Photometer", role:"Measures the hydrogen/deuterium ratio to study water loss from Mars"},
  ]},
];

const incidentStories = {
  comms: [
    {title:"Antenna misalignment", outcome:"Autonomous pointing routine re-acquires the Earth signal.", recovery:5, effect:"RECOVERING"},
    {title:"Solar-conjunction radio blackout", outcome:"Mission control waits for the planned communication window; spacecraft continues autonomously.", recovery:8, effect:"PLANNED BLACKOUT"},
  ],
  power: [
    {title:"Solar-array shadow", outcome:"Payloads pause and the battery carries the spacecraft until sunlight returns.", recovery:6, effect:"BATTERY MODE"},
    {title:"Power regulator warning", outcome:"The backup power path is selected; non-essential science operations remain paused while the regulator is reset.", recovery:7, effect:"REDUCED SCIENCE"},
  ],
  guidance: [
    {title:"Star-sensor glare", outcome:"The inertial reference unit holds attitude while the sensor is recalibrated.", recovery:6, effect:"ATTITUDE HOLD"},
    {title:"Pointing drift", outcome:"Ground control uploads a correction; the craft continues on a slightly less efficient path while guidance is recalibrated.", recovery:7, effect:"CORRECTION UPLOADED"},
  ],
  thermal: [
    {title:"Thermal spike", outcome:"Heaters and payloads cycle off; radiators bring the bus temperature back to normal.", recovery:6, effect:"THERMAL SAFE MODE"},
    {title:"Cold-side heater warning", outcome:"A redundant heater activates and instruments are warmed gradually until normal thermal control returns.", recovery:7, effect:"REDUNDANT HEATER"},
  ],
  propulsion: [
    {title:"Partial engine burn", outcome:"A follow-up correction burn is scheduled. The trajectory is recovered, but fuel reserves decrease.", recovery:8, effect:"CORRECTION BURN"},
    {title:"Thruster valve warning", outcome:"The main engine is isolated. Small thrusters keep the craft stable until the next command window.", recovery:7, effect:"THRUSTER CONTROL"},
  ],
  payload: [
    {title:"Mars Colour Camera reset", outcome:"The camera restarts. Other instruments continue collecting data during the reset.", recovery:4, effect:"SCIENCE RESET"},
    {title:"Instrument calibration drift", outcome:"The payload is recalibrated; navigation and spacecraft survival are unaffected.", recovery:6, effect:"CALIBRATING"},
  ],
};

const stages = [
  {name:"Launch", range:[0,12], day:"Day 0", detail:"PSLV-C25 lifts Mangalyaan from Sriharikota.", distance:"0–650 km", earth:"0 km", mars:"225 million km", orbit:"0", fuel:"100%", action:"Launch vehicle separation"},
  {name:"Earth orbit building", range:[12,34], day:"Days 1–30", detail:"Six engine burns raise the Earth orbit before the interplanetary departure.", distance:"650–192,000 km", earth:"192,000 km", mars:"210 million km", orbit:"6 Earth orbits", fuel:"78%", action:"Earth-bound manoeuvres"},
  {name:"Mars transfer", range:[34,82], day:"Days 31–300", detail:"Mangalyaan coasts through deep space on its Mars Transfer Trajectory.", distance:"100–680 million km travelled", earth:"190 million km", mars:"12 million km", orbit:"0", fuel:"53%", action:"Cruise and course correction"},
  {name:"Mars orbit insertion", range:[82,100], day:"Day 300", detail:"The 440 N engine burn slows the craft so Mars can capture it in orbit.", distance:"~680 million km travelled", earth:"225 million km", mars:"421 km periapsis", orbit:"1+ Mars orbit", fuel:"44%", action:"Mars Orbit Insertion burn"},
];

function stageFor(p){ return stages.find(s => p >= s.range[0] && p < s.range[1]) || stages[3]; }

function hexColor(n){ return "#"+n.toString(16).padStart(6,"0"); }

const partCatalog = {
  "power-wing": {systemId:"power", name:"Solar Array Wing", role:"Converts sunlight into electricity for the whole spacecraft.", description:"Two deployable wings carried roughly 1,400 W of solar cells in Earth orbit — noticeably less by the time the spacecraft reached Mars, almost twice as far from the Sun.", consequence:"Without them, the spacecraft has only its battery reserve to draw on — measured in hours, not days."},
  "power-battery": {systemId:"power", name:"Battery Pack", role:"Stores power for eclipses and periods when the wings aren't sunlit.", description:"A lithium-ion battery carries the spacecraft through Earth's or Mars' shadow, and through phases of launch and cruise when the wings can't be pointed at the Sun.", consequence:"If it fails, the spacecraft loses all power the instant it enters shadow."},
  "power-pdu": {systemId:"power", name:"Power Distribution Unit", role:"Regulates and routes electricity to every other subsystem.", description:"Automatically switches to a backup regulator path if the primary one faults, so a single glitch doesn't cut power to the rest of the spacecraft.", consequence:"A total failure here would cut power to every other subsystem at once — the single most important point of failure on the spacecraft."},
  "comms-dish": {systemId:"comms", name:"High-Gain Antenna", role:"Sends science data and telemetry to Earth at high speed.", description:"A precisely pointed dish that only works when the spacecraft's orientation is accurate — it has to track Earth across the sky.", consequence:"If it loses lock on Earth, high-rate data returns stop, though the spacecraft can still be commanded through the low-gain antenna."},
  "comms-lowgain": {systemId:"comms", name:"Low-Gain Antenna", role:"A low-rate backup link that works from almost any orientation.", description:"Exists specifically so ground control can regain contact even if the high-gain dish ends up pointed the wrong way entirely.", consequence:"Losing this would remove the safety net that lets mission control recover a badly-oriented spacecraft."},
  "thermal-radiator": {systemId:"thermal", name:"Radiator Panel", role:"Sheds excess heat from onboard electronics into space.", description:"A passive panel — no power needed — that keeps components inside their safe operating temperature range, backed up by redundant heater lines for the cold side.", consequence:"Without enough radiator area, sustained operation raises internal temperatures until components have to be shut down to avoid damage."},
  "guidance-sensor": {systemId:"guidance", name:"Star Sensor", role:"Determines precisely which way the spacecraft is pointing.", description:"Compares the pattern of stars in view against an internal map to fix orientation to a fraction of a degree.", consequence:"If a sensor is blinded (often by stray sunlight), the spacecraft temporarily loses fine attitude knowledge until it recalibrates."},
  "guidance-imu": {systemId:"guidance", name:"Inertial Measurement Unit", role:"Tracks rotation continuously between star-sensor readings.", description:"A set of gyroscopes that keep track of orientation even during the moments the star sensors can't see the sky.", consequence:"Without it, attitude knowledge would only update as fast as the star sensors can supply it, making fine pointing sluggish."},
  "guidance-wheel": {systemId:"guidance", name:"Reaction Wheel", role:"Spins to rotate the spacecraft precisely without using fuel.", description:"Three wheels on different axes are the primary way the craft points itself day to day, reacting against its own momentum.", consequence:"If a wheel fails, the spacecraft has to fall back on thruster pulses to control attitude — burning propellant it needs for Mars orbit insertion."},
  "propulsion-engine": {systemId:"propulsion", name:"Main Engine (440 N)", role:"Performs the big velocity changes: orbit-raising, Mars departure, and Mars Orbit Insertion.", description:"The Liquid Apogee Motor the whole 300-day plan hinges on for a few critical minutes at Mars.", consequence:"If it fails during Mars Orbit Insertion, the spacecraft cannot complete the manoeuvre that captures it into Mars orbit."},
  "propulsion-thruster": {systemId:"propulsion", name:"Attitude Control Thruster", role:"Small thrusters that nudge the spacecraft's orientation and trajectory.", description:"Eight of these 22 N thrusters formed the real backup plan to perform Mars Orbit Insertion together if the main engine had failed its pre-burn health check.", consequence:"Losing several of these would have removed that backup option entirely."},
  "propulsion-tank": {systemId:"propulsion", name:"Propellant Tank", role:"Stores the fuel and oxidiser the engine and thrusters burn.", description:"Fuel reserves were tracked closely in the real mission — every correction burn spent propellant that could never be recovered.", consequence:"A ruptured or leaking tank would cut the mission short regardless of how healthy every other subsystem was."},
  "payload-mcc": {systemId:"payload", name:"Mars Colour Camera (MCC)", role:"Captures visual images of the Martian surface and moons.", description:"A wide-angle camera that produced most of the mission's public-facing images of Mars and its moon Phobos.", consequence:"If it failed, visual imaging would stop, but the other four instruments would continue their measurements independently."},
  "payload-tis": {systemId:"payload", name:"Thermal Infrared Imaging Spectrometer (TIS)", role:"Maps surface temperature and mineral composition.", description:"Measures infrared emission from the Martian surface to study its mineralogy and thermal behaviour.", consequence:"Its loss would end surface-composition mapping while leaving every other instrument and subsystem unaffected."},
  "payload-msm": {systemId:"payload", name:"Methane Sensor for Mars (MSM)", role:"Searches the atmosphere for methane, a possible biosignature.", description:"Measures methane concentration in the Martian atmosphere — a gas that, on Earth, is mostly produced by living organisms or geological activity.", consequence:"Losing it would end the search for atmospheric methane specifically, without affecting anything else."},
  "payload-menca": {systemId:"payload", name:"Mars Exospheric Neutral Composition Analyser (MENCA)", role:"Studies the composition of the upper atmosphere.", description:"An in-situ mass spectrometer that samples the neutral particles of Mars' thin outer atmosphere as the spacecraft passes through it.", consequence:"Its failure would end exospheric composition measurements, independent of the rest of the spacecraft."},
  "payload-lap": {systemId:"payload", name:"Lyman Alpha Photometer (LAP)", role:"Measures the hydrogen/deuterium ratio to study water loss from Mars.", description:"By comparing hydrogen and deuterium in the upper atmosphere, LAP helps explain how Mars lost most of its ancient water to space.", consequence:"Losing it would end that specific measurement while every other instrument kept working."},
};

function SystemsMap({ systems }){
  const byId = (id) => systems.find(s=>s.id===id);
  const nodes = [
    {id:"power", x:110, y:60}, {id:"thermal", x:110, y:260},
    {id:"guidance", x:450, y:60}, {id:"comms", x:450, y:260},
    {id:"propulsion", x:790, y:60}, {id:"payload", x:790, y:260},
  ];
  return <svg className="systems-map-svg" viewBox="-20 -70 940 420" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="sm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>
      </marker>
    </defs>
    <text x="110" y="-40" textAnchor="middle" className="sm-tier-label">FOUNDATION</text>
    <text x="450" y="-40" textAnchor="middle" className="sm-tier-label">CONTROL</text>
    <text x="790" y="-40" textAnchor="middle" className="sm-tier-label">MISSION FUNCTION</text>

    <line x1="160" y1="160" x2="395" y2="160" className="sm-flow-arrow" markerEnd="url(#sm-arrow)"/>
    <text x="280" y="150" textAnchor="middle" className="sm-flow-label">ELECTRICITY +<tspan x="280" dy="13">THERMAL CONTROL</tspan></text>

    <line x1="500" y1="160" x2="735" y2="160" className="sm-flow-arrow" markerEnd="url(#sm-arrow)"/>
    <text x="620" y="150" textAnchor="middle" className="sm-flow-label">POINTING +<tspan x="620" dy="13">COMMANDS</tspan></text>

    <path d="M 420,35 C 340,-35 220,-35 145,30" className="sm-feedback-arrow" markerEnd="url(#sm-arrow)"/>
    <text x="280" y="-52" textAnchor="middle" className="sm-feedback-label">GUIDANCE POINTS THE SOLAR ARRAYS AT THE SUN</text>

    {nodes.map(n=>{
      const s = byId(n.id);
      return <g key={n.id} className="sm-node">
        <circle cx={n.x} cy={n.y} r="34" style={{fill:hexColor(s.color), fillOpacity:.16, stroke:hexColor(s.color)}}/>
        <text x={n.x} y={n.y+9} textAnchor="middle" className="sm-node-icon" style={{fill:hexColor(s.color)}}>{s.icon}</text>
        <text x={n.x} y={n.y+52} textAnchor="middle" className="sm-node-name">{s.name}</text>
      </g>;
    })}
  </svg>;
}

function BlueprintSVG({ systems, onSelect }){
  // callouts positioned in front-elevation local space (before the panel's own translate(20,70))
  const callouts = [
    {id:"power", x:60, y:190, leaderTo:[75,235]},
    {id:"comms", x:190, y:95, leaderTo:[190,138]},
    {id:"thermal", x:300, y:220, leaderTo:[190,250]},
    {id:"guidance", x:300, y:280, leaderTo:[210,250]},
    {id:"propulsion", x:190, y:375, leaderTo:[190,315]},
    {id:"payload", x:80, y:375, leaderTo:[150,295]},
  ];
  return <svg className="blueprint-svg" viewBox="0 0 1200 560" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="1192" height="552" className="bp-frame"/>
    <g className="bp-ticks">
      <path d="M4,24 L24,24 M14,4 L14,24" /><path d="M1196,24 L1176,24 M1186,4 L1186,24" />
      <path d="M4,536 L24,536 M14,536 L14,556" /><path d="M1196,536 L1176,536 M1186,536 L1186,556" />
    </g>
    <text x="24" y="34" className="bp-title">MANGALYAAN — SUBSYSTEM LAYOUT (SCHEMATIC)</text>
    <text x="24" y="50" className="bp-subtitle">Not to scale · illustrative technical drawing</text>

    <g transform="translate(20,70)">
      <text x="190" y="-10" className="bp-panel-label" textAnchor="middle">FRONT ELEVATION</text>
      <rect x="0" y="0" width="380" height="460" className="bp-panel-border"/>
      <rect x="10" y="235" width="130" height="10" className="bp-part"/>
      <rect x="240" y="235" width="130" height="10" className="bp-part"/>
      <rect x="140" y="210" width="100" height="80" className="bp-part"/>
      <line x1="190" y1="210" x2="190" y2="150" className="bp-line"/>
      <ellipse cx="190" cy="138" rx="26" ry="11" className="bp-part"/>
      <line x1="164" y1="138" x2="216" y2="138" className="bp-dash"/>
      <line x1="140" y1="220" x2="115" y2="195" className="bp-line"/>
      <circle cx="112" cy="192" r="4" className="bp-part"/>
      <line x1="150" y1="220" x2="160" y2="280" className="bp-hatch"/>
      <line x1="165" y1="220" x2="175" y2="280" className="bp-hatch"/>
      <line x1="180" y1="220" x2="190" y2="280" className="bp-hatch"/>
      <circle cx="210" cy="250" r="10" className="bp-part"/>
      <rect x="145" y="290" width="90" height="10" className="bp-part"/>
      <path d="M170,300 L210,300 L202,335 L178,335 Z" className="bp-part"/>
      <circle cx="150" cy="260" r="14" className="bp-dashed-circle"/>
      <circle cx="230" cy="260" r="14" className="bp-dashed-circle"/>
      <line x1="10" y1="410" x2="370" y2="410" className="bp-dim"/>
      <line x1="10" y1="400" x2="10" y2="420" className="bp-dim"/>
      <line x1="370" y1="400" x2="370" y2="420" className="bp-dim"/>
      <text x="190" y="428" className="bp-dim-label" textAnchor="middle">≈ 8 m WINGSPAN (ILLUSTRATIVE)</text>
      {callouts.map((c,i)=>{
        const sys = systems.find(s=>s.id===c.id);
        return <g key={c.id} className="bp-callout" onClick={()=>onSelect(c.id)}>
          <line x1={c.x} y1={c.y} x2={c.leaderTo[0]} y2={c.leaderTo[1]} className="bp-leader"/>
          <circle cx={c.x} cy={c.y} r="14" style={{fill:hexColor(sys.color), stroke:hexColor(sys.color)}}/>
          <text x={c.x} y={c.y+5} textAnchor="middle" className="bp-callout-num">{i+1}</text>
        </g>;
      })}
    </g>

    <g transform="translate(440,70)">
      <text x="190" y="-10" className="bp-panel-label" textAnchor="middle">TOP VIEW</text>
      <rect x="0" y="0" width="380" height="460" className="bp-panel-border"/>
      <rect x="10" y="215" width="130" height="30" className="bp-part"/>
      <rect x="240" y="215" width="130" height="30" className="bp-part"/>
      <rect x="140" y="190" width="100" height="80" className="bp-part"/>
      <circle cx="150" cy="200" r="8" className="bp-part"/>
      <circle cx="230" cy="200" r="8" className="bp-part"/>
      <circle cx="150" cy="260" r="8" className="bp-part"/>
      <circle cx="230" cy="260" r="8" className="bp-part"/>
      <circle cx="190" cy="160" r="13" className="bp-part"/>
      <line x1="190" y1="190" x2="190" y2="173" className="bp-line"/>
      <rect x="150" y="275" width="14" height="14" className="bp-part"/>
      <rect x="170" y="275" width="14" height="14" className="bp-part"/>
      <rect x="190" y="275" width="14" height="14" className="bp-part"/>
      <rect x="210" y="275" width="14" height="14" className="bp-part"/>
      <rect x="230" y="275" width="14" height="14" className="bp-part"/>
      <line x1="10" y1="410" x2="370" y2="410" className="bp-dim"/>
      <line x1="10" y1="400" x2="10" y2="420" className="bp-dim"/>
      <line x1="370" y1="400" x2="370" y2="420" className="bp-dim"/>
      <text x="190" y="428" className="bp-dim-label" textAnchor="middle">NADIR-FACING INSTRUMENT DECK</text>
    </g>

    <g transform="translate(850,70)">
      <text x="0" y="-10" className="bp-panel-label">KEY — CLICK TO INSPECT</text>
      <rect x="0" y="0" width="330" height="460" className="bp-panel-border"/>
      {systems.map((s,i)=>
        <g key={s.id} className="bp-legend-row" transform={`translate(30,${45+i*72})`} onClick={()=>onSelect(s.id)}>
          <circle cx="0" cy="0" r="12" style={{fill:hexColor(s.color), stroke:hexColor(s.color)}}/>
          <text x="0" y="4" textAnchor="middle" className="bp-callout-num">{i+1}</text>
          <text x="24" y="-1" className="bp-legend-name">{s.name}</text>
          <text x="24" y="17" className="bp-legend-job">{s.job}</text>
        </g>
      )}
    </g>
  </svg>;
}

function SpacecraftView({ systems, failure, health }){
  const mountRef = useRef(null);
  const partsRef = useRef({});
  const healthRef = useRef({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [mode, setMode] = useState("3d");
  const selectSystem = (id)=>{ setSelectedId(id); setSelectedPart(null); };
  const closePopup = ()=>{ setSelectedId(null); setSelectedPart(null); };

  useEffect(()=>{
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;
    const colorFor = (id) => (systems.find(s=>s.id===id)||{}).color ?? 0x72b5ff;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100);
    camera.position.set(5.4,3.6,7.2);
    const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
    renderer.setSize(width,height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2.5; controls.maxDistance = 16;

    const grid = new THREE.GridHelper(14,28,0x1c3a52,0x13283b);
    grid.position.y = -1.8;
    scene.add(grid);

    const craft = new THREE.Group();
    scene.add(craft);

    function makePart(systemId, partId, geometry, position, rotation=[0,0,0]){
      const color = colorFor(systemId);
      const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.18, depthWrite:false}));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({color, transparent:true, opacity:0.95, depthWrite:false}));
      const group = new THREE.Group();
      group.add(fill); group.add(edges);
      group.position.set(...position);
      group.rotation.set(...rotation);
      group.userData.systemId = systemId;
      group.userData.partId = partId;
      group.renderOrder = 1;
      craft.add(group);
      if(!partsRef.current[systemId]) partsRef.current[systemId] = [];
      partsRef.current[systemId].push({fill,edges});
    }

    function makeStatic(geometry, position, rotation=[0,0,0]){
      const color = 0x3a5570;
      const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.08, depthWrite:false}));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({color, transparent:true, opacity:0.45, depthWrite:false}));
      const group = new THREE.Group();
      group.add(fill); group.add(edges);
      group.position.set(...position);
      group.rotation.set(...rotation);
      group.renderOrder = 0;
      craft.add(group);
    }

    // neutral bus structure (not a system on its own — just the chassis everything mounts to)
    makeStatic(new THREE.BoxGeometry(1.3,1.1,1.3), [0,0,0]);

    // power: solar wings, battery pack, power distribution unit
    makePart("power", "power-wing", new THREE.BoxGeometry(2.5,0.06,1.05), [-2.15,0,0]);
    makePart("power", "power-wing", new THREE.BoxGeometry(2.5,0.06,1.05), [2.15,0,0]);
    makePart("power", "power-battery", new THREE.BoxGeometry(0.4,0.25,0.4), [0.35,0.5,-0.55]);
    makePart("power", "power-pdu", new THREE.BoxGeometry(0.22,0.18,0.22), [-0.35,0.5,-0.55]);

    // communication: high-gain dish on a pole, plus a low-gain backup antenna
    makePart("comms", "comms-dish", new THREE.CylinderGeometry(0.04,0.04,0.7,8), [0,0.9,0.5], [0,0,-0.3]);
    makePart("comms", "comms-dish", new THREE.CylinderGeometry(0.5,0.07,0.28,20), [0,1.35,0.75], [Math.PI*0.42,0,0]);
    makePart("comms", "comms-lowgain", new THREE.CylinderGeometry(0.05,0.1,0.22,8), [-0.6,0.55,0.6]);

    // thermal: radiator panels front and back
    makePart("thermal", "thermal-radiator", new THREE.BoxGeometry(1.25,0.9,0.04), [0,0,0.68]);
    makePart("thermal", "thermal-radiator", new THREE.BoxGeometry(1.25,0.9,0.04), [0,0,-0.68]);

    // guidance: star sensors, inertial measurement unit, reaction wheels on three axes
    makePart("guidance", "guidance-sensor", new THREE.BoxGeometry(0.2,0.2,0.2), [0.58,0.58,0.6]);
    makePart("guidance", "guidance-sensor", new THREE.BoxGeometry(0.2,0.2,0.2), [-0.58,0.58,0.6]);
    makePart("guidance", "guidance-imu", new THREE.BoxGeometry(0.28,0.22,0.28), [0,0.58,-0.6]);
    makePart("guidance", "guidance-wheel", new THREE.CylinderGeometry(0.16,0.16,0.06,20), [0.3,0,-0.6], [Math.PI/2,0,0]);
    makePart("guidance", "guidance-wheel", new THREE.CylinderGeometry(0.16,0.16,0.06,20), [-0.3,0,-0.6], [0,0,Math.PI/2]);
    makePart("guidance", "guidance-wheel", new THREE.CylinderGeometry(0.16,0.16,0.06,20), [0,0.3,-0.6], [0,Math.PI/2,0]);

    // propulsion: main engine, thruster cluster, propellant tanks
    makePart("propulsion", "propulsion-engine", new THREE.CylinderGeometry(0.22,0.34,0.5,16), [0,-0.85,0]);
    makePart("propulsion", "propulsion-thruster", new THREE.CylinderGeometry(0.06,0.06,0.22,8), [0.55,-0.62,0.55]);
    makePart("propulsion", "propulsion-thruster", new THREE.CylinderGeometry(0.06,0.06,0.22,8), [-0.55,-0.62,0.55]);
    makePart("propulsion", "propulsion-thruster", new THREE.CylinderGeometry(0.06,0.06,0.22,8), [0.55,-0.62,-0.55]);
    makePart("propulsion", "propulsion-thruster", new THREE.CylinderGeometry(0.06,0.06,0.22,8), [-0.55,-0.62,-0.55]);
    makePart("propulsion", "propulsion-tank", new THREE.SphereGeometry(0.28,16,12), [0.35,-0.15,0.3]);
    makePart("propulsion", "propulsion-tank", new THREE.SphereGeometry(0.28,16,12), [-0.35,-0.15,-0.3]);

    // payload: five science instruments, nadir-facing on the underside
    makePart("payload", "payload-mcc", new THREE.BoxGeometry(0.22,0.18,0.22), [0.5,-0.58,0.35]);
    makePart("payload", "payload-tis", new THREE.BoxGeometry(0.24,0.18,0.24), [-0.5,-0.58,0.35]);
    makePart("payload", "payload-msm", new THREE.BoxGeometry(0.2,0.16,0.2), [0.5,-0.58,-0.35]);
    makePart("payload", "payload-menca", new THREE.BoxGeometry(0.2,0.16,0.2), [-0.5,-0.58,-0.35]);
    makePart("payload", "payload-lap", new THREE.BoxGeometry(0.18,0.16,0.18), [0,-0.58,0.5]);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickable = [];
    craft.traverse(o=>{ if(o.isMesh && o.parent && o.parent.userData.systemId) clickable.push(o); });

    function onClick(e){
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX-rect.left)/rect.width)*2-1;
      pointer.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      if(hits.length){ setSelectedPart(hits[0].object.parent.userData.partId); setSelectedId(null); }
    }
    renderer.domElement.addEventListener("click", onClick);

    function onResize(){
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w/h; camera.updateProjectionMatrix();
      renderer.setSize(w,h);
    }
    window.addEventListener("resize", onResize);

    let raf;
    function animate(){
      raf=requestAnimationFrame(animate);
      const t = performance.now()*0.004;
      const pulse = 0.6+0.4*Math.sin(t*4);
      Object.entries(partsRef.current).forEach(([id,meshes])=>{
        if(healthRef.current[id] >= 80) return;
        meshes.forEach(({fill})=>{ fill.material.opacity = (healthRef.current[id]<50?0.32:0.2)*pulse+0.05; });
      });
      controls.update();
      renderer.render(scene,camera);
    }
    animate();

    return ()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  },[]);

  useEffect(()=>{
    Object.entries(partsRef.current).forEach(([id,meshes])=>{
      const h = health(id);
      healthRef.current[id] = h;
      const base = (systems.find(s=>s.id===id)||{}).color ?? 0x72b5ff;
      const color = h<50 ? 0xff3b3b : h<80 ? 0xffb020 : base;
      meshes.forEach(({fill,edges})=>{ fill.material.color.setHex(color); edges.material.color.setHex(color); if(h>=80) fill.material.opacity = 0.18; });
    });
  },[failure]);

  const partData = selectedPart ? partCatalog[selectedPart] : null;
  const parentSystem = systems.find(s=>s.id === (partData ? partData.systemId : selectedId));
  const info = partData ? {
    icon: parentSystem?.icon,
    name: partData.name,
    job: partData.role,
    description: partData.description,
    safeguard: parentSystem?.safeguard,
    loss: partData.consequence,
    instruments: null,
  } : parentSystem;
  return <section className="spacecraft-view">
    <div className="spacecraft-modebar">
      <div className="mode-toggle"><button className={mode==="3d"?"active":""} onClick={()=>setMode("3d")}>3D Model</button><button className={mode==="blueprint"?"active":""} onClick={()=>setMode("blueprint")}>Blueprint</button></div>
      <p className="spacecraft-hint">{mode==="3d" ? "Drag to rotate · Scroll to zoom · Right-drag to pan · Click a component" : "Click a numbered callout or the key to inspect a system"}</p>
    </div>
    <div className="spacecraft-canvas" ref={mountRef} style={{display:mode==="3d"?"block":"none"}}></div>
    <div className="blueprint-wrap" style={{display:mode==="blueprint"?"block":"none"}}><BlueprintSVG systems={systems} onSelect={selectSystem} /></div>
    {info && <div className="spacecraft-popup-backdrop" onClick={closePopup}>
      <div className="spacecraft-popup" onClick={e=>e.stopPropagation()}>
        <button className="popup-close" onClick={closePopup}>✕</button>
        <span className="popup-icon">{info.icon}</span>
        <h3>{info.name}</h3>
        <p className="popup-role"><b>Role in the system:</b> {info.job}</p>
        <p className="popup-desc">{info.description}</p>
        <p className="popup-safeguard"><b>How the system protects itself:</b> {info.safeguard}</p>
        <p className="popup-loss"><b>If removed from the system:</b> {info.loss}</p>
        {info.instruments && <ul className="popup-instruments">{info.instruments.map(ins=><li key={ins.abbr}><b>{ins.abbr}</b> — {ins.name}<span>{ins.role}</span></li>)}</ul>}
      </div>
    </div>}
  </section>;
}

function App(){
  const [running,setRunning] = useState(false);
  const [progress,setProgress] = useState(0);
  const [selected,setSelected] = useState("propulsion");
  const [failure,setFailure] = useState(null);
  const [recoveryNotice,setRecoveryNotice] = useState(null);
  const [failChoice,setFailChoice] = useState("propulsion");
  const [lost,setLost] = useState(false);
  const [view,setView] = useState("journey");
  useEffect(()=>{ if(!running) return; const t=setInterval(()=>setProgress(p=>{ if(p>=100){ clearInterval(t); return 100; } return Math.min(100,p+.2); }),180); return ()=>clearInterval(t); },[running]);
  useEffect(()=>{ if(!failure || !failure.recovery || lost) return; const t=setTimeout(()=>{setRecoveryNotice(failure);setFailure(null);},failure.recovery*1000); return ()=>clearTimeout(t); },[failure,lost]);
  const stage=stageFor(progress);
  const incidentActive = failure && !failure.recovered;
  const failedAtMars = incidentActive && failure?.id === "propulsion" && progress >= 82 && failure.title === "Partial engine burn";
  useEffect(()=>{ if(failedAtMars){ setLost(true); setRunning(false); } },[failedAtMars]);
  const failureText = lost ? "The propulsion fault was still active during the Mars Orbit Insertion burn. The engine could not complete the manoeuvre and Mars did not capture the spacecraft." : failure ? failure.outcome : "No component failure injected. All subsystems are nominal.";
  const ended = progress >= 100;
  const status = lost ? "MISSION LOST — MARS CAPTURE FAILED" : incidentActive ? `${failure.effect} — AUTONOMOUS RESPONSE` : recoveryNotice ? "RECOVERED — MISSION CONTINUES" : ended ? "MARS ORBIT ACHIEVED" : running ? "MISSION IN PROGRESS" : "READY TO LAUNCH";
  const health = (id) => incidentActive && failure?.id === id ? 35 : incidentActive && ((failure.id === "guidance" && ["power","comms"].includes(id)) || (failure.id === "power" && ["payload","comms"].includes(id)) || (failure.id === "thermal" && id === "payload")) ? 62 : 96;
  const missionDay=Math.round(progress*3);
  const inject=()=>{ if(!failure && progress>0 && progress<100){const choices=incidentStories[failChoice];const story=choices[Math.floor(Math.random()*choices.length)];setRecoveryNotice(null);setFailure({id:failChoice,at:progress,...story,recovered:false});setSelected(failChoice);setRunning(true);} };
  const reset=()=>{setRunning(false);setProgress(0);setFailure(null);setRecoveryNotice(null);setSelected("propulsion");setLost(false);};
  return <main>
    <div className="pixel-starfield" aria-hidden="true"><i></i><b></b></div>
    <div className="crt-scanlines" aria-hidden="true"></div>
    <nav><div className="brand"><span className="orbital-mark">◌</span><div><b>Mangalyaan</b><span>FULL MISSION JOURNEY SIMULATOR</span></div></div><span className="drawing-stamp">MOM · REV C1</span><div className="view-toggle"><button className={view==="journey"?"active":""} onClick={()=>setView("journey")}>Journey</button><button className={view==="spacecraft"?"active":""} onClick={()=>setView("spacecraft")}>Spacecraft</button></div><div className={failure?"journey-status bad":"journey-status"}>● {status}</div></nav>
    {view==="spacecraft" && <SpacecraftView systems={systems} failure={failure} health={health} />}
    {view==="journey" && <>
    <section className="journey-hero"><div><p className="eyebrow">ISRO / MARS ORBITER MISSION</p><h1>Fly the journey<br/>from <em>Earth to Mars.</em></h1><p className="subhead">A slower classroom simulation of launch, Earth-orbit building, the 300-day journey, and Mars-orbit insertion. All telemetry is illustrative.</p><div className="sim-controls"><button className="primary" onClick={()=>setRunning(!running)} disabled={ended||!!failure||lost}>{running?"❚❚ Pause mission":progress===0?"▶ Start launch":"▶ Continue mission"}</button><button className="reset" onClick={reset}>↺ Restart</button></div></div><div className="journey-space" role="img" aria-label="Three-dimensional Mangalyaan spacecraft moving from Earth to Mars"><span className="tiny-star a">✦</span><span className="tiny-star b">✧</span><span className="tiny-star c">·</span><span className="tiny-star d">✦</span><span className="tiny-star e">·</span><div className="space-haze"></div><div className="earth-planet"><i></i>EARTH</div><div className="transfer-line"></div><div className="mars-planet"><i></i>MARS</div><div className="flight-readout"><span>FLIGHT PROGRESS</span><b>{Math.round(progress)}%</b><i style={{width:`${progress}%`}}></i></div><div className={`journey-craft ${failure?"craft-fault":""}`} style={{left:`${10+Math.min(progress,98)*.8}%`}}><div className="solar solar-left"></div><div className="rocket-3d"><div className="rocket-nose"></div><div className="rocket-body"><i></i></div><div className="rocket-fin fin-left"></div><div className="rocket-fin fin-right"></div><div className="rocket-engine"></div><div className="signal-dish"></div></div><div className="solar solar-right"></div><div className="flame"></div></div><span className="space-label left-label">EARTH DEPARTURE</span><span className="space-label right-label">MARS ARRIVAL</span></div><aside className="failure-dock"><p className="eyebrow">FAULT CONTROL</p><h2>Break a component</h2><p className="dock-copy">Pause at any point, choose a system, then inject a fault.</p><label>COMPONENT<select value={failChoice} onChange={e=>setFailChoice(e.target.value)} disabled={!!failure}>{systems.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="inject" onClick={inject} disabled={!!failure||progress===0||ended}>⚠ Inject failure</button>{failure?<><p className="dock-fault">FAILED AT DAY {Math.round(failure.at*3)}</p><p className="dock-consequence">{failureText}</p>{lost?<p className="dock-ready">Mission lost. Use Restart to try a different scenario.</p>:<button className="reset dock-reset" onClick={()=>setFailure(null)}>Clear failure</button>}</>:<><p className="dock-ready">{ended?"Mission complete. Restart to try a different failure scenario.":"Start the mission to unlock fault injection."}</p>{recoveryNotice && !ended && <p className="recovery-lesson">That recovery is the same kind of autonomous fault response the real Mangalyaan relied on: with up to a ~24 minute round trip to Earth, the {systems.find(s=>s.id===recoveryNotice.id)?.name} subsystem couldn't wait for a ground command, so it had to fix itself.</p>}</>}</aside></section>
    <section className="mission-console"><div className="section-heading"><div><p className="eyebrow">01 / LIVE MISSION CONSOLE</p><h2>{stage.name}</h2></div><div className="mission-day">SIMULATED DAY {missionDay} / 300</div></div><p className="phase-detail">{stage.detail}</p><div className="mission-track" aria-label="Mission phase timeline">{stages.map((s,i)=><button key={s.name} className={stage.name===s.name?"phase active":progress>=s.range[1]?"phase done":"phase"} onClick={()=>{if(!failure){setProgress(s.range[0]);setRunning(false)}}}><span>{String(i+1).padStart(2,"0")}</span><b>{s.name}</b><small>{s.day}</small></button>)}</div><div className="live-data"><article><span>DISTANCE TRAVELLED</span><b>{stage.distance}</b><small>{stage.action}</small></article><article><span>DISTANCE FROM EARTH</span><b>{stage.earth}</b><small>Illustrative live position</small></article><article><span>DISTANCE FROM MARS</span><b>{stage.mars}</b><small>Illustrative live position</small></article><article><span>ORBITS / FUEL</span><b>{stage.orbit} · {stage.fuel}</b><small>Propellant estimate</small></article></div></section>
    <section className="systems-panel"><div className="section-heading"><div><p className="eyebrow">03 / CONNECTED SUBSYSTEMS</p><h2>Spacecraft health</h2></div><div className={failure?"health-pill danger":"health-pill"}>{failure?"▲ FAULT PROPAGATION":"● NOMINAL"}</div></div><div className="system-grid">{systems.map(s=><button key={s.id} onClick={()=>setSelected(s.id)} className={`system-card ${selected===s.id?"selected":""} ${health(s.id)<70?"affected":""}`}><div className="card-top"><span className="system-icon">{s.icon}</span><span className="health">{health(s.id)}%</span></div><strong>{s.name}</strong><div className="reading">{health(s.id)<30?"FAILED":health(s.id)<70?"LIMITED":"ONLINE"}</div><span>{s.job}</span><div className="meter"><i style={{width:`${health(s.id)}%`}}></i></div></button>)}</div><div className="selected-detail"><span className="detail-icon">{systems.find(s=>s.id===selected).icon}</span><div><b>{systems.find(s=>s.id===selected).name}</b><p><b>Job:</b> {systems.find(s=>s.id===selected).job} <b>If lost:</b> {systems.find(s=>s.id===selected).loss}</p></div></div></section>
    <section className="model-section"><div className="model-copy"><p className="eyebrow">ENGINEERING EXPLANATION</p><h2>Why this is a system</h2><p>A system is a set of connected parts working toward a shared purpose: inputs (sunlight and commands) flow through connected processes (power, guidance, propulsion, thermal control and communication) to produce outputs (telemetry and Mars observations). No single part does the mission's job — the <em>connections</em> between them do.</p><p>Mars is between 3 and 22 light-minutes from Earth depending on where the two planets are, so a command can take up to roughly 24 minutes for a round trip. By the time a fault is reported and a fix is sent back, the moment to act has often already passed — which is exactly why the spacecraft has to detect, isolate, and recover from many faults entirely on its own, without waiting for Earth.</p><p>It also had to do this on a tight budget — around ₹450 crore (roughly $74 million), designed and built in about 15 months. There wasn't room to make everything redundant, so engineers had to decide which connections mattered most and protect exactly those: a backup power path, a backup antenna that works from almost any orientation, redundant heaters, and a real contingency to fire eight small thrusters together if the main engine had failed its health check before Mars orbit insertion. Knowing which connections to protect — and protecting only those — is what effective systems engineering looks like under real constraints.</p><p>Every fault you inject above is one of these design choices in miniature: a component fails, and the system either has a safeguard ready, or it doesn't. That's the same trade-off ISRO's engineers made for real, component by component — and it's why Mangalyaan could lose a subsystem mid-mission and still reach Mars.</p></div><div className="model-links"><div><span>INPUT</span><b>Sunlight & commands</b></div><i>→</i><div><span>PROCESS</span><b>Satellite systems</b></div><i>→</i><div><span>OUTPUT</span><b>Data & images</b></div></div><div className="systems-map"><p className="eyebrow">HOW THE SIX SUBSYSTEMS DEPEND ON EACH OTHER</p><SystemsMap systems={systems} /><p className="systems-map-caption">Propulsion and Payload sit at the end of the chain: they don't feed anything else, but they depend on everything upstream being healthy — which is exactly why a Power, Guidance or Thermal fault shows up as reduced health on the systems above, and why a Propulsion failure during Mars Orbit Insertion has no safety net downstream.</p></div><div className="resilience-stats"><article><b>≈24 min</b><span>Round-trip signal delay to Mars — why the system must self-recover</span></article><article><b>₹450 cr / $74M</b><span>Approximate mission budget — resilience by smart design, not brute force</span></article><article><b>15 months</b><span>From project approval to launch readiness</span></article><article><b>1st attempt</b><span>India became the first nation to reach Mars orbit on its first try</span></article></div></section>
    </>}
    <footer>Educational simulation • Mission phases use historical MOM milestones; changing telemetry is illustrative • Real MOM was declared non-operational in 2022.</footer>
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
