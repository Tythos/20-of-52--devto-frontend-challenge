/**
 * index.mjs
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import CATALOG from "./standish_catalog.json?raw";
import * as solarplanets from "solarplanets";

const spatialScale = 5e-1;
const MU_SUN_KM3PS2 = 1.327e11;

window.app = {
    "renderer": null,
    "scene": null,
    "camera": null,
    "controls": null,
    "raycaster": null,
    "mouse_pos": new THREE.Vector2(0, 0),
    "is_mouse_down": false,
    "clock": new Date(),
    "isPaused": false
};

const planets = [
    {
        "name": "Mercury",
        "radius_km": 2.4e3,
        "semiMajorAxis_km": 57.91e6,
        "orbitalPeriod_days": 87.9691,
        "approximateColor_hex": 0x666666
    }, {
        "name": "Venus",
        "radius_km": 6.051e3,
        "semiMajorAxis_km": 108.21e6,
        "orbitalPeriod_days": 224.701,
        "approximateColor_hex": 0xaaaa77
    }, {
        "name": "Earth",
        "radius_km": 6.3781e3,
        "semiMajorAxis_km": 1.49898023e8,
        "orbitalPeriod_days": 365.256,
        "approximateColor_hex": 0x33bb33
    }, {
        "name": "Mars",
        "radius_km": 3.389e3,
        "semiMajorAxis_km": 2.27939366e8,
        "orbitalPeriod_days": 686.980,
        "approximateColor_hex": 0xbb3333
    }, {
        "name": "Jupiter",
        "radius_km": 6.9911e4,
        "semiMajorAxis_km": 7.78479e8,
        "orbitalPeriod_days": 4332.59,
        "approximateColor_hex": 0xaa7722
    }, {
        "name": "Saturn",
        "radius_km": 5.8232e4,
        "semiMajorAxis_km": 1.43353e9,
        "orbitalPeriod_days": 10755.7,
        "approximateColor_hex": 0xccaa55
    }, {
        "name": "Uranus",
        "radius_km": 2.5362e4,
        "semiMajorAxis_km": 2.870972e9,
        "orbitalPeriod_days": 30688.5,
        "approximateColor_hex": 0x7777ff
    }, {
        "name": "Neptune",
        "radius_km": 2.4622e4,
        "semiMajorAxis_km": 4.50e9,
        "orbitalPeriod_days": 60195,
        "approximateColor_hex": 0x4422aa
    }
];

let catalog = {};

function buildPlanet(radius, initialPosition, angularVelocity, color, name) {
    const geometry = new THREE.SphereGeometry(1e2 * radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({ "color": color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
        spatialScale * initialPosition.x,
        spatialScale * initialPosition.y,
        spatialScale * initialPosition.z
    );
    mesh.name = name;
    mesh.scale.set(2, 2, 2);
    return mesh;
}

function getJdFromDatetime(dt) {
    // calculate julian day number JD
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const H = dt.getUTCHours();
    const M = dt.getUTCMinutes();
    const S = dt.getUTCSeconds() + dt.getUTCMilliseconds() * 1e-3;
    const J0 = solarplanets.getJ0FromDatevec(y, m, d);
    const UT = solarplanets.getUtFromTimevec(H, M, S);
    const JD = solarplanets.getJdFromDateTime(J0, UT);
    return JD;
}

function buildOrbitTrace(radius, name) {
    let ce = catalog[name.toLowerCase()];
    const points = [];
    const n = 1e2;

    if (!ce) {
        // fallback for when not in catalog
        for (var i = 0; i < (n + 1); i += 1) {
            const ang_rad = 2 * Math.PI * i / n;
            points.push(new THREE.Vector3(
                spatialScale * radius * Math.cos(ang_rad),
                spatialScale * radius * Math.sin(ang_rad),
                spatialScale * 0.0
            ));
        }
    } else {
        // sampling one orbital period to compute points from catalog elements
        const au2km = 1.49597871e8;
        const now = new Date();
        const JD = getJdFromDatetime(now);
        const T0 = solarplanets.getJulianCenturies(JD);
        const a_km = solarplanets.getCurrentElements(ce.a_au * au2km, ce.da_au * au2km, T0);
        const T_s = 2 * Math.PI * Math.sqrt(Math.pow(a_km, 3) / MU_SUN_KM3PS2);
        for (var i = 0; i < (n + 1); i += 1) {
            const dt_s = T_s * i / n;
            const t_dt = new Date(now.valueOf() + dt_s * 1e3);
            const [rHcec_km, _] = solarplanets.getRvFromElementsDatetime(ce, t_dt);
            points.push(new THREE.Vector3(
                spatialScale * rHcec_km[0],
                spatialScale * rHcec_km[1],
                spatialScale * rHcec_km[2]
            ));
        }
    }

    // create line from points geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        "color": 0x555555
    });
    const line = new THREE.Line(geometry, material);
    return line;
}

function openDialog(name) {
    const article = window.document.body.querySelector(`.${name.toLowerCase()}`);
    if (!article) { return; }
    const dialog = window.document.body.querySelector(".DialogContent");
    dialog.innerHTML = article.innerHTML;
    const dbg = dialog.parentElement;
    dbg.style.display = "block";
}

function processCollision(collision) {
    const name = collision.object.name;
    const names = planets.map(p => p.name);
    if (name !== "" && names.includes(name)) {
        if (window.app.is_mouse_down) {
            openDialog(name);
        }
    }
}

function animate(time) {
    let now = window.app.clock;
    planets.forEach(planet => {
        let sgn = window.app.scene.getObjectByName(planet.name);
        let ce = catalog[planet.name.toLowerCase()];
        if (sgn && ce) {
            const [rHcec_km, _] = solarplanets.getRvFromElementsDatetime(ce, now);
            sgn.position.set(
                spatialScale * rHcec_km[0],
                spatialScale * rHcec_km[1],
                spatialScale * rHcec_km[2]
            );
        }
    });

    window.app.controls.update();
    window.app.renderer.render(window.app.scene, window.app.camera);
    window.app.raycaster.setFromCamera(window.app.mouse_pos, window.app.camera);
    const intersections = window.app.raycaster.intersectObjects(window.app.scene.children);
    if (intersections.length > 0) {
        intersections.forEach(processCollision);
    }

    // update clock if not paused
    if (!window.app.isPaused) {
        window.app.clock = new Date();
    }
}

function onPointerMove(event) {
    window.app.mouse_pos.x = (event.clientX / window.innerWidth) * 2 - 1;
    window.app.mouse_pos.y = (event.clientY / window.innerHeight) * 2 - 1;
}

function onMouseDown(event) {
    window.app.is_mouse_down = true;
}

function onMouseUp(event) {
    window.app.is_mouse_down = false;
}

function onDialogClicked(event) {
    event.target.style.display = "none";
}

function onWindowLoad(event) {
    // parse catalog
    catalog = JSON.parse(CATALOG);

    // camera instantiation
    const width = window.innerWidth;
    const height = window.innerHeight;
    window.app.camera = new THREE.PerspectiveCamera(60, width / height, 8e9, 8e3);
    window.app.camera.position.z = 1e7;
    window.app.camera.up.set(0, 0, 1.0);

    // scene instantiation
    window.app.scene = new THREE.Scene();
    window.app.scene.add(new THREE.AxesHelper(1e6));

    // construct sun manually
    const geometry = new THREE.SphereGeometry(7e5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ "color": 0xffff55 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Sun";
    window.app.scene.add(mesh);

    // planet constructor is: radius, initial position, angular velocity, color
    planets.forEach(p => {
        window.app.scene.add(buildPlanet(p.radius_km, new THREE.Vector3(p.semiMajorAxis_km, 0, 0), 2 * Math.PI / 86400 / p.orbitalPeriod_days, p.approximateColor_hex, p.name));
        window.app.scene.add(buildOrbitTrace(p.semiMajorAxis_km, p.name));
    });

    // renderer instantiation
    window.app.renderer = new THREE.WebGLRenderer({
        "antialias": true
    });
    window.app.renderer.setSize(width, height);
    window.app.renderer.setAnimationLoop(animate);
    document.body.appendChild(window.app.renderer.domElement);

    // controls instantiation
    window.app.controls = new OrbitControls(window.app.camera, window.app.renderer.domElement);
    window.app.raycaster = new THREE.Raycaster();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.document.body.querySelector(".DialogBackground").addEventListener("click", onDialogClicked);
}

window.addEventListener("load", onWindowLoad);
