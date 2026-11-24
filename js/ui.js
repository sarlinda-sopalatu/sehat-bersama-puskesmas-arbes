/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Komponen & utilitas antarmuka
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = (window.PK = window.PK || {});
  const ui = {};
  const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    queue: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    stethoscope: '<path d="M4.8 2.3A.3.3 0 0 1 5 2h1.5a.5.5 0 0 1 .5.5v5a4 4 0 0 0 8 0v-5a.5.5 0 0 1 .5-.5H17a.3.3 0 0 1 .2.3"/><path d="M6 2v5a6 6 0 0 0 12 0V2"/><path d="M12 13v3a4 4 0 0 0 8 0v-2"/><circle cx="20" cy="12" r="2"/>',
    pill: '<path d="M10.5 20.5a6.36 6.36 0 0 1-9-9l8-8a6.36 6.36 0 0 1 9 9Z"/><path d="m8.5 8.5 7 7"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.4 2c-.8.9-2.5 1.3-2.5 3"/><path d="M12 17.5h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    eye: '<path d="M2.1 12a10.8 10.8 0 0 1 19.8 0 10.8 10.8 0 0 1-19.8 0Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 21.9 12a10.8 10.8 0 0 1-2.1 3M6.6 6.6A10.8 10.8 0 0 0 2.1 12a10.8 10.8 0 0 0 14.4 5.6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.4L3 16"/><path d="M3 21v-5h5"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    play: '<path d="m6 3 14 9-14 9Z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>',
    'volume-off': '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m23 9-6 6M17 9l6 6"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    'file-plus': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 12v6M9 15h6"/>',
    'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h2"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    package: '<path d="m16.5 9.4-9-5.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 11h8M8 15h6"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'heart-pulse': '<path d="M19 14c1.5-1.5 3-3.4 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.1 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12h4.3l1.5-3 3 6 1.5-3h4.3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m12 12 8.5-8.5M15.5 7.5 19 11M18 5l2 2"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
    tooth: '<path d="M12 5.5c-1.5-2-3.5-3-5.5-2.4C3.7 4.1 2.8 7 3.5 10c.5 2 1 3 1.5 5 .5 2 .8 5 2.5 5 1.6 0 1.6-3.8 2-5.5.3-1.2 1.4-1.2 2.5-1.2s2.2 0 2.5 1.2c.4 1.7.4 5.5 2 5.5 1.7 0 2-3 2.5-5 .5-2 1-3 1.5-5 .7-3-.2-5.9-3-6.9-2-.6-4 .4-5.5 2.4Z"/>',
    baby: '<circle cx="12" cy="8" r="5"/><path d="M9 9h.01M15 9h.01M10 12c.6.6 1.2.9 2 .9s1.4-.3 2-.9M5 22v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/>',
    apple: '<path d="M12 7c-2-3-6-3-8 0-2 3-1 8 1 11 1.5 2.3 4 2 5 0h4c1 2 3.5 2.3 5 0 2-3 3-8 1-11-2-3-6-3-8 0"/><path d="M12 7c0-2 1-4 3-4"/>',
    'trending-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'trending-down': '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    'dot': '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
    sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16v4M17 18h4M5 3v4M3 5h4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    'external-link': '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    'more-horizontal': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'thermometer': '<path d="M14 14.8V5a4 4 0 0 0-8 0v9.8a6 6 0 1 0 8 0Z"/><path d="M10 9v7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'toggle-left': '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="8" cy="12" r="3"/>',
    'toggle-right': '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="3"/>'
  };

  function icon(name, className, size) {
    const path = ICONS[name] || ICONS.circle;
    const cls = className ? ' class="' + esc(className) + '"' : '';
    const dims = size ? ' width="' + Number(size) + '" height="' + Number(size) + '"' : '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + cls + dims + '>' + path + '</svg>';
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) {
    return esc(value);
  }

  const dateLong = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateMedium = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateShort = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' });
  const dayLong = new Intl.DateTimeFormat('id-ID', { weekday: 'long' });
  const timeShort = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
  const timeLong = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

  function asDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(value);
  }

  function fmtDate(value, style) {
    if (!value) return '—';
    const d = asDate(value);
    if (Number.isNaN(d.getTime())) return '—';
    if (style === 'medium') return dateMedium.format(d);
    if (style === 'short') return dateShort.format(d);
    if (style === 'month') return monthYear.format(d);
    if (style === 'full') {
      return dayLong.format(d) + ', ' + dateLong.format(d);
    }
    return dateLong.format(d);
  }

  function fmtDateTime(value, seconds) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateMedium.format(d) + ' · ' + (seconds ? timeLong.format(d) : timeShort.format(d));
  }

  function fmtTime(value, seconds) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return seconds ? timeLong.format(d) : timeShort.format(d);
  }

  function fmtDay(value) {
    const d = asDate(value);
    return Number.isNaN(d.getTime()) ? '—' : dayLong.format(d);
  }

  function relativeDay(dayKey) {
    if (!dayKey) return '—';
    const today = NS.core.dateKey();
    if (dayKey === today) return 'Hari ini';
    if (dayKey === NS.core.addDaysKey(today, -1)) return 'Kemarin';
    if (dayKey === NS.core.addDaysKey(today, 1)) return 'Besok';
    return fmtDate(dayKey, 'medium');
  }

  function relativeTime(value) {
    if (!value) return 'Belum pernah';
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return minutes + ' menit lalu';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' jam lalu';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + ' hari lalu';
    return fmtDate(value, 'medium');
  }

  function currency(value, withPrefix) {
    const amount = Number(value) || 0;
    const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount);
    return withPrefix === false ? text : 'Rp' + text;
  }

  function number(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
  }

  function initials(name) {
    const parts = String(name || 'PK')
      .replace(/,.*$/, '')
      .replace(/\b(dr|drg|Ns|S\.Kep|S\.Farm|S\.Kom|M\.K\.M)\b\.?/gi, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'PK';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function ageLabel(birthDate) {
    return NS.core.ageOf(birthDate) + ' th';
  }

  function ageDetail(birthDate) {
    if (!birthDate) return '—';
    return fmtDate(birthDate) + ' · ' + ageLabel(birthDate);
  }

  function maskNik(nik) {
    const text = String(nik || '');
    if (text.length < 8) return text || '—';
    return text.slice(0, 6) + ' •••• ' + text.slice(-4);
  }

  function groupNik(nik) {
    const text = String(nik || '');
    if (text.length !== 16) return text || '—';
    return text.replace(/(\d{6})(\d{6})(\d{4})/, '$1 $2 $3');
  }

  function statusBadge(status) {
    const meta = NS.constants.STATUS_META[status] || { label: status, tone: 'muted' };
    return '<span class="badge badge-' + esc(meta.tone) + '"><span class="badge-dot"></span>' + esc(meta.label) + '</span>';
  }

  function billBadge(status) {
    const meta = NS.constants.BILL_STATUS_META[status] || { label: status, tone: 'muted' };
    return '<span class="badge badge-' + esc(meta.tone) + '">' + esc(meta.label) + '</span>';
  }

  function poliBadge(poliId, compact) {
    const poli = NS.core.getPoli(poliId);
    return '<span class="badge badge-poli" style="--poli-color:' + esc(poli.warna) + '"><span class="badge-dot"></span>' + esc(compact ? poli.singkat : poli.nama) + '</span>';
  }

  function roleBadge(role) {
    const meta = NS.core.getRoleMeta(role);
    return '<span class="badge role-badge" style="--role-color:' + esc(meta.color) + ';--role-tint:' + esc(meta.tint) + '">' + esc(meta.label) + '</span>';
  }

  function priorityBadge(queue) {
    if (!queue || !queue.prioritas) return '';
    return '<span class="badge badge-priority" title="' + attr(queue.alasanPrioritas || 'Antrean prioritas') + '">' + icon('sparkles') + 'Prioritas</span>';
  }

  function badge(text, tone) {
    return '<span class="badge badge-' + esc(tone || 'muted') + '">' + esc(text) + '</span>';
  }

  function avatar(name, size, tone) {
    return '<span class="avatar ' + (size ? 'avatar-' + esc(size) : '') + '" ' + (tone ? 'style="--avatar-tone:' + attr(tone) + '"' : '') + '>' + esc(initials(name)) + '</span>';
  }

  function emptyState(iconName, title, description, action) {
    return '<div class="empty-state">' +
      '<span class="empty-state-icon">' + icon(iconName || 'box') + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(description) + '</p>' +
      (action || '') +
      '</div>';
  }

  function pageHeader(options) {
    return '<div class="page-header">' +
      '<div class="page-header-copy">' +
      (options.eyebrow ? '<span class="eyebrow">' + esc(options.eyebrow) + '</span>' : '') +
      '<h1>' + esc(options.title) + '</h1>' +
      (options.description ? '<p>' + esc(options.description) + '</p>' : '') +
      '</div>' +
      (options.actions ? '<div class="page-header-actions">' + options.actions + '</div>' : '') +
      '</div>';
  }

  function sectionHeader(title, description, actions, iconName) {
    return '<div class="section-header">' +
      '<div class="section-header-copy">' +
      (iconName ? '<span class="section-icon">' + icon(iconName) + '</span>' : '') +
      '<div><h2>' + esc(title) + '</h2>' + (description ? '<p>' + esc(description) + '</p>' : '') + '</div>' +
      '</div>' +
      (actions ? '<div class="section-actions">' + actions + '</div>' : '') +
      '</div>';
  }

  function statCard(options) {
    const trend = options.trend;
    return '<article class="stat-card ' + (options.className || '') + '">' +
      '<div class="stat-card-top">' +
      '<span class="stat-icon stat-icon-' + attr(options.tone || 'teal') + '">' + icon(options.icon || 'activity') + '</span>' +
      (trend ? '<span class="stat-trend ' + (trend.direction === 'down' ? 'is-down' : '') + '">' + icon(trend.direction === 'down' ? 'trending-down' : 'trending-up') + esc(trend.label) + '</span>' : '') +
      '</div>' +
      '<div class="stat-value">' + (options.htmlValue || esc(options.value)) + '</div>' +
      '<div class="stat-label">' + esc(options.label) + '</div>' +
      (options.hint ? '<div class="stat-hint">' + icon(options.hintIcon || 'info') + '<span>' + esc(options.hint) + '</span></div>' : '') +
      '</article>';
  }

  let modalCleanup = null;
  let lastFocusedElement = null;

  function modal(options) {
    const root = document.getElementById('modalRoot');
    if (!root) return null;
    closeModal();
    lastFocusedElement = document.activeElement;
    const size = options.size || 'md';
    const hasFooter = Boolean(options.footer);
    root.innerHTML = '<div class="modal-layer" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<div class="modal-backdrop" data-modal-close></div>' +
      '<div class="modal modal-' + esc(size) + '" role="document">' +
      '<header class="modal-header">' +
      '<div class="modal-heading">' +
      (options.icon ? '<span class="modal-icon">' + icon(options.icon) + '</span>' : '') +
      '<div><h2 id="modalTitle">' + esc(options.title || '') + '</h2>' + (options.subtitle ? '<p>' + esc(options.subtitle) + '</p>' : '') + '</div>' +
      '</div>' +
      '<button class="icon-btn modal-close" type="button" data-modal-close aria-label="Tutup">' + icon('x') + '</button>' +
      '</header>' +
      '<div class="modal-body">' + (options.content || '') + '</div>' +
      (hasFooter ? '<footer class="modal-footer">' + options.footer + '</footer>' : '') +
      '</div>' +
      '</div>';
    document.body.classList.add('modal-open');
    const layer = root.querySelector('.modal-layer');
    layer.querySelectorAll('[data-modal-close]').forEach((element) => {
      element.addEventListener('click', function () { closeModal(); });
    });
    const onKeydown = function (event) {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }
      if (event.key === 'Tab') {
        const focusables = Array.from(layer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeydown);
    modalCleanup = function () {
      document.removeEventListener('keydown', onKeydown);
    };
    requestAnimationFrame(function () {
      const firstInput = layer.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.btn-primary');
      if (firstInput) firstInput.focus();
      else layer.querySelector('.modal-close')?.focus();
      if (typeof options.onMount === 'function') options.onMount(layer);
    });
    return layer;
  }

  function closeModal() {
    const root = document.getElementById('modalRoot');
    if (modalCleanup) {
      modalCleanup();
      modalCleanup = null;
    }
    if (root) root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      const element = lastFocusedElement;
      lastFocusedElement = null;
      setTimeout(function () { element.focus(); }, 10);
    }
  }

  function confirmDialog(message, options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      let resolved = false;
      const layer = modal({
        title: opts.title || 'Konfirmasi tindakan',
        subtitle: opts.subtitle || 'Pastikan Anda memilih tindakan yang tepat.',
        icon: opts.danger === false ? 'help' : 'alert-circle',
        size: 'sm',
        content: '<div class="confirm-message"><p>' + esc(message) + '</p></div>',
        footer: '<button type="button" class="btn btn-secondary" data-confirm-cancel>Tidak, kembali</button>' +
          '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" data-confirm-ok>' + esc(opts.okText || 'Ya, lanjutkan') + '</button>',
        onMount: function (element) {
          element.querySelector('[data-confirm-cancel]').addEventListener('click', function () {
            resolved = true;
            closeModal();
            resolve(false);
          });
          element.querySelector('[data-confirm-ok]').addEventListener('click', function () {
            resolved = true;
            closeModal();
            resolve(true);
          });
        }
      });
      if (!layer) resolve(false);
      const observer = new MutationObserver(function () {
        if (!document.getElementById('modalRoot').innerHTML && !resolved) {
          observer.disconnect();
          resolve(false);
        }
      });
      observer.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }

  let toastCounter = 0;
  function toast(message, type, title) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const id = 'toast-' + (++toastCounter);
    const iconName = type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
    const titles = { success: 'Berhasil', error: 'Terjadi kesalahan', warning: 'Perhatian', info: 'Informasi' };
    const node = document.createElement('div');
    node.className = 'toast toast-' + (type || 'success');
    node.id = id;
    node.innerHTML = '<span class="toast-icon">' + icon(iconName) + '</span>' +
      '<div class="toast-copy"><strong>' + esc(title || titles[type] || titles.success) + '</strong><span>' + esc(message) + '</span></div>' +
      '<button class="toast-close" type="button" aria-label="Tutup notifikasi">' + icon('x') + '</button>' +
      '<span class="toast-progress"></span>';
    root.appendChild(node);
    const remove = function () {
      node.classList.add('is-leaving');
      setTimeout(function () { node.remove(); }, 220);
    };
    node.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, type === 'error' ? 7000 : 4500);
    return node;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error || 'Terjadi kesalahan tidak diketahui.');
    toast(message, 'error');
  }

  function closeAllDropdowns() {
    ['notifPanel', 'userMenu'].forEach(function (id) {
      const panel = document.getElementById(id);
      if (panel) panel.hidden = true;
    });
    ['notifBtn', 'userMenuBtn'].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }

  function printDocument(content, options) {
    const opts = options || {};
    const root = document.getElementById('printArea');
    if (!root) return;
    root.innerHTML = '<div class="print-sheet ' + (opts.className || '') + '">' + content + '</div>';
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-printing');
    const originalTitle = document.title;
    if (opts.title) document.title = opts.title;
    let finished = false;
    const cleanup = function () {
      if (finished) return;
      finished = true;
      document.body.classList.remove('is-printing');
      root.innerHTML = '';
      root.setAttribute('aria-hidden', 'true');
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () {
      window.print();
      setTimeout(cleanup, 1200);
    }, 120);
  }

  function printLetterhead(subtitle) {
    const clinic = NS.store.clinic;
    return '<div class="print-letterhead">' +
      '<div class="print-logo">' + brandMark() + '</div>' +
      '<div class="print-clinic">' +
      '<h1>' + esc(clinic.nama) + '</h1>' +
      '<p>' + esc(clinic.instansi || 'Puskesmas') + '</p>' +
      '<p class="print-address">' + esc(clinic.alamat) + '<br>' + esc(clinic.telepon) + ' · ' + esc(clinic.email) + '</p>' +
      '</div>' +
      '<div class="print-facility"><span>Kode Faskes</span><strong>' + esc(clinic.kodeFaskes || '—') + '</strong></div>' +
      '</div>' +
      (subtitle ? '<div class="print-subtitle"><span>' + esc(subtitle) + '</span></div>' : '') +
      '<div class="print-rule"></div>';
  }

  function printFooter() {
    const clinic = NS.store.clinic;
    return '<div class="print-footer">' +
      '<span>' + esc(clinic.nama) + ' · ' + esc(clinic.alamat) + '</span>' +
      '<span>Dicetak pada ' + esc(fmtDateTime(new Date().toISOString(), true)) + '</span>' +
      '</div>';
  }

  function brandMark() {
    return '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 8v24M8 20h24" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="31" cy="9" r="4" fill="#9ac6ff"/></svg>';
  }

  function barcode(value) {
    const text = String(value || 'Sehat Bersama - Puskesmas Arbes');
    let bars = '';
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      const widths = [1 + (code % 3), 1 + ((code >> 2) % 2), 1 + ((code >> 3) % 3)];
      widths.forEach(function (width, index) {
        if (index !== 2) bars += '<span style="width:' + width + 'px"></span>';
      });
      bars += '<span class="barcode-space" style="width:' + (1 + (code % 2)) + 'px"></span>';
    }
    return '<div class="barcode-wrap"><div class="barcode" aria-hidden="true">' + bars + '</div><small>' + esc(text) + '</small></div>';
  }

  function lineChart(points, options) {
    const opts = Object.assign({ height: 230, color: '#0f766e', fill: 'rgba(15,118,110,.12)', valueFormatter: number, showArea: true }, options || {});
    const data = (points || []).map(function (point) { return { label: String(point.label || ''), value: Number(point.value) || 0, extra: point.extra || '' }; });
    if (!data.length) return emptyState('chart', 'Belum ada data', 'Data akan tampil setelah ada kunjungan pada periode ini.');
    const width = 760;
    const height = opts.height;
    const margin = { top: 18, right: 22, bottom: 38, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
    const pointsXY = data.map(function (point, index) {
      const x = margin.left + (data.length > 1 ? index * stepX : innerW / 2);
      const y = margin.top + innerH - (point.value / niceMax) * innerH;
      return { x: x, y: y, data: point };
    });
    const path = pointsXY.map(function (point, index) { return (index === 0 ? 'M' : 'L') + point.x.toFixed(1) + ' ' + point.y.toFixed(1); }).join(' ');
    const areaPath = path + ' L' + pointsXY[pointsXY.length - 1].x.toFixed(1) + ' ' + (margin.top + innerH) + ' L' + pointsXY[0].x.toFixed(1) + ' ' + (margin.top + innerH) + ' Z';
    const gradientId = 'chart-gradient-' + Math.random().toString(36).slice(2, 8);
    let grid = '';
    for (let i = 0; i <= 4; i += 1) {
      const y = margin.top + (innerH / 4) * i;
      const value = Math.round(niceMax - (niceMax / 4) * i);
      grid += '<line x1="' + margin.left + '" y1="' + y + '" x2="' + (width - margin.right) + '" y2="' + y + '" class="chart-grid-line"/>';
      grid += '<text x="' + (margin.left - 10) + '" y="' + (y + 4) + '" class="chart-axis-label" text-anchor="end">' + esc(opts.valueFormatter(value)) + '</text>';
    }
    const labelStep = Math.max(1, Math.ceil(data.length / 8));
    let xLabels = '';
    data.forEach(function (point, index) {
      if (index % labelStep !== 0 && index !== data.length - 1) return;
      const item = pointsXY[index];
      xLabels += '<text x="' + item.x + '" y="' + (height - 14) + '" class="chart-axis-label" text-anchor="middle">' + esc(point.label) + '</text>';
    });
    let dots = '';
    pointsXY.forEach(function (point) {
      dots += '<g class="chart-point"><circle cx="' + point.x + '" cy="' + point.y + '" r="8" class="chart-hit"/>' +
        '<circle cx="' + point.x + '" cy="' + point.y + '" r="3.6" fill="#ffffff" stroke="' + opts.color + '" stroke-width="2.5"/>' +
        '<title>' + esc(point.data.label) + ': ' + esc(opts.valueFormatter(point.data.value)) + (point.data.extra ? ' · ' + esc(point.data.extra) : '') + '</title></g>';
    });
    return '<div class="chart-svg-wrap"><svg viewBox="0 0 ' + width + ' ' + height + '" class="chart-svg" role="img" aria-label="' + attr(opts.ariaLabel || 'Grafik tren') + '">' +
      '<defs><linearGradient id="' + gradientId + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="' + opts.color + '" stop-opacity=".22"/><stop offset="100%" stop-color="' + opts.color + '" stop-opacity="0"/></linearGradient></defs>' +
      grid +
      (opts.showArea ? '<path d="' + areaPath + '" fill="url(#' + gradientId + ')"/>' : '') +
      '<path d="' + path + '" fill="none" stroke="' + opts.color + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots + xLabels +
      '</svg></div>';
  }

  function donutChart(items, options) {
    const opts = Object.assign({ size: 180, thickness: 16, centerLabel: 'Total', centerValue: '' }, options || {});
    const data = (items || []).filter(function (item) { return Number(item.value) > 0; });
    const total = data.reduce(function (sum, item) { return sum + Number(item.value || 0); }, 0);
    if (!total) {
      return '<div class="donut-empty">' + icon('chart') + '<span>Belum ada data</span></div>';
    }
    let current = 0;
    const segments = data.map(function (item) {
      const start = (current / total) * 360;
      current += Number(item.value) || 0;
      const end = (current / total) * 360;
      return item.color + ' ' + start.toFixed(2) + 'deg ' + end.toFixed(2) + 'deg';
    }).join(', ');
    return '<div class="donut-layout">' +
      '<div class="donut" style="width:' + Number(opts.size) + 'px;height:' + Number(opts.size) + 'px;background:conic-gradient(' + segments + ')">' +
      '<div class="donut-center"><strong>' + (opts.centerValue !== '' ? esc(opts.centerValue) : number(total)) + '</strong><span>' + esc(opts.centerLabel) + '</span></div>' +
      '</div>' +
      '<div class="donut-legend">' + data.map(function (item) {
        return '<div class="legend-item"><span class="legend-dot" style="background:' + attr(item.color) + '"></span><span class="legend-label">' + esc(item.label) + '</span><strong>' + esc(number(item.value)) + '</strong><small>' + Math.round((Number(item.value) / total) * 100) + '%</small></div>';
      }).join('') + '</div>' +
      '</div>';
  }

  function barList(items, options) {
    const opts = Object.assign({ valueFormatter: number, color: '#0f766e', showRank: false }, options || {});
    const data = items || [];
    const max = Math.max.apply(null, data.map(function (item) { return Number(item.value) || 0; }).concat([1]));
    if (!data.length) return emptyState('chart', 'Belum ada data', 'Tidak ada data pada periode ini.');
    return '<div class="bar-list">' + data.map(function (item, index) {
      const width = ((Number(item.value) || 0) / max) * 100;
      return '<div class="bar-row">' +
        (opts.showRank ? '<span class="bar-rank">' + (index + 1) + '</span>' : '') +
        '<span class="bar-label" title="' + attr(item.label) + '">' + esc(item.label) + '</span>' +
        '<div class="bar-track"><span class="bar-fill" style="width:' + width.toFixed(1) + '%;background:' + attr(item.color || opts.color) + '"></span></div>' +
        '<strong class="bar-value">' + esc(opts.valueFormatter(Number(item.value) || 0)) + '</strong>' +
        '</div>';
    }).join('') + '</div>';
  }

  function sparkline(values, color) {
    const data = (values || []).map(Number);
    if (!data.length) return '';
    const width = 120;
    const height = 34;
    const max = Math.max.apply(null, data.concat([1]));
    const min = Math.min.apply(null, data.concat([0]));
    const range = max - min || 1;
    const step = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map(function (value, index) {
      return (index * step).toFixed(1) + ',' + (height - ((value - min) / range) * (height - 6) - 3).toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="sparkline" aria-hidden="true"><polyline points="' + points + '" fill="none" stroke="' + (color || '#0f766e') + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCsv(filename, headers, rows) {
    const escapeCsv = function (value) {
      const text = String(value === null || value === undefined ? '' : value);
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [headers.map(escapeCsv).join(';')];
    rows.forEach(function (row) {
      lines.push(row.map(escapeCsv).join(';'));
    });
    downloadFile(filename, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast('File CSV berhasil diunduh.', 'success');
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      const args = arguments;
      const context = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, wait || 250);
    };
  }

  function startOfMonthKey(date) {
    const d = date ? asDate(date) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  function options(list, selected, placeholder) {
    let html = placeholder !== undefined ? '<option value="">' + esc(placeholder) + '</option>' : '';
    (list || []).forEach(function (item) {
      const value = typeof item === 'object' ? item.value : item;
      const label = typeof item === 'object' ? item.label : item;
      html += '<option value="' + attr(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
    });
    return html;
  }

  function pageTabs(tabs, active) {
    return '<div class="tabs" role="tablist">' + (tabs || []).map(function (tab) {
      if (tab.href) {
        return '<a href="' + attr(tab.href) + '" class="tab' + (tab.id === active ? ' is-active' : '') + '" role="tab" aria-selected="' + (tab.id === active ? 'true' : 'false') + '">' + (tab.icon ? icon(tab.icon) : '') + '<span>' + esc(tab.label) + '</span>' + (tab.count !== undefined && tab.count !== null ? '<span class="tab-count">' + esc(number(tab.count)) + '</span>' : '') + '</a>';
      }
      return '<button type="button" class="tab' + (tab.id === active ? ' is-active' : '') + '" data-tab="' + attr(tab.id) + '" role="tab" aria-selected="' + (tab.id === active ? 'true' : 'false') + '">' + (tab.icon ? icon(tab.icon) : '') + '<span>' + esc(tab.label) + '</span>' + (tab.count !== undefined && tab.count !== null ? '<span class="tab-count">' + esc(number(tab.count)) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function pageSizeSelect(value, id) {
    return '<select class="input input-sm input-auto" id="' + attr(id || '') + '" aria-label="Jumlah data per halaman">' +
      '<option value="8"' + (Number(value) === 8 ? ' selected' : '') + '>8 / hal</option>' +
      '<option value="15"' + (Number(value) === 15 ? ' selected' : '') + '>15 / hal</option>' +
      '<option value="30"' + (Number(value) === 30 ? ' selected' : '') + '>30 / hal</option>' +
      '<option value="100"' + (Number(value) === 100 ? ' selected' : '') + '>100 / hal</option>' +
      '</select>';
  }

  function pagination(total, page, perPage) {
    const pages = Math.max(1, Math.ceil(total / perPage));
    const current = Math.min(Math.max(1, page), pages);
    if (pages <= 1) return '<div class="table-footer"><span>Menampilkan ' + number(total) + ' data</span></div>';
    let buttons = '';
    const from = Math.max(1, current - 2);
    const to = Math.min(pages, current + 2);
    if (current > 1) buttons += '<button type="button" class="page-btn" data-page="' + (current - 1) + '" aria-label="Halaman sebelumnya">' + icon('chevron-left') + '</button>';
    if (from > 1) {
      buttons += '<button type="button" class="page-btn" data-page="1">1</button>';
      if (from > 2) buttons += '<span class="page-ellipsis">…</span>';
    }
    for (let i = from; i <= to; i += 1) {
      buttons += '<button type="button" class="page-btn' + (i === current ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (to < pages) {
      if (to < pages - 1) buttons += '<span class="page-ellipsis">…</span>';
      buttons += '<button type="button" class="page-btn" data-page="' + pages + '">' + pages + '</button>';
    }
    if (current < pages) buttons += '<button type="button" class="page-btn" data-page="' + (current + 1) + '" aria-label="Halaman berikutnya">' + icon('chevron-right') + '</button>';
    return '<div class="table-footer"><span>Menampilkan ' + number((current - 1) * perPage + 1) + '–' + number(Math.min(current * perPage, total)) + ' dari ' + number(total) + ' data</span><div class="pagination">' + buttons + '</div></div>';
  }

  function formError(message) {
    return '<div class="inline-alert inline-alert-error">' + icon('alert-circle') + '<span>' + esc(message) + '</span></div>';
  }

  function inlineNotice(message, tone, iconName) {
    return '<div class="inline-alert inline-alert-' + attr(tone || 'info') + '">' + icon(iconName || 'info') + '<span>' + message + '</span></div>';
  }

  function calculateAgeFromForm(birthDate) {
    return ageLabel(birthDate);
  }

  function readForm(form) {
    const result = {};
    new FormData(form).forEach(function (value, key) {
      if (result[key] === undefined) {
        result[key] = value;
      } else if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    });
    return result;
  }

  function setSubmitting(button, isSubmitting, label) {
    if (!button) return;
    button.disabled = Boolean(isSubmitting);
    if (isSubmitting) {
      button.dataset.originalHtml = button.innerHTML;
      button.innerHTML = '<span class="spinner"></span>' + esc(label || 'Memproses…');
    } else if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }

  ui.icon = icon;
  ui.esc = esc;
  ui.attr = attr;
  ui.asDate = asDate;
  ui.fmtDate = fmtDate;
  ui.fmtDateTime = fmtDateTime;
  ui.fmtTime = fmtTime;
  ui.fmtDay = fmtDay;
  ui.relativeDay = relativeDay;
  ui.relativeTime = relativeTime;
  ui.currency = currency;
  ui.number = number;
  ui.initials = initials;
  ui.ageLabel = ageLabel;
  ui.ageDetail = ageDetail;
  ui.maskNik = maskNik;
  ui.groupNik = groupNik;
  ui.statusBadge = statusBadge;
  ui.billBadge = billBadge;
  ui.poliBadge = poliBadge;
  ui.roleBadge = roleBadge;
  ui.priorityBadge = priorityBadge;
  ui.badge = badge;
  ui.avatar = avatar;
  ui.emptyState = emptyState;
  ui.pageHeader = pageHeader;
  ui.sectionHeader = sectionHeader;
  ui.statCard = statCard;
  ui.modal = modal;
  ui.closeModal = closeModal;
  ui.confirm = confirmDialog;
  ui.toast = toast;
  ui.showError = showError;
  ui.closeAllDropdowns = closeAllDropdowns;
  ui.printDocument = printDocument;
  ui.printLetterhead = printLetterhead;
  ui.printFooter = printFooter;
  ui.brandMark = brandMark;
  ui.barcode = barcode;
  ui.lineChart = lineChart;
  ui.donutChart = donutChart;
  ui.barList = barList;
  ui.sparkline = sparkline;
  ui.downloadFile = downloadFile;
  ui.exportCsv = exportCsv;
  ui.debounce = debounce;
  ui.startOfMonthKey = startOfMonthKey;
  ui.getGreeting = getGreeting;
  ui.options = options;
  ui.pageTabs = pageTabs;
  ui.pageSizeSelect = pageSizeSelect;
  ui.pagination = pagination;
  ui.formError = formError;
  ui.inlineNotice = inlineNotice;
  ui.calculateAgeFromForm = calculateAgeFromForm;
  ui.readForm = readForm;
  ui.setSubmitting = setSubmitting;

  NS.ui = ui;
})(window);
