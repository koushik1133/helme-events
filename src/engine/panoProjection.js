/**
 * Exact rectilinear projection for a rotation-only spherical camera.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 360 viewer places the camera at the origin and only ever ROTATES it.
 * Parallax is caused exclusively by camera *translation*, so with translation
 * identically zero a flat billboard pinned at an angular position with an
 * angular size projects to exactly the same pixels a real 3D object would, for
 * every view direction and every zoom level. Overlay compositing here is not an
 * approximation of 3D — it is 3D, restricted to the only degree of freedom the
 * viewer has.
 *
 * The previous overlay code placed hotspots with a LINEAR map
 * (x = W/2 + dYaw/halfHfov * W/2). That is only correct at the exact centre of
 * the screen. Pannellum renders a perspective (gnomonic) projection, so the
 * true offset goes as tan(). At half-zoom off-centre the linear form is wrong by
 * ~10% of the half-width — roughly 60-70 px on a 1280 px viewport — and it also
 * ignores the yaw/pitch coupling entirely, so a card drifts off its object as
 * soon as the user looks up or down. Everything below is the exact form.
 *
 * Conventions (matching the equirect convention used by the plates):
 *   yaw   λ, degrees, 0 = straight ahead, +ve to the right
 *   pitch φ, degrees, 0 = horizon, +ve up
 *   unit direction  d = ( cosφ·sinλ, sinφ, −cosφ·cosλ )   (Y up, camera looks −Z)
 */

const DEG = Math.PI / 180;

/** Focal length in PIXELS for a horizontal field of view across `width` px. */
export function focalLength(hfovDeg, width) {
  return (width / 2) / Math.tan((hfovDeg * DEG) / 2);
}

/**
 * Vertical FOV implied by a horizontal FOV and the viewport aspect.
 * NOT hfov * H / W — that is only true for small angles.
 */
export function verticalFov(hfovDeg, width, height) {
  return (2 * Math.atan((height / width) * Math.tan((hfovDeg * DEG) / 2))) / DEG;
}

/** Unit direction for a (yaw, pitch) in degrees. */
export function direction(yawDeg, pitchDeg) {
  const l = yawDeg * DEG, p = pitchDeg * DEG;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), -Math.cos(p) * Math.cos(l)];
}

/**
 * World direction → camera space, for a camera rotated to (camYaw, camPitch).
 * d_c = Rx(−camPitch) · Ry(+camYaw) · d, which maps the camera's own forward
 * direction to (0, 0, −1).
 */
export function toCameraSpace([x, y, z], camYawDeg, camPitchDeg) {
  const cy = Math.cos(camYawDeg * DEG), sy = Math.sin(camYawDeg * DEG);
  const x1 =  x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(-camPitchDeg * DEG), sp = Math.sin(-camPitchDeg * DEG);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

/**
 * Project an angular anchor onto the viewport.
 *
 * @returns {{visible:boolean, x:number, y:number, focal:number, depth:number}}
 *   `depth` is |z_camera| — the cosine of the off-axis angle. It is the
 *   foreshortening factor a billboard at unit radius picks up, so a sprite of
 *   angular height θ occupies  2·focal·tan(θ/2)/depth  pixels on screen.
 */
export function projectAnchor(yawDeg, pitchDeg, cam, width, height) {
  const f = focalLength(cam.hfov, width);
  const [x, y, z] = toCameraSpace(direction(yawDeg, pitchDeg), cam.yaw, cam.pitch);
  // z < 0 is in front of the camera. Anything at or behind the camera plane has
  // no rectilinear image at all (projecting it yields a mirrored ghost).
  if (z >= -1e-6) return { visible: false, x: 0, y: 0, focal: f, depth: 0 };
  const depth = -z;
  return {
    visible: true,
    x: width / 2 + f * (x / depth),
    y: height / 2 - f * (y / depth),
    focal: f,
    depth
  };
}

/**
 * Angular height subtended by a real object.
 * @param {number} heightM    real height, metres
 * @param {number} distanceM  horizontal ground distance, metres
 */
export function angularHeight(heightM, distanceM) {
  return 2 * Math.atan(heightM / (2 * Math.max(0.25, distanceM)));  // radians
}

/**
 * Horizontal ground distance to a point where an object TOUCHES the floor,
 * derived from the tripod height alone: D = (h_cam − h_platform) / tan(−φ).
 * This is the whole reason no venue needs measuring — one number per capture.
 * Returns null when the anchor is at or above the horizon (no floor solution).
 */
export function groundDistance(floorPitchDeg, cameraHeightM = 1.5, platformHeightM = 0) {
  if (floorPitchDeg >= -0.5) return null;
  const drop = cameraHeightM - platformHeightM;
  if (drop <= 0) return null;
  return drop / Math.tan(-floorPitchDeg * DEG);
}

/** On-screen pixel height for an angular size at a given projection result. */
export function pixelHeight(angularRad, proj) {
  if (!proj?.visible) return 0;
  return (2 * proj.focal * Math.tan(angularRad / 2)) / proj.depth;
}
