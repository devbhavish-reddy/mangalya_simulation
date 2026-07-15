import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";

const systems = [
  {id:"power", icon:"⚡", name:"Power", job:"Solar arrays and batteries provide electricity", loss:"Battery drains; instruments and radio enter safe mode."},
  {id:"comms", icon:"◒", name:"Communication", job:"Sends telemetry to Earth and receives commands", loss:"Mission control cannot command or recover the spacecraft."},
  {id:"thermal", icon:"◉", name:"Thermal control", job:"Heaters and radiators protect electronics", loss:"Components overheat or freeze and may shut down."},
  {id:"guidance", icon:"⌁", name:"Guidance", job:"Sensors and thrusters point the craft correctly", loss:"Antenna and solar arrays lose their target direction."},
  {id:"propulsion", icon:"↟", name:"Propulsion", job:"Engine changes velocity for critical manoeuvres", loss:"The craft cannot leave Earth or enter Mars orbit."},
  {id:"payload", icon:"◌", name:"Science payloads", job:"Five instruments observe Mars", loss:"The spacecraft survives but science observations stop."},
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
function App(){
  const [running,setRunning] = useState(false);
  const [progress,setProgress] = useState(0);
  const [selected,setSelected] = useState("propulsion");
  const [failure,setFailure] = useState(null);
  const [recoveryNotice,setRecoveryNotice] = useState(null);
  const [failChoice,setFailChoice] = useState("propulsion");
  useEffect(()=>{ if(!running || progress >= 100) return; const t=setInterval(()=>setProgress(p=>Math.min(100,p+.2)),180); return ()=>clearInterval(t); },[running,progress]);
  useEffect(()=>{ if(!failure || !failure.recovery) return; const t=setTimeout(()=>{setRecoveryNotice(failure);setFailure(null);},failure.recovery*1000); return ()=>clearTimeout(t); },[failure]);
  const stage=stageFor(progress);
  const incidentActive = failure && !failure.recovered;
  const failureText = failure ? failure.outcome : "No component failure injected. All subsystems are nominal.";
  const failedAtMars = incidentActive && failure?.id === "propulsion" && progress >= 82 && failure.title === "Partial engine burn";
  const ended = progress >= 100;
  const status = failedAtMars ? "MISSION LOST — MARS CAPTURE FAILED" : incidentActive ? `${failure.effect} — AUTONOMOUS RESPONSE` : recoveryNotice ? "RECOVERED — MISSION CONTINUES" : ended ? "MARS ORBIT ACHIEVED" : running ? "MISSION IN PROGRESS" : "READY TO LAUNCH";
  const health = (id) => incidentActive && failure?.id === id ? 35 : incidentActive && ((failure.id === "guidance" && ["power","comms"].includes(id)) || (failure.id === "power" && ["payload","comms"].includes(id)) || (failure.id === "thermal" && id === "payload")) ? 62 : 96;
  const missionDay=Math.round(progress*3);
  const inject=()=>{ if(!failure && progress>0 && progress<100){const choices=incidentStories[failChoice];const story=choices[Math.floor(Math.random()*choices.length)];setRecoveryNotice(null);setFailure({id:failChoice,at:progress,...story,recovered:false});setSelected(failChoice);setRunning(true);} };
  const reset=()=>{setRunning(false);setProgress(0);setFailure(null);setRecoveryNotice(null);setSelected("propulsion");};
  return <main>
    <nav><div className="brand"><span className="orbital-mark">◌</span><div><b>Mangalyaan</b><span>FULL MISSION JOURNEY SIMULATOR</span></div></div><div className={failure?"journey-status bad":"journey-status"}>● {status}</div></nav>
    <section className="journey-hero"><div><p className="eyebrow">ISRO / MARS ORBITER MISSION</p><h1>Fly the journey<br/>from <em>Earth to Mars.</em></h1><p className="subhead">A slower classroom simulation of launch, Earth-orbit building, the 300-day journey, and Mars-orbit insertion. All telemetry is illustrative.</p><div className="sim-controls"><button className="primary" onClick={()=>setRunning(!running)} disabled={ended||!!failure}>{running?"❚❚ Pause mission":progress===0?"▶ Start launch":"▶ Continue mission"}</button><button className="reset" onClick={reset}>↺ Restart</button></div></div><div className="journey-space" role="img" aria-label="Three-dimensional Mangalyaan spacecraft moving from Earth to Mars"><span className="tiny-star a">✦</span><span className="tiny-star b">✧</span><span className="tiny-star c">·</span><span className="tiny-star d">✦</span><span className="tiny-star e">·</span><div className="space-haze"></div><div className="earth-planet"><i></i>EARTH</div><div className="transfer-line"></div><div className="mars-planet"><i></i>MARS</div><div className="flight-readout"><span>FLIGHT PROGRESS</span><b>{Math.round(progress)}%</b><i style={{width:`${progress}%`}}></i></div><div className={`journey-craft ${failure?"craft-fault":""}`} style={{left:`${10+Math.min(progress,98)*.8}%`}}><div className="solar solar-left"></div><div className="rocket-3d"><div className="rocket-nose"></div><div className="rocket-body"><i></i></div><div className="rocket-fin fin-left"></div><div className="rocket-fin fin-right"></div><div className="rocket-engine"></div><div className="signal-dish"></div></div><div className="solar solar-right"></div><div className="flame"></div></div><span className="space-label left-label">EARTH DEPARTURE</span><span className="space-label right-label">MARS ARRIVAL</span></div><aside className="failure-dock"><p className="eyebrow">FAULT CONTROL</p><h2>Break a component</h2><p className="dock-copy">Pause at any point, choose a system, then inject a fault.</p><label>COMPONENT<select value={failChoice} onChange={e=>setFailChoice(e.target.value)} disabled={!!failure}>{systems.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="inject" onClick={inject} disabled={!!failure||progress===0||ended}>⚠ Inject failure</button>{failure?<><p className="dock-fault">FAILED AT DAY {Math.round(failure.at*3)}</p><p className="dock-consequence">{failureText}</p><button className="reset dock-reset" onClick={()=>setFailure(null)}>Clear failure</button></>:<p className="dock-ready">Start the mission to unlock fault injection.</p>}</aside></section>
    <section className="mission-console"><div className="section-heading"><div><p className="eyebrow">01 / LIVE MISSION CONSOLE</p><h2>{stage.name}</h2></div><div className="mission-day">SIMULATED DAY {missionDay} / 300</div></div><p className="phase-detail">{stage.detail}</p><div className="mission-track" aria-label="Mission phase timeline">{stages.map((s,i)=><button key={s.name} className={stage.name===s.name?"phase active":progress>=s.range[1]?"phase done":"phase"} onClick={()=>{if(!failure){setProgress(s.range[0]);setRunning(false)}}}><span>{String(i+1).padStart(2,"0")}</span><b>{s.name}</b><small>{s.day}</small></button>)}</div><div className="live-data"><article><span>DISTANCE TRAVELLED</span><b>{stage.distance}</b><small>{stage.action}</small></article><article><span>DISTANCE FROM EARTH</span><b>{stage.earth}</b><small>Illustrative live position</small></article><article><span>DISTANCE FROM MARS</span><b>{stage.mars}</b><small>Illustrative live position</small></article><article><span>ORBITS / FUEL</span><b>{stage.orbit} · {stage.fuel}</b><small>Propellant estimate</small></article></div></section>
    <section className="systems-panel"><div className="section-heading"><div><p className="eyebrow">03 / CONNECTED SUBSYSTEMS</p><h2>Spacecraft health</h2></div><div className={failure?"health-pill danger":"health-pill"}>{failure?"▲ FAULT PROPAGATION":"● NOMINAL"}</div></div><div className="system-grid">{systems.map(s=><button key={s.id} onClick={()=>setSelected(s.id)} className={`system-card ${selected===s.id?"selected":""} ${health(s.id)<70?"affected":""}`}><div className="card-top"><span className="system-icon">{s.icon}</span><span className="health">{health(s.id)}%</span></div><strong>{s.name}</strong><div className="reading">{health(s.id)<30?"FAILED":health(s.id)<70?"LIMITED":"ONLINE"}</div><span>{s.job}</span><div className="meter"><i style={{width:`${health(s.id)}%`}}></i></div></button>)}</div><div className="selected-detail"><span className="detail-icon">{systems.find(s=>s.id===selected).icon}</span><div><b>{systems.find(s=>s.id===selected).name}</b><p><b>Job:</b> {systems.find(s=>s.id===selected).job} <b>If lost:</b> {systems.find(s=>s.id===selected).loss}</p></div></div></section>
    <section className="model-section"><div className="model-copy"><p className="eyebrow">ENGINEERING EXPLANATION</p><h2>Why this is a system</h2><p>This is a simplified model of the real mission. It uses inputs (sunlight and commands), connected processes (power, guidance, propulsion and communication), and outputs (telemetry and Mars observations).</p><p>It demonstrates system thinking: losing one component can damage more than one function, especially during a critical manoeuvre.</p></div><div className="model-links"><div><span>INPUT</span><b>Sunlight & commands</b></div><i>→</i><div><span>PROCESS</span><b>Satellite systems</b></div><i>→</i><div><span>OUTPUT</span><b>Data & images</b></div></div></section>
    <footer>Educational simulation • Mission phases use historical MOM milestones; changing telemetry is illustrative • Real MOM was declared non-operational in 2022.</footer>
  </main>;
}
createRoot(document.getElementById("root")).render(<App />);
