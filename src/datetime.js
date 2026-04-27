const pad = (value) => String(value).padStart(2, '0');

const to12HourTime = (hours, minutes) => {
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return `${pad(normalizedHours)}:${pad(minutes)} ${suffix}`;
};

const extractDateParts = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hours: value.getHours(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds()
    };
  }

  const stringValue = String(value).trim();
  const match = stringValue.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hours: Number(match[4] || 0),
      minutes: Number(match[5] || 0),
      seconds: Number(match[6] || 0)
    };
  }

  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
    seconds: parsed.getSeconds()
  };
};

export const toDateTimeLocalInput = (value) => {
  const parts = extractDateParts(value);
  if (!parts) return '';

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`;
};

export const formatDateTimeDisplay = (value) => {
  const parts = extractDateParts(value);
  if (!parts) return '';

  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${to12HourTime(parts.hours, parts.minutes)}`;
};

export const formatTimeDisplay = (value) => {
  const parts = extractDateParts(value);
  if (!parts) return '';

  return to12HourTime(parts.hours, parts.minutes);
};

export const getDateOnlyKey = (value) => {
  const parts = extractDateParts(value);
  if (!parts) return '';

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};
