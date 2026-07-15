# Mangalyaan Mission Systems Simulator

A classroom demonstration of a satellite as an engineering system. It shows six connected components, illustrative telemetry, and fault propagation.

## Run locally

```bash
python3 server.py
```

Open `http://localhost:8000` in a browser. No Python packages are required. The page uses React loaded from a CDN.

## Demo flow

1. Click **Start launch** and watch the slower (~90 second) mission move through four phases.
2. Pause at Earth-orbit building, Mars transfer, or Mars-orbit insertion.
3. Read the live simulated distance, orbit and fuel values.
4. Use the **Fault Control** panel beside the 3D spacecraft and click **Inject failure**.
5. Explain the fault consequence and affected connected systems.
6. Use **Restart** to run a different failure scenario.

The changing telemetry is intentionally illustrative for classroom use. The real Mars Orbiter Mission was declared non-operational after communication was lost following a long eclipse in April 2022.
