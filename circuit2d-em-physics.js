/*
 * Circuit2D_EM — independent electromagnetism physics layer
 * Purpose: advanced EM math helpers for future features, without touching the existing solver/UI.
 * Exposes: window.Circuit2D_EM
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var EPS = 1e-12;
  var TAU = Math.PI * 2;

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isFiniteNumber(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      var trimmed = value.trim().replace(',', '.');
      if (!trimmed) return NaN;
      return Number(trimmed);
    }
    return Number(value);
  }

  function ok(value, extra) {
    var out = { ok: true, value: value };
    if (extra) {
      for (var k in extra) {
        if (hasOwn(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }

  function fail(reason, extra) {
    var out = { ok: false, reason: reason || 'invalid_input' };
    if (extra) {
      for (var k in extra) {
        if (hasOwn(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }

  function safeNumber(value, options) {
    options = options || {};
    var n = toNumber(value);
    var name = options.name || 'value';
    if (!isFiniteNumber(n)) return fail('invalid_number:' + name);
    if (options.min != null && n < options.min) return fail('number_below_min:' + name, { min: options.min, value: n });
    if (options.max != null && n > options.max) return fail('number_above_max:' + name, { max: options.max, value: n });
    if (options.nonZero && Math.abs(n) <= EPS) return fail('zero_not_allowed:' + name);
    return ok(n);
  }

  function unwrapNumber(value, name, min, max, nonZero) {
    var r = safeNumber(value, { name: name, min: min, max: max, nonZero: !!nonZero });
    return r.ok ? r.value : r;
  }

  function clamp(value, min, max) {
    var n = toNumber(value);
    var lo = toNumber(min);
    var hi = toNumber(max);
    if (!isFiniteNumber(n) || !isFiniteNumber(lo) || !isFiniteNumber(hi)) return NaN;
    if (lo > hi) {
      var tmp = lo;
      lo = hi;
      hi = tmp;
    }
    return Math.max(lo, Math.min(hi, n));
  }

  function degToRad(deg) {
    return toNumber(deg) * Math.PI / 180;
  }

  function radToDeg(rad) {
    return toNumber(rad) * 180 / Math.PI;
  }

  function normalizeUnit(unit) {
    return String(unit == null ? '' : unit)
      .trim()
      .replace(/µ/g, 'μ')
      .replace(/²/g, '2')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function asVec2(v, name) {
    name = name || 'vector';
    if (Array.isArray(v)) {
      if (v.length < 2) return fail('invalid_vector2:' + name);
      var ax = safeNumber(v[0], { name: name + '.x' });
      if (!ax.ok) return ax;
      var ay = safeNumber(v[1], { name: name + '.y' });
      if (!ay.ok) return ay;
      return ok({ x: ax.value, y: ay.value });
    }
    if (!v || typeof v !== 'object') return fail('invalid_vector2:' + name);
    var x = safeNumber(v.x, { name: name + '.x' });
    if (!x.ok) return x;
    var y = safeNumber(v.y, { name: name + '.y' });
    if (!y.ok) return y;
    return ok({ x: x.value, y: y.value });
  }

  function asVec3(v, name) {
    name = name || 'vector';
    if (Array.isArray(v)) {
      if (v.length < 2) return fail('invalid_vector3:' + name);
      var ax = safeNumber(v[0], { name: name + '.x' });
      if (!ax.ok) return ax;
      var ay = safeNumber(v[1], { name: name + '.y' });
      if (!ay.ok) return ay;
      var az = safeNumber(v.length > 2 ? v[2] : 0, { name: name + '.z' });
      if (!az.ok) return az;
      return ok({ x: ax.value, y: ay.value, z: az.value });
    }
    if (!v || typeof v !== 'object') return fail('invalid_vector3:' + name);
    var x = safeNumber(v.x, { name: name + '.x' });
    if (!x.ok) return x;
    var y = safeNumber(v.y, { name: name + '.y' });
    if (!y.ok) return y;
    var z = safeNumber(v.z == null ? 0 : v.z, { name: name + '.z' });
    if (!z.ok) return z;
    return ok({ x: x.value, y: y.value, z: z.value });
  }

  function magnitude2Value(a) {
    return Math.sqrt(a.x * a.x + a.y * a.y);
  }

  function magnitude3Value(a) {
    return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  }

  function vec2FromMagnitudeAngle(magnitude, angleDeg) {
    var m = safeNumber(magnitude, { name: 'magnitude' });
    if (!m.ok) return m;
    var a = safeNumber(angleDeg == null ? 0 : angleDeg, { name: 'angleDeg' });
    if (!a.ok) return a;
    var rad = degToRad(a.value);
    return ok({ x: m.value * Math.cos(rad), y: m.value * Math.sin(rad) }, {
      magnitude: Math.abs(m.value),
      angleDeg: a.value
    });
  }

  function dot2Value(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function dot3Value(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  var vec2 = {
    add: function (a, b) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var vb = asVec2(b, 'b');
      if (!vb.ok) return vb;
      return ok({ x: va.value.x + vb.value.x, y: va.value.y + vb.value.y });
    },
    sub: function (a, b) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var vb = asVec2(b, 'b');
      if (!vb.ok) return vb;
      return ok({ x: va.value.x - vb.value.x, y: va.value.y - vb.value.y });
    },
    scale: function (a, scalar) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var s = safeNumber(scalar, { name: 'scalar' });
      if (!s.ok) return s;
      return ok({ x: va.value.x * s.value, y: va.value.y * s.value });
    },
    dot: function (a, b) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var vb = asVec2(b, 'b');
      if (!vb.ok) return vb;
      return ok(dot2Value(va.value, vb.value));
    },
    cross: function (a, b) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var vb = asVec2(b, 'b');
      if (!vb.ok) return vb;
      return ok(va.value.x * vb.value.y - va.value.y * vb.value.x, { component: 'z' });
    },
    magnitude: function (a) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      return ok(magnitude2Value(va.value));
    },
    normalize: function (a) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var m = magnitude2Value(va.value);
      if (m <= EPS) return fail('zero_vector:a');
      return ok({ x: va.value.x / m, y: va.value.y / m }, { magnitude: m });
    },
    angleBetween: function (a, b) {
      var va = asVec2(a, 'a');
      if (!va.ok) return va;
      var vb = asVec2(b, 'b');
      if (!vb.ok) return vb;
      var ma = magnitude2Value(va.value);
      var mb = magnitude2Value(vb.value);
      if (ma <= EPS || mb <= EPS) return fail('zero_vector');
      var c = clamp(dot2Value(va.value, vb.value) / (ma * mb), -1, 1);
      var rad = Math.acos(c);
      return ok(rad, { rad: rad, deg: radToDeg(rad), cos: c });
    }
  };

  var vec3 = {
    add: function (a, b) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var vb = asVec3(b, 'b');
      if (!vb.ok) return vb;
      return ok({ x: va.value.x + vb.value.x, y: va.value.y + vb.value.y, z: va.value.z + vb.value.z });
    },
    sub: function (a, b) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var vb = asVec3(b, 'b');
      if (!vb.ok) return vb;
      return ok({ x: va.value.x - vb.value.x, y: va.value.y - vb.value.y, z: va.value.z - vb.value.z });
    },
    scale: function (a, scalar) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var s = safeNumber(scalar, { name: 'scalar' });
      if (!s.ok) return s;
      return ok({ x: va.value.x * s.value, y: va.value.y * s.value, z: va.value.z * s.value });
    },
    dot: function (a, b) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var vb = asVec3(b, 'b');
      if (!vb.ok) return vb;
      return ok(dot3Value(va.value, vb.value));
    },
    cross: function (a, b) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var vb = asVec3(b, 'b');
      if (!vb.ok) return vb;
      return ok({
        x: va.value.y * vb.value.z - va.value.z * vb.value.y,
        y: va.value.z * vb.value.x - va.value.x * vb.value.z,
        z: va.value.x * vb.value.y - va.value.y * vb.value.x
      });
    },
    magnitude: function (a) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      return ok(magnitude3Value(va.value));
    },
    normalize: function (a) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var m = magnitude3Value(va.value);
      if (m <= EPS) return fail('zero_vector:a');
      return ok({ x: va.value.x / m, y: va.value.y / m, z: va.value.z / m }, { magnitude: m });
    },
    angleBetween: function (a, b) {
      var va = asVec3(a, 'a');
      if (!va.ok) return va;
      var vb = asVec3(b, 'b');
      if (!vb.ok) return vb;
      var ma = magnitude3Value(va.value);
      var mb = magnitude3Value(vb.value);
      if (ma <= EPS || mb <= EPS) return fail('zero_vector');
      var c = clamp(dot3Value(va.value, vb.value) / (ma * mb), -1, 1);
      var rad = Math.acos(c);
      return ok(rad, { rad: rad, deg: radToDeg(rad), cos: c });
    }
  };

  var units = {
    safeNumber: safeNumber,
    clamp: clamp,
    degToRad: function (deg) {
      var r = safeNumber(deg, { name: 'deg' });
      return r.ok ? ok(degToRad(r.value)) : r;
    },
    radToDeg: function (rad) {
      var r = safeNumber(rad, { name: 'rad' });
      return r.ok ? ok(radToDeg(r.value)) : r;
    },
    chargeToC: function (value, unit) {
      var n = safeNumber(value, { name: 'charge' });
      if (!n.ok) return n;
      var u = normalizeUnit(unit || 'C');
      var factor = null;
      if (u === 'c' || u === 'coulomb' || u === 'coulombs') factor = 1;
      else if (u === 'mc' || u === 'millic' || u === 'millicoulomb' || u === 'millicoulombs') factor = 1e-3;
      else if (u === 'μc' || u === 'uc' || u === 'microc' || u === 'microcoulomb' || u === 'microcoulombs') factor = 1e-6;
      else if (u === 'nc' || u === 'nanoc' || u === 'nanocoulomb' || u === 'nanocoulombs') factor = 1e-9;
      else return fail('unsupported_charge_unit', { unit: unit });
      return ok(n.value * factor, { unit: 'C' });
    },
    bFieldToT: function (value, unit) {
      var n = safeNumber(value, { name: 'B' });
      if (!n.ok) return n;
      var u = normalizeUnit(unit || 'T');
      var factor = null;
      if (u === 't' || u === 'tesla') factor = 1;
      else if (u === 'mt' || u === 'millitesla') factor = 1e-3;
      else if (u === 'μt' || u === 'ut' || u === 'microtesla') factor = 1e-6;
      else return fail('unsupported_b_field_unit', { unit: unit });
      return ok(n.value * factor, { unit: 'T' });
    },
    areaToM2: function (value, unit) {
      var n = safeNumber(value, { name: 'area' });
      if (!n.ok) return n;
      var u = normalizeUnit(unit || 'm2');
      var factor = null;
      if (u === 'm2' || u === 'm^2' || u === 'sqm') factor = 1;
      else if (u === 'cm2' || u === 'cm^2' || u === 'sqcm') factor = 1e-4;
      else if (u === 'mm2' || u === 'mm^2' || u === 'sqmm') factor = 1e-6;
      else return fail('unsupported_area_unit', { unit: unit });
      return ok(n.value * factor, { unit: 'm2' });
    },
    lengthToM: function (value, unit) {
      var n = safeNumber(value, { name: 'length' });
      if (!n.ok) return n;
      var u = normalizeUnit(unit || 'm');
      var factor = null;
      if (u === 'm' || u === 'meter' || u === 'metre' || u === 'meters' || u === 'metres') factor = 1;
      else if (u === 'cm' || u === 'centimeter' || u === 'centimetre' || u === 'centimeters' || u === 'centimetres') factor = 1e-2;
      else if (u === 'mm' || u === 'millimeter' || u === 'millimetre' || u === 'millimeters' || u === 'millimetres') factor = 1e-3;
      else return fail('unsupported_length_unit', { unit: unit });
      return ok(n.value * factor, { unit: 'm' });
    },
    rpmToRadPerSec: function (rpm) {
      var n = safeNumber(rpm, { name: 'rpm' });
      return n.ok ? ok(n.value * TAU / 60, { unit: 'rad/s' }) : n;
    },
    hzToRadPerSec: function (hz) {
      var n = safeNumber(hz, { name: 'Hz' });
      return n.ok ? ok(n.value * TAU, { unit: 'rad/s' }) : n;
    },
    radPerSecToHz: function (radPerSec) {
      var n = safeNumber(radPerSec, { name: 'radPerSec' });
      return n.ok ? ok(n.value / TAU, { unit: 'Hz' }) : n;
    },
    angularSpeedToRadPerSec: function (args) {
      args = args || {};
      var n = safeNumber(args.value, { name: 'angularSpeed' });
      if (!n.ok) return n;
      var u = normalizeUnit(args.unit || 'rad/s');
      if (u === 'rad/s' || u === 'rads' || u === 'radpersec') return ok(n.value, { unit: 'rad/s' });
      if (u === 'hz' || u === 's-1' || u === '1/s') return ok(n.value * TAU, { unit: 'rad/s' });
      if (u === 'rpm' || u === 'rev/min') return ok(n.value * TAU / 60, { unit: 'rad/s' });
      return fail('unsupported_angular_speed_unit', { unit: args.unit });
    },
    formatScientific: function (value, options) {
      options = options || {};
      var n = safeNumber(value, { name: 'value' });
      if (!n.ok) return n;
      var digitsRaw = options.digits == null ? 3 : toNumber(options.digits);
      var digits = isFiniteNumber(digitsRaw) ? Math.max(0, Math.min(12, Math.floor(digitsRaw))) : 3;
      var text;
      if (Math.abs(n.value) > 0 && (Math.abs(n.value) < 1e-3 || Math.abs(n.value) >= 1e4)) text = n.value.toExponential(digits);
      else text = Number(n.value.toPrecision(Math.max(1, digits + 1))).toString();
      if (options.unit) text += ' ' + options.unit;
      return ok(text);
    }
  };

  function readChargeC(args) {
    args = args || {};
    if (args.qC != null) return safeNumber(args.qC, { name: 'qC' });
    if (args.chargeC != null) return safeNumber(args.chargeC, { name: 'chargeC' });
    if (args.q != null) return units.chargeToC(args.q, args.qUnit || args.unit || 'C');
    if (args.charge != null) return units.chargeToC(args.charge, args.chargeUnit || args.unit || 'C');
    return fail('missing_charge');
  }

  function readBT(args) {
    args = args || {};
    if (args.B_T != null) return safeNumber(args.B_T, { name: 'B_T' });
    if (args.BT != null) return safeNumber(args.BT, { name: 'BT' });
    if (args.B != null && typeof args.B !== 'object') return units.bFieldToT(args.B, args.BUnit || args.unit || 'T');
    if (args.magnitude != null) return units.bFieldToT(args.magnitude, args.BUnit || args.unit || 'T');
    return fail('missing_B');
  }

  function readAreaM2(args) {
    args = args || {};
    if (args.areaM2 != null) return safeNumber(args.areaM2, { name: 'areaM2', min: 0 });
    if (args.area != null) return units.areaToM2(args.area, args.areaUnit || args.unit || 'm2');
    return fail('missing_area');
  }

  function readLengthM(args) {
    args = args || {};
    if (args.lengthM != null) return safeNumber(args.lengthM, { name: 'lengthM', min: 0 });
    if (args.length != null) return units.lengthToM(args.length, args.lengthUnit || args.unit || 'm');
    return fail('missing_length');
  }

  function readTurns(args) {
    args = args || {};
    var raw = args.turns == null ? 1 : args.turns;
    var n = safeNumber(raw, { name: 'turns', min: 0 });
    if (!n.ok) return n;
    return ok(Math.floor(n.value));
  }

  var fields = {
    uniformElectricField: function (args) {
      args = args || {};
      var v = vec2FromMagnitudeAngle(args.magnitude, args.angleDeg == null ? 0 : args.angleDeg);
      if (!v.ok) return v;
      var out = { x: v.value.x, y: v.value.y, z: 0 };
      return ok(out, { magnitude: Math.abs(toNumber(args.magnitude)), unit: args.unit || 'N/C', angleDeg: args.angleDeg == null ? 0 : toNumber(args.angleDeg) });
    },
    electricForce: function (args) {
      args = args || {};
      var q = readChargeC(args);
      if (!q.ok) return q;
      var E = asVec3(args.EVector || args.E || args.fieldVector, 'EVector');
      if (!E.ok) return E;
      var F = { x: q.value * E.value.x, y: q.value * E.value.y, z: q.value * E.value.z };
      return ok(F, { magnitude: magnitude3Value(F), unit: 'N', qC: q.value });
    },
    electricPotentialDifferenceUniform: function (args) {
      args = args || {};
      if (args.EVector || args.E) {
        var E = asVec3(args.EVector || args.E, 'EVector');
        if (!E.ok) return E;
        var d = asVec3(args.displacementVector || args.dr || args.dVector, 'displacementVector');
        if (!d.ok) return d;
        var deltaV = -dot3Value(E.value, d.value);
        return ok(deltaV, { deltaV_V: deltaV, convention: 'V_final_minus_V_initial' });
      }
      var Emag = safeNumber(args.magnitude != null ? args.magnitude : args.E, { name: 'E_magnitude' });
      if (!Emag.ok) return Emag;
      var dist = readLengthM({ lengthM: args.distanceM, length: args.distance, lengthUnit: args.lengthUnit || 'm' });
      if (!dist.ok) return dist;
      var theta = safeNumber(args.thetaDeg == null ? 0 : args.thetaDeg, { name: 'thetaDeg' });
      if (!theta.ok) return theta;
      var delta = -Emag.value * dist.value * Math.cos(degToRad(theta.value));
      return ok(delta, { deltaV_V: delta, convention: 'V_final_minus_V_initial' });
    },
    uniformMagneticField: function (args) {
      args = args || {};
      var B = readBT(args);
      if (!B.ok) return B;
      var direction = String(args.direction || '').trim().toLowerCase();
      var axis = String(args.axis || '').trim().toLowerCase();
      var vector;
      if (direction === 'outofpage' || direction === 'out' || direction === '+z') vector = { x: 0, y: 0, z: B.value };
      else if (direction === 'intopage' || direction === 'in' || direction === '-z') vector = { x: 0, y: 0, z: -B.value };
      else if (axis === 'x') vector = { x: B.value, y: 0, z: 0 };
      else if (axis === 'y') vector = { x: 0, y: B.value, z: 0 };
      else if (axis === 'z') vector = { x: 0, y: 0, z: B.value };
      else {
        var angle = safeNumber(args.angleDeg == null ? 0 : args.angleDeg, { name: 'angleDeg' });
        if (!angle.ok) return angle;
        var rad = degToRad(angle.value);
        vector = { x: B.value * Math.cos(rad), y: B.value * Math.sin(rad), z: 0 };
      }
      return ok(vector, { magnitude: Math.abs(B.value), unit: 'T' });
    },
    magneticFieldVector2D: function (args) {
      return fields.uniformMagneticField(args || {});
    },
    safeBFieldMagnitude: function (args) {
      args = args || {};
      if (args.BVector || args.B && typeof args.B === 'object') {
        var v = asVec3(args.BVector || args.B, 'BVector');
        if (!v.ok) return v;
        return ok(magnitude3Value(v.value), { unit: 'T' });
      }
      var B = readBT(args);
      return B.ok ? ok(Math.abs(B.value), { unit: 'T' }) : B;
    }
  };

  var forces = {
    electricLorentzForce: function (args) {
      return fields.electricForce(args || {});
    },
    magneticLorentzForce: function (args) {
      args = args || {};
      var q = readChargeC(args);
      if (!q.ok) return q;
      var v = asVec3(args.vVector || args.v || args.velocityVector, 'vVector');
      if (!v.ok) return v;
      var B = asVec3(args.BVector || args.B || args.fieldVector, 'BVector');
      if (!B.ok) return B;
      var vxB = vec3.cross(v.value, B.value);
      if (!vxB.ok) return vxB;
      var F = { x: q.value * vxB.value.x, y: q.value * vxB.value.y, z: q.value * vxB.value.z };
      return ok(F, { magnitude: magnitude3Value(F), unit: 'N', qC: q.value, vCrossB: vxB.value });
    },
    lorentzForce: function (args) {
      args = args || {};
      var q = readChargeC(args);
      if (!q.ok) return q;
      var E = asVec3(args.EVector || args.E || { x: 0, y: 0, z: 0 }, 'EVector');
      if (!E.ok) return E;
      var v = asVec3(args.vVector || args.v || args.velocityVector || { x: 0, y: 0, z: 0 }, 'vVector');
      if (!v.ok) return v;
      var B = asVec3(args.BVector || args.B || { x: 0, y: 0, z: 0 }, 'BVector');
      if (!B.ok) return B;
      var vxB = vec3.cross(v.value, B.value);
      if (!vxB.ok) return vxB;
      var combined = { x: E.value.x + vxB.value.x, y: E.value.y + vxB.value.y, z: E.value.z + vxB.value.z };
      var F = { x: q.value * combined.x, y: q.value * combined.y, z: q.value * combined.z };
      return ok(F, { magnitude: magnitude3Value(F), unit: 'N', qC: q.value, electricField: E.value, vCrossB: vxB.value });
    },
    laplaceForce: function (args) {
      args = args || {};
      var I = safeNumber(args.currentA, { name: 'currentA' });
      if (!I.ok) return I;
      var L = readLengthM(args);
      if (!L.ok) return L;
      var B = readBT(args);
      if (!B.ok) return B;
      var theta = safeNumber(args.thetaDeg == null ? 90 : args.thetaDeg, { name: 'thetaDeg' });
      if (!theta.ok) return theta;
      var signed = I.value * L.value * B.value * Math.sin(degToRad(theta.value));
      return ok(Math.abs(signed), { forceN: Math.abs(signed), signedForceN: signed, unit: 'N' });
    },
    laplaceForceVector2D: function (args) {
      args = args || {};
      var I = safeNumber(args.currentA, { name: 'currentA' });
      if (!I.ok) return I;
      var lengthVector;
      if (args.lengthVector || args.LVector) {
        var lv = asVec3(args.lengthVector || args.LVector, 'lengthVector');
        if (!lv.ok) return lv;
        lengthVector = lv.value;
      } else {
        var L = readLengthM(args);
        if (!L.ok) return L;
        var angle = safeNumber(args.wireAngleDeg == null ? 0 : args.wireAngleDeg, { name: 'wireAngleDeg' });
        if (!angle.ok) return angle;
        var rad = degToRad(angle.value);
        lengthVector = { x: L.value * Math.cos(rad), y: L.value * Math.sin(rad), z: 0 };
      }
      var BVector;
      if (args.BVector || args.B && typeof args.B === 'object') {
        var bv = asVec3(args.BVector || args.B, 'BVector');
        if (!bv.ok) return bv;
        BVector = bv.value;
      } else {
        var bf = fields.uniformMagneticField({ B_T: args.B_T != null ? args.B_T : args.B, BUnit: args.BUnit, direction: args.direction || args.BDirection, angleDeg: args.BAngleDeg, axis: args.BAxis });
        if (!bf.ok) return bf;
        BVector = bf.value;
      }
      var LxB = vec3.cross(lengthVector, BVector);
      if (!LxB.ok) return LxB;
      var F = { x: I.value * LxB.value.x, y: I.value * LxB.value.y, z: I.value * LxB.value.z };
      return ok(F, { magnitude: magnitude3Value(F), unit: 'N', lengthVector: lengthVector, BVector: BVector });
    }
  };

  var flux = {
    magneticFlux: function (args) {
      args = args || {};
      if (args.BVector && args.areaVector) {
        var Bv = asVec3(args.BVector, 'BVector');
        if (!Bv.ok) return Bv;
        var Av = asVec3(args.areaVector, 'areaVector');
        if (!Av.ok) return Av;
        var phiDot = dot3Value(Bv.value, Av.value);
        return ok(phiDot, { phi_Wb: phiDot, unit: 'Wb' });
      }
      var B = readBT(args);
      if (!B.ok) return B;
      var A = readAreaM2(args);
      if (!A.ok) return A;
      var theta = safeNumber(args.thetaDeg == null ? 0 : args.thetaDeg, { name: 'thetaDeg' });
      if (!theta.ok) return theta;
      var phi = B.value * A.value * Math.cos(degToRad(theta.value));
      return ok(phi, { phi_Wb: phi, unit: 'Wb' });
    },
    magneticFluxLinkage: function (args) {
      args = args || {};
      var N = readTurns(args);
      if (!N.ok) return N;
      var phi;
      if (args.phi != null || args.phi_Wb != null) {
        phi = safeNumber(args.phi_Wb != null ? args.phi_Wb : args.phi, { name: 'phi' });
      } else {
        phi = flux.magneticFlux(args);
      }
      if (!phi.ok) return phi;
      var linkage = N.value * phi.value;
      return ok(linkage, { fluxLinkage_WbTurns: linkage, unit: 'Wb·turns', turns: N.value, phi_Wb: phi.value });
    },
    fluxChange: function (args) {
      args = args || {};
      var p1 = safeNumber(args.phi1, { name: 'phi1' });
      if (!p1.ok) return p1;
      var p2 = safeNumber(args.phi2, { name: 'phi2' });
      if (!p2.ok) return p2;
      var dt = safeNumber(args.dt, { name: 'dt', min: EPS });
      if (!dt.ok) return dt;
      var dPhi = p2.value - p1.value;
      return ok(dPhi, { deltaPhi_Wb: dPhi, dt_s: dt.value, rate_WbPerS: dPhi / dt.value });
    }
  };

  function normalizeSample(sample, index) {
    if (Array.isArray(sample)) {
      if (sample.length < 2) return fail('invalid_flux_sample:' + index);
      var tA = safeNumber(sample[0], { name: 'samples[' + index + '].t' });
      if (!tA.ok) return tA;
      var pA = safeNumber(sample[1], { name: 'samples[' + index + '].phi' });
      if (!pA.ok) return pA;
      return ok({ t: tA.value, phi: pA.value });
    }
    if (!sample || typeof sample !== 'object') return fail('invalid_flux_sample:' + index);
    var t = safeNumber(sample.t != null ? sample.t : sample.time, { name: 'samples[' + index + '].t' });
    if (!t.ok) return t;
    var phi = safeNumber(sample.phi != null ? sample.phi : sample.phi_Wb, { name: 'samples[' + index + '].phi' });
    if (!phi.ok) return phi;
    return ok({ t: t.value, phi: phi.value });
  }


  function computeFaradayLenzIndependent(args) {
    args = args || {};
    var N = readTurns(args);
    if (!N.ok) return N;
    var prevRaw = args.previousPhi_Wb != null ? args.previousPhi_Wb :
      (args.previousPhi != null ? args.previousPhi :
        (args.phiPrevious != null ? args.phiPrevious :
          (args.phi1 != null ? args.phi1 : args.prevPhi)));
    var curRaw = args.currentPhi_Wb != null ? args.currentPhi_Wb :
      (args.currentPhi != null ? args.currentPhi :
        (args.phiCurrent != null ? args.phiCurrent :
          (args.phi2 != null ? args.phi2 : args.phi)));
    var prev = safeNumber(prevRaw, { name: 'previousPhi' });
    if (!prev.ok) return prev;
    var cur = safeNumber(curRaw, { name: 'currentPhi' });
    if (!cur.ok) return cur;
    var dtInput = args.dt_s != null ? args.dt_s : (args.dt != null ? args.dt : args.deltaTime_s);
    var dtCheck = safeNumber(dtInput, { name: 'dt' });
    if (!dtCheck.ok) return dtCheck;

    var warnings = [];
    var minDt = toNumber(args.minDt_s == null ? 1e-6 : args.minDt_s);
    if (!isFiniteNumber(minDt) || minDt <= 0) minDt = 1e-6;
    var jitter = Math.abs(toNumber(args.jitterPhi_Wb == null ? 1e-12 : args.jitterPhi_Wb));
    if (!isFiniteNumber(jitter)) jitter = 1e-12;
    var maxAbsEmf = Math.abs(toNumber(args.maxAbsEmf_V == null ? 500 : args.maxAbsEmf_V));
    if (!isFiniteNumber(maxAbsEmf) || maxAbsEmf <= 0) maxAbsEmf = 500;

    var dt = dtCheck.value;
    var dPhi = cur.value - prev.value;
    var dPhiRaw = dPhi;
    var emfRaw = 0;
    var emf = 0;
    var clamped = false;
    var fluxChangeSign = 0;
    var inducedFieldSign = 0;
    var direction = 'none';
    var reason = 'no_flux_change';

    if (dt <= minDt) {
      warnings.push(dt <= 0 ? 'dt_zero' : 'dt_too_small');
      dt = Math.max(0, dt);
      dPhi = Math.abs(dPhi) <= jitter ? 0 : dPhi;
      reason = dPhi === 0 ? 'no_flux_change' : 'dt_too_small';
    } else if (Math.abs(dPhi) <= jitter) {
      dPhi = 0;
      warnings.push('jitter_threshold');
      reason = 'jitter_threshold';
    } else {
      fluxChangeSign = dPhi > 0 ? 1 : -1;
      inducedFieldSign = -fluxChangeSign;
      direction = fluxChangeSign > 0 ? 'opposes_flux_increase' : 'opposes_flux_decrease';
      reason = direction;
      emfRaw = -N.value * dPhi / dt;
      if (!isFiniteNumber(emfRaw)) {
        warnings.push('emf_not_finite');
        emfRaw = 0;
      }
      emf = emfRaw;
      if (Math.abs(emf) > maxAbsEmf) {
        warnings.push('emf_clamped');
        emf = (emf < 0 ? -1 : 1) * maxAbsEmf;
        clamped = true;
      }
    }

    return ok({
      previousPhi_Wb: prev.value,
      currentPhi_Wb: cur.value,
      deltaPhi_Wb: dPhi,
      deltaPhiRaw_Wb: dPhiRaw,
      dt_s: dt,
      turns: N.value,
      emfRaw_V: emfRaw,
      emf_V: emf,
      clamped: clamped,
      warnings: warnings,
      direction: direction,
      reason: reason,
      fluxChangeSign: fluxChangeSign,
      inducedFieldSign: inducedFieldSign,
      hasInduction: Math.abs(emf) > 0
    }, {
      previousPhi_Wb: prev.value,
      currentPhi_Wb: cur.value,
      deltaPhi_Wb: dPhi,
      dt_s: dt,
      emf_V: emf,
      unit: 'V',
      direction: direction,
      warnings: warnings
    });
  }

  var induction = {
    faradayLenzIndependent: computeFaradayLenzIndependent,
    inducedEmfFromFluxChange: function (args) {
      args = args || {};
      var N = readTurns(args);
      if (!N.ok) return N;
      var fc = flux.fluxChange(args);
      if (!fc.ok) return fc;
      var emf = -N.value * fc.rate_WbPerS;
      return ok(emf, { emf_V: emf, unit: 'V', turns: N.value, deltaPhi_Wb: fc.deltaPhi_Wb, dt_s: fc.dt_s });
    },
    inducedEmfFromFluxSamples: function (samplesOrArgs) {
      var samples = Array.isArray(samplesOrArgs) ? samplesOrArgs : samplesOrArgs && samplesOrArgs.samples;
      var turnsArgs = Array.isArray(samplesOrArgs) ? { turns: 1 } : samplesOrArgs || { turns: 1 };
      var N = readTurns(turnsArgs);
      if (!N.ok) return N;
      if (!Array.isArray(samples) || samples.length < 2) return fail('not_enough_flux_samples');
      var normalized = [];
      for (var i = 0; i < samples.length; i++) {
        var ns = normalizeSample(samples[i], i);
        if (!ns.ok) return ns;
        normalized.push(ns.value);
      }
      normalized.sort(function (a, b) { return a.t - b.t; });
      var segments = [];
      for (var j = 1; j < normalized.length; j++) {
        var prev = normalized[j - 1];
        var cur = normalized[j];
        var dt = cur.t - prev.t;
        if (dt <= EPS) return fail('non_increasing_sample_time', { index: j, dt: dt });
        var dPhi = cur.phi - prev.phi;
        var emf = -N.value * dPhi / dt;
        segments.push({ from: prev.t, to: cur.t, dt_s: dt, deltaPhi_Wb: dPhi, emf_V: emf });
      }
      var sum = 0;
      var min = Infinity;
      var max = -Infinity;
      for (var k = 0; k < segments.length; k++) {
        sum += segments[k].emf_V;
        min = Math.min(min, segments[k].emf_V);
        max = Math.max(max, segments[k].emf_V);
      }
      return ok(segments, { segments: segments, latestEmf_V: segments[segments.length - 1].emf_V, averageEmf_V: sum / segments.length, minEmf_V: min, maxEmf_V: max, turns: N.value, unit: 'V' });
    },
    lenzDirectionHint: function (args) {
      args = args || {};
      var dPhi;
      if (args.deltaPhi != null || args.deltaPhi_Wb != null) {
        var d = safeNumber(args.deltaPhi_Wb != null ? args.deltaPhi_Wb : args.deltaPhi, { name: 'deltaPhi' });
        if (!d.ok) return d;
        dPhi = d.value;
      } else {
        var fc = flux.fluxChange(args);
        if (!fc.ok) return fc;
        dPhi = fc.deltaPhi_Wb;
      }
      if (Math.abs(dPhi) <= EPS) {
        return ok({ direction: 'none', inducedFieldSign: 0, reason: 'no_flux_change' });
      }
      var sign = dPhi > 0 ? 1 : -1;
      return ok({
        direction: sign > 0 ? 'opposes_flux_increase' : 'opposes_flux_decrease',
        inducedFieldSign: -sign,
        fluxChangeSign: sign
      });
    }
  };

  function approxEqual(a, b, tol) {
    tol = tol == null ? 1e-9 : tol;
    return Math.abs(a - b) <= tol;
  }

  function runCheck(name, fn) {
    try {
      var pass = !!fn();
      return { name: name, pass: pass };
    } catch (err) {
      return { name: name, pass: false, error: err && err.message ? err.message : String(err) };
    }
  }

  function selfTest() {
    var tests = [];
    tests.push(runCheck('unit: μC to C', function () {
      var r = units.chargeToC(2, 'μC');
      return r.ok && approxEqual(r.value, 2e-6, 1e-18);
    }));
    tests.push(runCheck('vec3: cross product', function () {
      var r = vec3.cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      return r.ok && approxEqual(r.value.z, 1) && approxEqual(r.value.x, 0) && approxEqual(r.value.y, 0);
    }));
    tests.push(runCheck('Laplace: I L B sin(theta)', function () {
      var r = forces.laplaceForce({ currentA: 2, lengthM: 0.5, B_T: 0.4, thetaDeg: 90 });
      return r.ok && approxEqual(r.forceN, 0.4, 1e-12);
    }));
    tests.push(runCheck('Flux: B A cos(theta)', function () {
      var r = flux.magneticFlux({ B_T: 0.2, areaM2: 0.01, thetaDeg: 60 });
      return r.ok && approxEqual(r.phi_Wb, 0.001, 1e-12);
    }));
    tests.push(runCheck('Faraday: induced EMF from flux change', function () {
      var r = induction.inducedEmfFromFluxChange({ turns: 100, phi1: 0.01, phi2: 0.03, dt: 0.5 });
      return r.ok && approxEqual(r.emf_V, -4, 1e-12);
    }));
    tests.push(runCheck('Lorentz: q(v × B)', function () {
      var r = forces.magneticLorentzForce({ qC: 2, vVector: { x: 3, y: 0, z: 0 }, BVector: { x: 0, y: 0, z: 4 } });
      return r.ok && approxEqual(r.value.x, 0) && approxEqual(r.value.y, -24) && approxEqual(r.value.z, 0);
    }));
    tests.push(runCheck('Defensive: dt = 0 rejected', function () {
      var r = induction.inducedEmfFromFluxChange({ turns: 10, phi1: 0, phi2: 1, dt: 0 });
      return !r.ok;
    }));
    tests.push(runCheck('Faraday-Lenz independent: stable flux gives zero EMF', function () {
      var r = induction.faradayLenzIndependent({ turns: 25, previousPhi_Wb: 0.002, currentPhi_Wb: 0.002, dt_s: 0.1 });
      return r.ok && approxEqual(r.value.emf_V, 0) && r.value.direction === 'none';
    }));
    tests.push(runCheck('Faraday-Lenz independent: reversal flips direction', function () {
      var a = induction.faradayLenzIndependent({ turns: 10, previousPhi_Wb: 0, currentPhi_Wb: 0.01, dt_s: 0.5 });
      var b = induction.faradayLenzIndependent({ turns: 10, previousPhi_Wb: 0.01, currentPhi_Wb: 0, dt_s: 0.5 });
      return a.ok && b.ok && a.value.direction === 'opposes_flux_increase' && b.value.direction === 'opposes_flux_decrease' && a.value.emf_V === -b.value.emf_V;
    }));
    tests.push(runCheck('Faraday-Lenz independent: dt = 0 guarded', function () {
      var r = induction.faradayLenzIndependent({ turns: 10, previousPhi_Wb: 0, currentPhi_Wb: 0.01, dt_s: 0 });
      return r.ok && r.value.emf_V === 0 && r.value.warnings.indexOf('dt_zero') >= 0;
    }));

    var passed = 0;
    for (var i = 0; i < tests.length; i++) if (tests[i].pass) passed++;
    return {
      ok: passed === tests.length,
      version: VERSION,
      total: tests.length,
      passed: passed,
      failed: tests.length - passed,
      results: tests
    };
  }

  var EM = {
    version: VERSION,
    constants: {
      EPS: EPS,
      TAU: TAU
    },
    units: units,
    vec2: vec2,
    vec3: vec3,
    fields: fields,
    flux: flux,
    forces: forces,
    induction: induction,
    selfTest: selfTest,

    // Top-level aliases for convenient console use and future integration.
    safeNumber: safeNumber,
    clamp: clamp,
    degToRad: degToRad,
    radToDeg: radToDeg,
    uniformElectricField: fields.uniformElectricField,
    electricForce: fields.electricForce,
    electricPotentialDifferenceUniform: fields.electricPotentialDifferenceUniform,
    uniformMagneticField: fields.uniformMagneticField,
    magneticFieldVector2D: fields.magneticFieldVector2D,
    safeBFieldMagnitude: fields.safeBFieldMagnitude,
    lorentzForce: forces.lorentzForce,
    magneticLorentzForce: forces.magneticLorentzForce,
    electricLorentzForce: forces.electricLorentzForce,
    laplaceForce: forces.laplaceForce,
    laplaceForceVector2D: forces.laplaceForceVector2D,
    magneticFlux: flux.magneticFlux,
    magneticFluxLinkage: flux.magneticFluxLinkage,
    fluxChange: flux.fluxChange,
    inducedEmfFromFluxChange: induction.inducedEmfFromFluxChange,
    inducedEmfFromFluxSamples: induction.inducedEmfFromFluxSamples,
    lenzDirectionHint: induction.lenzDirectionHint,
    faradayLenzIndependent: induction.faradayLenzIndependent
  };

  root.Circuit2D_EM = EM;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EM;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
