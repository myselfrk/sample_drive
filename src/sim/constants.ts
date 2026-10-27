// Physics + track constants. Piecewise-constant on purpose: the v-t graph is made of clean straight
// segments (slope +2 / 0 / -5), so students can read slopes and areas off it exactly.
export const ACCEL = 2.0; // m/s^2, automatic, brake released
export const V_MAX = 16; // m/s (57.6 km/h) - then cruise, a = 0
export const BRAKE_DECEL = 5.0; // m/s^2, brake held (v clamps at 0)
export const DT = 1 / 120; // fixed physics step, s
export const SAMPLE_EVERY = 6; // steps -> 0.05 s graph sample interval
export const SAMPLE_DT = DT * SAMPLE_EVERY;

export const SIGNAL_LINES = [150, 300, 450, 600]; // stop-line x positions, m
export const POLE_OFFSET = 3; // pole stands this far past the stop line
export const FINISH_X = 700;
export const CAR_FRONT = 2.3; // front bumper offset from the car origin (car.glb is 4.7 m long)
export const YELLOW_DURATION = 2.0;

export const MS_TO_KMH = 3.6;
